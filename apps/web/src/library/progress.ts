import type { BookSummary } from '../api/queries';

/** La ruta del lector: los públicos por su slug (se leen sin cuenta), los tuyos por id. */
export function readerHref(book: Pick<BookSummary, 'id' | 'isPublic' | 'slug'>): string | null {
  if (book.isPublic) return book.slug ? `/libros/${book.slug}` : null;
  return `/leer/${book.id}`;
}

/** "Cap. 4 de 12 · escuchando", o null si no lo empezó. */
export function progressLabel(book: BookSummary): string | null {
  const progress = book.progress;
  if (!progress) return null;
  const mode = progress.mode === 'listening' ? 'escuchando' : 'leyendo';
  return `Cap. ${progress.chapterOrder + 1} de ${progress.totalChapters} · ${mode}`;
}
