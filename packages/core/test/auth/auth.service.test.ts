import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from '../../src/modules/auth/application/auth.service.js';
import type { AppConfig } from '../../src/config/env.js';
import type {
  AuthUser,
  NewRefreshToken,
  StoredRefreshToken,
} from '../../src/modules/auth/domain/model.js';
import type {
  AccessTokenIssuer,
  PasswordHasher,
  RefreshTokenRepository,
  UserRepository,
} from '../../src/modules/auth/domain/ports.js';
import { hashRefreshToken } from '../../src/modules/auth/domain/refresh-token.js';

/** Adaptadores en memoria: el caso de uso se prueba sin base, sin argon2 y sin JWT. */
class MemoryUsers implements UserRepository {
  readonly rows: AuthUser[] = [];
  async findByEmail(email: string) {
    return this.rows.find((u) => u.email === email) ?? null;
  }
  async findById(id: string) {
    return this.rows.find((u) => u.id === id) ?? null;
  }
  async create(data: { email: string; passwordHash: string }) {
    const user = { id: randomUUID(), createdAt: new Date(), ...data };
    this.rows.push(user);
    return user;
  }
}

class MemoryTokens implements RefreshTokenRepository {
  readonly rows: Array<StoredRefreshToken & { tokenHash: string }> = [];
  /** Simula que otra petición rotó el token entre la lectura y la escritura. */
  raceNextRotation = false;

  async create(data: NewRefreshToken) {
    const row = { id: randomUUID(), revokedAt: null, replacedBy: null, ...data };
    this.rows.push(row);
    return row;
  }
  async findByHash(tokenHash: string) {
    return this.rows.find((r) => r.tokenHash === tokenHash) ?? null;
  }
  async rotate(oldId: string, next: NewRefreshToken) {
    const old = this.rows.find((r) => r.id === oldId);
    if (!old || old.revokedAt || this.raceNextRotation) return null;
    const created = await this.create(next);
    old.revokedAt = new Date();
    old.replacedBy = created.id;
    return created;
  }
  async revoke(id: string) {
    const row = this.rows.find((r) => r.id === id);
    if (row) row.revokedAt ??= new Date();
  }
  async revokeFamily(familyId: string) {
    for (const row of this.rows) if (row.familyId === familyId) row.revokedAt ??= new Date();
  }
}

const hasher: PasswordHasher = {
  hash: async (password) => `hash:${password}`,
  verify: async (hash, password) => hash === `hash:${password}`,
};

const issuer: AccessTokenIssuer = {
  issue: async (user) => ({ token: `access-for-${user.id}`, expiresIn: 900 }),
  verify: async () => null,
};

const config = { REFRESH_TOKEN_TTL_DAYS: 30 } as AppConfig;

let users: MemoryUsers;
let tokens: MemoryTokens;
let auth: AuthService;

beforeEach(() => {
  users = new MemoryUsers();
  tokens = new MemoryTokens();
  auth = new AuthService(users, tokens, hasher, issuer, config);
});

async function loggedIn() {
  await auth.register({ email: 'lectora@example.com', password: 'frase segura' });
  return auth.login({ email: 'lectora@example.com', password: 'frase segura' });
}

describe('AuthService', () => {
  it('login: guarda solo el hash del refresh token, con vencimiento a 30 días', async () => {
    const session = await loggedIn();
    const [row] = tokens.rows;
    expect(row?.tokenHash).toBe(hashRefreshToken(session.refreshToken));
    const days = (session.refreshExpiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
  });

  it('refresh: rota dentro de la misma familia y enlaza el anterior con el nuevo', async () => {
    const session = await loggedIn();
    const next = await auth.refresh(session.refreshToken);
    const [first, second] = tokens.rows;
    expect(second?.familyId).toBe(first?.familyId);
    expect(first?.revokedAt).not.toBeNull();
    expect(first?.replacedBy).toBe(second?.id);
    expect(next.refreshToken).not.toBe(session.refreshToken);
  });

  it('reutilizar un token rotado revoca la familia entera', async () => {
    const session = await loggedIn();
    const next = await auth.refresh(session.refreshToken);
    await expect(auth.refresh(session.refreshToken)).rejects.toMatchObject({
      code: 'REFRESH_TOKEN_REUSED',
    });
    expect(tokens.rows.every((r) => r.revokedAt)).toBe(true);
    await expect(auth.refresh(next.refreshToken)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('si otra petición rota el token a la vez, se trata como reutilización', async () => {
    const session = await loggedIn();
    tokens.raceNextRotation = true;
    await expect(auth.refresh(session.refreshToken)).rejects.toMatchObject({
      code: 'REFRESH_TOKEN_REUSED',
    });
    expect(tokens.rows.every((r) => r.revokedAt)).toBe(true);
  });

  it('logout revoca sin marcar reemplazo: luego es un token inválido, no una reutilización', async () => {
    const session = await loggedIn();
    await auth.logout(session.refreshToken);
    await expect(auth.refresh(session.refreshToken)).rejects.toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
    });
  });

  it('login de un correo inexistente también verifica un hash (mismo tiempo que uno real)', async () => {
    let verified = 0;
    auth = new AuthService(
      users,
      tokens,
      { ...hasher, verify: async (...args) => (verified++, hasher.verify(...args)) },
      issuer,
      config,
    );
    await expect(auth.login({ email: 'nadie@example.com', password: 'x' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    expect(verified).toBe(1);
  });
});
