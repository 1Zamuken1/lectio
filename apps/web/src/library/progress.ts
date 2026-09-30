import type { BookSummary } from '../api/queries';

/** La ruta del lector: los públicos por su slug (se leen sin cuenta), los tuyos por id. */
export function readerHref(book: Pick<BookSummary, 'id' | 'isPublic' | 'slug'>): string | null {
  if (book.isPublic) return book.slug ? `/libros/${book.slug}` : null;
  return `/leer/${book.id}`;
}

/**
 * "Cap. 4 de 12 · escuchando", o null si no lo empezó. Cuenta solo capítulos narrativos:
 * en la portada o la dedicatoria todavía vas "al comienzo".
 */
export function progressLabel(book: BookSummary): string | null {
  const progress = book.progress;
  if (!progress) return null;
  const mode = progress.mode === 'listening' ? 'escuchando' : 'leyendo';
  if (progress.chapterNumber === 0) return `Al comienzo · ${mode}`;
  return `Cap. ${progress.chapterNumber} de ${progress.totalChapters} · ${mode}`;
}
