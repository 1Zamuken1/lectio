import { ApiError } from '../api/client';

/** Lo que Lectio acepta: EPUB sin DRM (el servidor lo vuelve a comprobar). */
export function looksLikeEpub(file: File): boolean {
  return /\.epub$/i.test(file.name) || file.type === 'application/epub+zip';
}

export const NOT_AN_EPUB = 'Eso no es un EPUB. Lectio guarda libros EPUB sin DRM.';

/**
 * El mensaje al fallar una subida, por `code` y nunca por `message` (frontend §8). El 409
 * no llega aquí: lleva al libro que ya tienes.
 */
export function uploadErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'No pude subirlo: revisa tu conexión e inténtalo otra vez.';
  }
  if (error.status === 413) return 'Ese archivo pesa demasiado para subirlo.';
  if (error.code === 'INVALID_UPLOAD') return NOT_AN_EPUB;
  if (error.status === 429) return 'Vas muy rápido: espera un momento y vuelve a intentarlo.';
  return 'Algo falló al subir el libro. Inténtalo otra vez.';
}

/** Por qué el worker no pudo preparar el libro, en lenguaje simple (frontend §8). */
export function bookErrorMessage(errorCode: string | null): string {
  switch (errorCode) {
    case 'DRM_PROTECTED':
      return 'Este libro tiene DRM y no puede procesarse. Lectio funciona con EPUB sin protección.';
    case 'INVALID_ARCHIVE':
    case 'MISSING_PACKAGE':
      return 'El archivo no es un EPUB válido o está dañado.';
    case 'NO_TEXT_CONTENT':
      return 'No encontramos texto legible en este libro.';
    default:
      return 'No pudimos preparar este libro.';
  }
}
