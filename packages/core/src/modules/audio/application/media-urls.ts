import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../../../config/config.module.js';
import type { AppConfig } from '../../../config/env.js';
import { MediaUrlError } from '../domain/errors.js';

/** El vencimiento se redondea a esta ventana: la URL no cambia en cada consulta y se puede cachear. */
const WINDOW_SECONDS = 600;

/**
 * URL firmadas de corta duración para el audio y la alineación de libros privados
 * (docs/lectio-arquitectura-api.md §1.7, RNF-02). Un <audio> no manda la cabecera
 * Authorization, así que el permiso viaja en la URL: la clave del storage, el vencimiento
 * y una firma HMAC. Mismo esquema que una URL prefirmada de S3 o R2, que la reemplazará al
 * desplegar.
 */
@Injectable()
export class MediaUrlSigner {
  readonly #secret: Buffer;
  readonly #ttlSeconds: number;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    // Clave propia derivada del secreto de sesión: una firma de audio no sirve como JWT.
    this.#secret = createHmac('sha256', config.JWT_SECRET).update('lectio-media-v1').digest();
    this.#ttlSeconds = config.MEDIA_URL_TTL_SECONDS;
  }

  sign(key: string, now = Date.now()): { url: string; expiresAt: Date } {
    const exp = Math.ceil((now / 1000 + this.#ttlSeconds) / WINDOW_SECONDS) * WINDOW_SECONDS;
    const query = new URLSearchParams({ key, exp: String(exp), sig: this.#signature(key, exp) });
    return { url: `/api/v1/media?${query}`, expiresAt: new Date(exp * 1000) };
  }

  /** La clave firmada, o un error si la firma no calza o ya venció. */
  verify(query: { key?: string; exp?: string; sig?: string }, now = Date.now()): string {
    const { key, exp, sig } = query;
    if (!key || !exp || !sig || !/^\d+$/.test(exp)) throw new MediaUrlError('MEDIA_URL_INVALID');
    const expected = Buffer.from(this.#signature(key, Number(exp)));
    const given = Buffer.from(sig);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new MediaUrlError('MEDIA_URL_INVALID');
    }
    if (Number(exp) * 1000 < now) throw new MediaUrlError('MEDIA_URL_EXPIRED');
    return key;
  }

  #signature(key: string, exp: number): string {
    return createHmac('sha256', this.#secret).update(`${key}\n${exp}`).digest('base64url');
  }
}
