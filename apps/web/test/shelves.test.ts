import { describe, expect, it } from 'vitest';
import type { BookSummary } from '../src/api/queries';
import { SPINE_GAP, filterBooks, packShelves, sortBooks, spineSize } from '../src/library/shelves';

function book(id: string, extra: Partial<BookSummary> = {}): BookSummary {
  return {
    id,
    title: id,
    author: null,
    language: 'es',
    status: 'ready',
    errorCode: null,
    coverUrl: null,
    isPublic: false,
    slug: null,
    createdAt: '2026-09-01T00:00:00Z',
    progress: null,
    ...extra,
  };
}

describe('filterBooks', () => {
  const books = [
    book('a', { title: 'Obras escogidas', author: 'Gustavo Adolfo Bécquer' }),
    book('b', { title: 'Marianela', author: 'Benito Pérez Galdós' }),
  ];

  it('busca en título y autor, sin tildes ni mayúsculas', () => {
    expect(filterBooks(books, 'BECQUER').map((b) => b.id)).toEqual(['a']);
    expect(filterBooks(books, 'perez marian').map((b) => b.id)).toEqual(['b']);
  });

  it('sin texto devuelve todos', () => {
    expect(filterBooks(books, '   ')).toHaveLength(2);
  });
});

describe('sortBooks', () => {
  const books = [
    book('viejo', { title: 'Zeta', createdAt: '2026-01-01T00:00:00Z' }),
    book('nuevo', { title: 'Alfa', createdAt: '2026-09-01T00:00:00Z' }),
    book('leyendo', {
      title: 'Ñandú',
      createdAt: '2025-01-01T00:00:00Z',
      progress: { chapterOrder: 1, chapterNumber: 2, totalChapters: 10, mode: 'reading' },
    }),
  ];

  it('en curso: primero los empezados, luego los más recientes', () => {
    expect(sortBooks(books, 'reading').map((b) => b.id)).toEqual(['leyendo', 'nuevo', 'viejo']);
  });

  it('por título, con el orden del español', () => {
    expect(sortBooks(books, 'title').map((b) => b.title)).toEqual(['Alfa', 'Ñandú', 'Zeta']);
  });

  it('recientes', () => {
    expect(sortBooks(books, 'recent').map((b) => b.id)).toEqual(['nuevo', 'viejo', 'leyendo']);
  });
});

describe('packShelves', () => {
  const books = Array.from({ length: 50 }, (_, i) => book(`libro-${i}`));

  it('ninguna fila de un estante pasa del ancho y cada estante tiene a lo más `rows` filas', () => {
    const width = 600;
    const shelves = packShelves(books, width, 2);
    expect(shelves.length).toBeGreaterThan(1);
    expect(shelves.flat()).toHaveLength(50);
    for (const shelf of shelves) {
      let rows = 1;
      let used = 0;
      for (const b of shelf) {
        const w = spineSize(b).width;
        if (used > 0 && used + SPINE_GAP + w > width) {
          rows++;
          used = w;
        } else used = used === 0 ? w : used + SPINE_GAP + w;
      }
      expect(rows).toBeLessThanOrEqual(2);
    }
  });

  it('sin ancho conocido, todo en un estante', () => {
    expect(packShelves(books, 0, 2)).toHaveLength(1);
  });

  it('un lomo más ancho que la fila igual entra (solo)', () => {
    expect(packShelves([book('x')], 10, 1)).toEqual([[book('x')]]);
  });
});
