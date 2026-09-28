import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';

export const IS_PUBLIC = 'lectio:isPublic';

export const IS_OPTIONAL_AUTH = 'lectio:isOptionalAuth';

/** Ruta abierta: el guard global de sesión no la exige. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * Sesión opcional (libros públicos): sin Authorization pasa como anónimo; con una
 * Authorization inválida o vencida responde 401 igual, así el cliente sabe que debe
 * renovar la sesión en vez de ver la versión anónima sin darse cuenta.
 */
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH, true);

/** Usuario autenticado de la petición (lo deja el guard). */
export interface SessionUser {
  userId: string;
  email: string;
}

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): SessionUser =>
    context.switchToHttp().getRequest<{ user: SessionUser }>().user,
);

/** Usuario de la petición en una ruta con @OptionalAuth(): null si es anónima. */
export const OptionalUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): SessionUser | null =>
    context.switchToHttp().getRequest<{ user?: SessionUser }>().user ?? null,
);
