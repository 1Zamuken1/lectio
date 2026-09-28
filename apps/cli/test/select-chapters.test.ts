import { processEpub } from '@lectio/epub-pipeline';
import { describe, expect, it } from 'vitest';
import { buildEpub } from '../../../packages/epub-pipeline/test/helpers/build-epub.js';
import { selectChapters } from '../src/commands/narrate.js';

describe('selectChapters', () => {
  it('por defecto elige los capítulos narrativos; con lista, los números de "inspect"', async () => {
    const book = await processEpub(
      await buildEpub({
        chapters: Array.from({ length: 5 }, (_, i) => ({
          id: `c${i}`,
          title: `Capítulo ${i}`,
          body: `<p>${'Texto del capítulo. '.repeat(20)}</p>`,
        })),
      }),
    );

    expect(selectChapters(book).map((c) => c.orderIndex)).toEqual([0, 1, 2, 3, 4]);
    expect(selectChapters(book, '1-2,4').map((c) => c.orderIndex)).toEqual([1, 2, 4]);
    expect(selectChapters(book, '3').map((c) => c.orderIndex)).toEqual([3]);
    expect(selectChapters(book, '99')).toEqual([]);
  });
});
