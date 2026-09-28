import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import type { PasswordHasher } from '../../domain/ports.js';

/**
 * argon2id con los parámetros recomendados por OWASP (19 MiB, 2 iteraciones). El hash
 * incluye sal y parámetros: se pueden endurecer después sin invalidar los existentes.
 */
@Injectable()
export class Argon2Hasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2 });
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false; // hash con formato inválido
    }
  }
}
