import type { BookSummary } from '../api/queries';

/** "Cap. 4 de 12 · escuchando", o null si no lo empezó. */
export function progressLabel(book: BookSummary): string | null {
  const progress = book.progress;
  if (!progress) return null;
  const mode = progress.mode === 'listening' ? 'escuchando' : 'leyendo';
  return `Cap. ${progress.chapterOrder + 1} de ${progress.totalChapters} · ${mode}`;
}
