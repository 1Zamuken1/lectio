import { AppError } from '../../../common/errors/app-error.js';

export class ChapterNotFoundError extends AppError {
  constructor() {
    super(404, 'CHAPTER_NOT_FOUND', 'No existe ese capítulo.');
  }
}

export class ResourceNotFoundError extends AppError {
  constructor() {
    super(404, 'RESOURCE_NOT_FOUND', 'Ese archivo no es parte del libro.');
  }
}
