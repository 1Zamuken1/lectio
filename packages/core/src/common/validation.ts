import { ValidationPipe, type ValidationError } from '@nestjs/common';
import { AppError } from './errors/app-error.js';

/**
 * Validación de las entradas con los DTO: descarta campos desconocidos y responde
 * `400 VALIDATION_FAILED` con los mensajes de cada campo.
 */
export function validationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors: ValidationError[]) =>
      new AppError(400, 'VALIDATION_FAILED', 'Hay datos inválidos en la solicitud.', {
        errors: errors.map((error) => ({
          field: error.property,
          messages: Object.values(error.constraints ?? {}),
        })),
      }),
  });
}
