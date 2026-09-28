import { createHash, randomBytes } from 'node:crypto';

/** Token opaco de 256 bits, apto para una cookie (base64url). */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 del token: es lo único que se guarda (una filtración de la base no permite suplantar sesiones). */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Normalización del correo antes de guardarlo o buscarlo. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
