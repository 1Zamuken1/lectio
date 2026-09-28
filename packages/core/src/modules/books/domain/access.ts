import { BookForbiddenError } from './errors.js';

/**
 * Quién puede leer un libro (docs/lectio-arquitectura-api.md §1.7): su dueño, o cualquiera
 * si es público. La usan libros, capítulos, imágenes y progreso.
 */
export function assertCanRead(
  userId: string | null,
  book: { ownerId: string | null; isPublic: boolean },
): void {
  if (!book.isPublic && (userId === null || book.ownerId !== userId)) {
    throw new BookForbiddenError();
  }
}
