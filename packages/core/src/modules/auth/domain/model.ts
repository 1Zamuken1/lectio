/** Cuenta con su hash de contraseña: nunca sale de la capa de aplicación. */
export interface AuthUser {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

/** Lo que se expone de un usuario. */
export interface PublicUser {
  id: string;
  email: string;
}

/**
 * Refresh token guardado (docs/lectio-modelo-datos.md §2.7): solo su hash. Todos los tokens
 * de un mismo login comparten `familyId`; al rotar, el anterior queda revocado con
 * `replacedBy` apuntando al nuevo.
 */
export interface StoredRefreshToken {
  id: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedBy: string | null;
}

export interface NewRefreshToken {
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent: string | null;
}

/** Sesión emitida: el access token va en el cuerpo; el refresh token, en una cookie. */
export interface IssuedSession {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
}
