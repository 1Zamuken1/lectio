import { UnauthorizedError } from '../../auth/domain/errors.js';
import { BookForbiddenError } from './errors.js';

/**
 * Quién puede leer un libro (docs/lectio-arquitectura-api.md §1.7): su dueño, o cualquiera
 * si es público. La usan libros, capítulos, imágenes, audio y progreso. Sin sesión y ante un
 * libro privado responde 401 (inicia sesión), no 403: el cliente sabe qué hacer.
 */
export function assertCanRead(
  userId: string | null,
  book: { ownerId: string | null; isPublic: boolean },
): void {
  if (book.isPublic) return;
  if (userId === null) throw new UnauthorizedError();
  if (book.ownerId !== userId) throw new BookForbiddenError();
}
