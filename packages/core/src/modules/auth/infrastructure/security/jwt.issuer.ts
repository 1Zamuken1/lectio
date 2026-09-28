import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { APP_CONFIG } from '../../../../config/config.module.js';
import type { AppConfig } from '../../../../config/env.js';
import type { AccessTokenIssuer } from '../../domain/ports.js';

interface AccessPayload {
  sub: string;
  email: string;
}

/** Access token JWT (HS256) con vida corta: vive en memoria del cliente, nunca en localStorage. */
@Injectable()
export class JwtIssuer implements AccessTokenIssuer {
  constructor(
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async issue(user: { id: string; email: string }) {
    const expiresIn = this.config.ACCESS_TOKEN_TTL_SECONDS;
    const token = await this.jwt.signAsync(
      { sub: user.id, email: user.email } satisfies AccessPayload,
      {
        expiresIn,
      },
    );
    return { token, expiresIn };
  }

  async verify(token: string) {
    try {
      const payload = await this.jwt.verifyAsync<AccessPayload>(token);
      return { userId: payload.sub, email: payload.email };
    } catch {
      return null; // firma inválida, vencido o mal formado
    }
  }
}
