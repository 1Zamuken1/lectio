import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UnauthorizedError } from '../../domain/errors.js';
import { ACCESS_TOKEN_ISSUER, type AccessTokenIssuer } from '../../domain/ports.js';
import { IS_PUBLIC, type SessionUser } from './decorators.js';

/**
 * Guard global: toda ruta exige `Authorization: Bearer <access token>` salvo las marcadas
 * con @Public(). Por defecto cerrado: una ruta nueva nunca queda abierta por olvido.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ACCESS_TOKEN_ISSUER) private readonly issuer: AccessTokenIssuer,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined>; user?: SessionUser }>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedError();

    const session = await this.issuer.verify(token);
    if (!session) throw new UnauthorizedError('La sesión venció o no es válida.');
    request.user = session;
    return true;
  }
}
