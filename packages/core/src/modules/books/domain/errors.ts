import { AppError } from '../../../common/errors/app-error.js';

export class BookNotFoundError extends AppError {
  constructor() {
    super(404, 'BOOK_NOT_FOUND', 'No existe ese libro.');
  }
}

/** El libro existe pero es de otra persona (docs/lectio-arquitectura-api.md §1.7). */
export class BookForbiddenError extends AppError {
  constructor() {
    super(403, 'BOOK_FORBIDDEN', 'Ese libro no es tuyo.');
  }
}

/** El usuario ya subió exactamente este archivo: se le devuelve el existente. */
export class BookAlreadyExistsError extends AppError {
  constructor(bookId: string) {
    super(409, 'BOOK_ALREADY_EXISTS', 'Ya subiste este libro.', { bookId });
  }
}

export class InvalidUploadError extends AppError {
  constructor(message: string) {
    super(400, 'INVALID_UPLOAD', message);
  }
}

/** Todavía hay audio generándose: borrar ahora dejaría al worker escribiendo en el vacío. */
export class BookBusyError extends AppError {
  constructor() {
    super(409, 'BOOK_BUSY', 'Hay audio generándose para este libro; espera a que termine.');
  }
}
