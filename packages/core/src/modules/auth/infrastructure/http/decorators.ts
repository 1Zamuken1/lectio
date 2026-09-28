import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';

export const IS_PUBLIC = 'lectio:isPublic';

/** Ruta abierta: el guard global de sesión no la exige. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Usuario autenticado de la petición (lo deja el guard). */
export interface SessionUser {
  userId: string;
  email: string;
}

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): SessionUser =>
    context.switchToHttp().getRequest<{ user: SessionUser }>().user,
);
