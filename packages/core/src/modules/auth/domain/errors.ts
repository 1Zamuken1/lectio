import { AppError } from '../../../common/errors/app-error.js';

/** Errores del módulo, con `code` estable para el frontend. */

export class EmailTakenError extends AppError {
  constructor() {
    super(409, 'EMAIL_TAKEN', 'Ya existe una cuenta con ese correo.');
  }
}

/** Correo inexistente o contraseña incorrecta: mismo error, para no revelar cuál falló. */
export class InvalidCredentialsError extends AppError {
  constructor() {
    super(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.');
  }
}

export class InvalidRefreshTokenError extends AppError {
  constructor() {
    super(401, 'INVALID_REFRESH_TOKEN', 'La sesión expiró o no es válida. Inicia sesión de nuevo.');
  }
}

/** Llegó un refresh token ya rotado: posible robo; se cerró toda la sesión. */
export class RefreshTokenReusedError extends AppError {
  constructor() {
    super(
      401,
      'REFRESH_TOKEN_REUSED',
      'Por seguridad se cerró la sesión en todos los dispositivos de este inicio. Inicia sesión de nuevo.',
    );
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Necesitas iniciar sesión.') {
    super(401, 'UNAUTHORIZED', message);
  }
}
