import type { BookSummary } from '../api/queries';

/**
 * La estantería con muchos libros: se filtra, se ordena y se reparte en estantes de un
 * número fijo de filas que caben en la sala (la escena nunca se estira). El ancho de
 * cada lomo es conocido, así que el reparto es exacto: cada estante se llena como se
 * vería, sin filas de más.
 */

export type ShelfSort = 'reading' | 'recent' | 'title';

export const SORT_LABELS: Record<ShelfSort, string> = {
  reading: 'En curso',
  recent: 'Recientes',
  title: 'Título',
};

/** Separación entre lomos (gap de .shelf: 0.3rem). */
export const SPINE_GAP = 5;

export function hash(text: string): number {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.codePointAt(0)!, 16777619);
  return value >>> 0;
}

/** Grosor según la extensión (capítulos, si se conocen) y alto con algo de azar fijo. */
export function spineSize(book: Pick<BookSummary, 'id' | 'progress'>) {
  const seed = hash(book.id);
  const chapters = book.progress?.totalChapters ?? 12 + (seed % 20);
  return {
    seed,
    width: Math.round(Math.min(78, 36 + Math.sqrt(chapters * 25) * 1.6)),
    height: 150 + (seed % 5) * 8,
  };
}

/** Ancho de la tarjeta de un libro que no se pudo preparar (va en la repisa como uno más). */
export const CARD_WIDTH = 150;

/** Lo que ocupa cada libro en la fila: su lomo, o la tarjeta si falló. */
export function slotWidth(book: Pick<BookSummary, 'id' | 'progress'> & { status?: string }) {
  return book.status === 'error' ? CARD_WIDTH : spineSize(book).width;
}

/** Ancho de un libro de luz (la estantería holográfica del Solarpunk): todos iguales. */
export const LIGHT_BOOK_WIDTH = 54;

/** Lo que ocupa cada libro en el panel holográfico: su libro de luz, o la tarjeta si falló. */
export function holoSlotWidth(book: { status?: string }) {
  return book.status === 'error' ? CARD_WIDTH : LIGHT_BOOK_WIDTH;
}

/** Para buscar sin que importen mayúsculas ni tildes ("becquer" encuentra "Bécquer"). */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function filterBooks(books: BookSummary[], query: string): BookSummary[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return books;
  return books.filter((book) => {
    const haystack = fold(`${book.title ?? ''} ${book.author ?? ''}`);
    return words.every((word) => haystack.includes(word));
  });
}

const byTitle = (a: BookSummary, b: BookSummary) =>
  (a.title ?? '').localeCompare(b.title ?? '', 'es', { sensitivity: 'base' });
const byRecent = (a: BookSummary, b: BookSummary) => b.createdAt.localeCompare(a.createdAt);

/** "En curso": los que empezaste primero; dentro de cada grupo, los más recientes. */
export function sortBooks(books: BookSummary[], sort: ShelfSort): BookSummary[] {
  const sorted = [...books];
  if (sort === 'title') return sorted.sort(byTitle);
  if (sort === 'recent') return sorted.sort(byRecent);
  return sorted.sort((a, b) => Number(!!b.progress) - Number(!!a.progress) || byRecent(a, b));
}

/**
 * Reparte los libros en estantes de `rows` filas de `width` px; `widthOf` dice cuánto
 * ocupa cada libro (por omisión, su lomo). Si aún no se conoce el ancho (0), todo va en uno.
 */
export function packShelves<T extends Pick<BookSummary, 'id' | 'progress' | 'status'>>(
  books: T[],
  width: number,
  rows: number,
  widthOf: (book: T) => number = slotWidth,
): T[][] {
  if (width <= 0 || books.length === 0) return [books];
  const shelves: T[][] = [];
  let shelf: T[] = [];
  let row = 0;
  let used = 0;
  for (const book of books) {
    const w = widthOf(book);
    const needed = used === 0 ? w : used + SPINE_GAP + w;
    if (needed <= width || used === 0) {
      used = needed;
    } else {
      row++;
      used = w;
      if (row >= rows) {
        shelves.push(shelf);
        shelf = [];
        row = 0;
      }
    }
    shelf.push(book);
  }
  shelves.push(shelf);
  return shelves;
}
