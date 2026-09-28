import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../../../config/config.module.js';
import type { AppConfig } from '../../../config/env.js';
import {
  EmailTakenError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  RefreshTokenReusedError,
} from '../domain/errors.js';
import type { IssuedSession, PublicUser, StoredRefreshToken } from '../domain/model.js';
import {
  ACCESS_TOKEN_ISSUER,
  PASSWORD_HASHER,
  REFRESH_TOKEN_REPOSITORY,
  USER_REPOSITORY,
  type AccessTokenIssuer,
  type PasswordHasher,
  type RefreshTokenRepository,
  type UserRepository,
} from '../domain/ports.js';
import { generateRefreshToken, hashRefreshToken, normalizeEmail } from '../domain/refresh-token.js';

/**
 * Casos de uso de la sesión (docs/lectio-arquitectura-api.md §1.9): access token corto en
 * memoria del cliente, refresh token largo en cookie, rotado en cada uso. Si llega un refresh
 * token ya rotado, alguien más lo tiene: se revoca toda su familia.
 */
@Injectable()
export class AuthService {
  /** Hash de relleno: el login de un correo inexistente tarda lo mismo que uno real. */
  #dummyHash: Promise<string> | null = null;

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly tokens: RefreshTokenRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(ACCESS_TOKEN_ISSUER) private readonly issuer: AccessTokenIssuer,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async register(input: { email: string; password: string }): Promise<PublicUser> {
    const email = normalizeEmail(input.email);
    if (await this.users.findByEmail(email)) throw new EmailTakenError();
    const user = await this.users.create({
      email,
      passwordHash: await this.hasher.hash(input.password),
    });
    return { id: user.id, email: user.email };
  }

  async login(input: {
    email: string;
    password: string;
    userAgent?: string | null;
  }): Promise<IssuedSession & { user: PublicUser }> {
    const user = await this.users.findByEmail(normalizeEmail(input.email));
    const hash = user?.passwordHash ?? (await this.dummyHash());
    const valid = await this.hasher.verify(hash, input.password);
    if (!user || !valid) throw new InvalidCredentialsError();

    const session = await this.startSession(user, randomUUID(), input.userAgent ?? null);
    return { ...session, user: { id: user.id, email: user.email } };
  }

  async refresh(token: string | undefined, userAgent?: string | null): Promise<IssuedSession> {
    const stored = token ? await this.tokens.findByHash(hashRefreshToken(token)) : null;
    if (!stored) throw new InvalidRefreshTokenError();

    if (stored.revokedAt) {
      // Rotado antes: quien lo presenta no es quien debería tenerlo.
      if (stored.replacedBy) {
        await this.tokens.revokeFamily(stored.familyId);
        throw new RefreshTokenReusedError();
      }
      throw new InvalidRefreshTokenError(); // cerrado con logout
    }
    if (stored.expiresAt.getTime() <= Date.now()) throw new InvalidRefreshTokenError();

    const user = await this.users.findById(stored.userId);
    if (!user) throw new InvalidRefreshTokenError();
    return this.rotateSession(stored, user, userAgent ?? null);
  }

  /** Cierra la sesión del token presentado (si no existe o ya estaba cerrada, no pasa nada). */
  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    const stored = await this.tokens.findByHash(hashRefreshToken(token));
    if (stored && !stored.revokedAt) await this.tokens.revoke(stored.id);
  }

  async currentUser(userId: string): Promise<(PublicUser & { createdAt: Date }) | null> {
    const user = await this.users.findById(userId);
    return user ? { id: user.id, email: user.email, createdAt: user.createdAt } : null;
  }

  private async startSession(
    user: PublicUser,
    familyId: string,
    userAgent: string | null,
  ): Promise<IssuedSession> {
    const refreshToken = generateRefreshToken();
    const refreshExpiresAt = this.refreshExpiry();
    await this.tokens.create({
      userId: user.id,
      familyId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshExpiresAt,
      userAgent,
    });
    const access = await this.issuer.issue(user);
    return {
      accessToken: access.token,
      expiresIn: access.expiresIn,
      refreshToken,
      refreshExpiresAt,
    };
  }

  private async rotateSession(
    stored: StoredRefreshToken,
    user: PublicUser,
    userAgent: string | null,
  ): Promise<IssuedSession> {
    const refreshToken = generateRefreshToken();
    const refreshExpiresAt = this.refreshExpiry();
    const next = await this.tokens.rotate(stored.id, {
      userId: user.id,
      familyId: stored.familyId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshExpiresAt,
      userAgent,
    });
    if (!next) {
      // Otra petición lo rotó entre la lectura y la escritura: mismo caso que la reutilización.
      await this.tokens.revokeFamily(stored.familyId);
      throw new RefreshTokenReusedError();
    }
    const access = await this.issuer.issue(user);
    return {
      accessToken: access.token,
      expiresIn: access.expiresIn,
      refreshToken,
      refreshExpiresAt,
    };
  }

  private refreshExpiry(): Date {
    return new Date(Date.now() + this.config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  }

  private dummyHash(): Promise<string> {
    this.#dummyHash ??= this.hasher.hash('contraseña-de-relleno-para-igualar-tiempos');
    return this.#dummyHash;
  }
}
