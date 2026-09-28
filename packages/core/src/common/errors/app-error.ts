/**
 * Error de aplicación con un `code` estable para el frontend (docs/lectio-arquitectura-api.md
 * §2.7): `message` es legible y puede cambiar; `code` no. `details` se agrega a la respuesta
 * (por ejemplo, la cuota restante en TTS_QUOTA_EXCEEDED).
 */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'AppError';
  }
}
