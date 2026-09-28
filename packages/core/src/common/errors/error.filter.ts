import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import { AppError } from './app-error.js';

interface HttpResponse {
  status(code: number): HttpResponse;
  json(body: unknown): void;
}

/**
 * Todas las respuestas de error con el mismo formato: `{ statusCode, code, message, error }`.
 * Un error inesperado responde 500 sin detalles internos (quedan en el log).
 */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('ErrorFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponse>();
    const body = this.toBody(exception);
    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown) {
    if (exception instanceof AppError) {
      return {
        statusCode: exception.statusCode,
        code: exception.code,
        message: exception.message,
        error: STATUS_CODES[exception.statusCode] ?? 'Error',
        ...exception.details,
      };
    }
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();
      const message =
        typeof response === 'object' && response !== null && 'message' in response
          ? (response as { message: unknown }).message
          : exception.message;
      return {
        statusCode,
        code: HttpStatus[statusCode] ?? 'HTTP_ERROR',
        message: Array.isArray(message) ? message.join('; ') : String(message),
        error: STATUS_CODES[statusCode] ?? 'Error',
      };
    }
    this.logger.error(
      exception instanceof Error ? (exception.stack ?? exception.message) : exception,
    );
    return {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Error interno del servidor.',
      error: STATUS_CODES[500],
    };
  }
}
