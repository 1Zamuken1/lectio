import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cleanSections, openEpub, readStructure, type CleanedSection } from '../../src/index.js';

const corpusDir = fileURLToPath(new URL('../../../../corpus/', import.meta.url));
const books = existsSync(corpusDir) ? readdirSync(corpusDir).filter((f) => f.endsWith('.epub')) : [];
const has = (id: string) => books.includes(`${id}.epub`);

async function cleaned(file: string): Promise<CleanedSection[]> {
  const opened = await openEpub(await readFile(`${corpusDir}${file}`));
  return cleanSections(readStructure(opened), opened.archive).sections;
}

describe.skipIf(books.length === 0)('corpus: etapa 6 (limpieza y HTML de lectura)', () => {
  it.each(books)('%s: el HTML de lectura solo tiene etiquetas y atributos permitidos', async (file) => {
    for (const section of await cleaned(file)) {
      const html = section.contentHtml + section.notes.map((n) => n.html).join('');
      expect(html).not.toMatch(/<(script|style|iframe|object|form|link|meta)\b/i);
      // Solo dentro de etiquetas reales: el texto (ya escapado) puede contener ejemplos de código.
      expect(html).not.toMatch(/<[a-z][^>]*\s(class|style|id|on\w+)=/i);
      expect(html).not.toMatch(/\/>/); // HTML, no XHTML
      expect(section.blocks.map((b) => b.getAttribute('data-b'))).toEqual(
        section.blocks.map((_, i) => String(i)),
      );
    }
  });

  it.skipIf(!has('idpf-wasteland-otf-obf'))(
    'The Waste Land: sin números de verso; las notas se copian y su sección queda intacta',
    async () => {
      const sections = await cleaned('idpf-wasteland-otf-obf.epub');
      const burial = sections.find((s) => s.title === 'I. THE BURIAL OF THE DEAD')!;
      const notes = sections.find((s) => s.kind === 'notes')!;

      expect(burial.contentHtml).toContain('Out of this stony rubbish? Son of man,');
      expect(burial.contentHtml).not.toMatch(/rubbish\? Son of man,<a[^>]*>\*<\/a>20/);
      expect(sections.reduce((n, s) => n + s.notes.length, 0)).toBe(50);
      expect(notes.notes).toEqual([]);
      expect(notes.contentHtml).toContain('Ezekiel');
    },
  );

  it.skipIf(!has('pg-becquer-obras-escogidas'))(
    'Bécquer: marcadores de página fuera y la única nota real, sin el enlace de vuelta',
    async () => {
      const sections = await cleaned('pg-becquer-obras-escogidas.epub');
      const prologue = sections.find((s) => s.title === 'Á MANERA DE PRÓLOGO')!;

      expect(sections.reduce((n, s) => n + s.cleaning.S1_page_numbers.heuristic, 0)).toBeGreaterThan(300);
      expect(prologue.notes).toHaveLength(1);
      expect(prologue.notes[0]!.html).toContain('Álvarez Quintero');
      expect(prologue.notes[0]!.html).not.toContain('[*]');
    },
  );

  it.skipIf(!has('se-vindication-rights-woman'))(
    'Vindication: 37 notas reunidas en los capítulos que las citan',
    async () => {
      const sections = await cleaned('se-vindication-rights-woman.epub');
      const chapterOne = sections.find((s) => s.title === 'I')!;

      expect(sections.reduce((n, s) => n + s.notes.length, 0)).toBe(37);
      expect(chapterOne.contentHtml).toContain('<h2 data-b="2">I</h2>');
      expect(chapterOne.notes[0]!.html).toBe('<p><abbr>Dr.</abbr> Price.</p>');
    },
  );
});
