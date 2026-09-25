import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  cleanSections,
  narrateSections,
  openEpub,
  readStructure,
  type NarratedSection,
} from '../../src/index.js';

const corpusDir = fileURLToPath(new URL('../../../../corpus/', import.meta.url));
const books = existsSync(corpusDir) ? readdirSync(corpusDir).filter((f) => f.endsWith('.epub')) : [];

async function narrated(file: string): Promise<NarratedSection[]> {
  const opened = await openEpub(await readFile(`${corpusDir}${file}`));
  const cleaned = cleanSections(readStructure(opened), opened.archive).sections;
  return narrateSections(cleaned, opened.metadata.language ?? 'es').sections;
}

describe.skipIf(books.length === 0)('corpus: etapas 7 a 9 (invariantes de oraciones)', () => {
  it.each(books)('%s: offsets, índices y narración son consistentes', async (file) => {
    for (const section of await narrated(file)) {
      const { sentences } = section;

      // Índices contiguos; solo el anuncio sintético (índice 0) puede no tener bloque.
      expect(sentences.map((s) => s.index)).toEqual(sentences.map((_, i) => i));
      expect(sentences.slice(1).every((s) => s.blockIndex >= 0)).toBe(true);

      for (const sentence of sentences) {
        if (sentence.blockIndex < 0) continue;
        const blockText = section.blocks[sentence.blockIndex]!.textContent ?? '';
        // La oración es exactamente un tramo del texto que ve el lector (resaltado con Range).
        expect(blockText.slice(sentence.start, sentence.end)).toBe(sentence.text);
        // La narración solo quita cosas, salvo el anuncio del capítulo.
        if (sentence.index > 0) expect(sentence.narration.length).toBeLessThanOrEqual(sentence.text.length);
        expect(sentence.narration).not.toMatch(/[\u00AD\u200B-\u200D\u2060\uFEFF]|\s{2}/);
      }

      expect(section.characterCount).toBe(sentences.reduce((n, s) => n + s.narration.length, 0));
      // Toda sección narrativa empieza con su anuncio.
      if (section.kind === 'narrative') expect(sentences[0]?.narration).toMatch(/\S/);
    }
  });
});
