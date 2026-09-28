import type { AuthUser, NewRefreshToken, StoredRefreshToken } from './model.js';

/** Puertos del módulo (arquitectura §1.4): la aplicación depende de estas interfaces. */

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

export interface AccessTokenIssuer {
  /** Firma un access token corto; `expiresIn` en segundos. */
  issue(user: { id: string; email: string }): Promise<{ token: string; expiresIn: number }>;
  /** Verifica firma y vencimiento; null si no es válido. */
  verify(token: string): Promise<{ userId: string; email: string } | null>;
}

export interface UserRepository {
  findByEmail(email: string): Promise<AuthUser | null>;
  findById(id: string): Promise<AuthUser | null>;
  /** Lanza EmailTakenError si el correo ya existe (restricción única). */
  create(data: { email: string; passwordHash: string }): Promise<AuthUser>;
}

export interface RefreshTokenRepository {
  create(data: NewRefreshToken): Promise<StoredRefreshToken>;
  findByHash(tokenHash: string): Promise<StoredRefreshToken | null>;
  /**
   * Rota de forma atómica: revoca `oldId` y crea el nuevo token, solo si `oldId` seguía
   * vigente. null si otra petición lo rotó o revocó antes (cuenta como reutilización).
   */
  rotate(oldId: string, next: NewRefreshToken): Promise<StoredRefreshToken | null>;
  revoke(id: string): Promise<void>;
  revokeFamily(familyId: string): Promise<void>;
}

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
export const ACCESS_TOKEN_ISSUER = Symbol('ACCESS_TOKEN_ISSUER');
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');
