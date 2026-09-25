import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { openEpub, readStructure, type BookStructure } from '../../src/index.js';

const corpusDir = fileURLToPath(new URL('../../../../corpus/', import.meta.url));
const has = (id: string) => existsSync(`${corpusDir}${id}.epub`);

async function structure(id: string): Promise<BookStructure> {
  return readStructure(await openEpub(await readFile(`${corpusDir}${id}.epub`)));
}

const titled = (s: BookStructure, title: string) => s.sections.find((x) => x.title === title);

describe('corpus: etapas 3 y 4 (estructura)', () => {
  it.skipIf(!has('pg-don-quijote'))('Don Quijote: capítulos con su parte como contexto', async () => {
    const s = await structure('pg-don-quijote');
    const last = s.sections.find((x) => x.title.startsWith('Capítulo LXXIV'));

    expect(s.navigation.source).toBe('nav');
    expect(s.sections.filter((x) => x.title.startsWith('Capítulo')).length).toBe(126);
    expect(last?.ancestors[0]).toMatch(/^Segunda parte/);
    expect(s.warnings).toEqual([]);
  });

  it.skipIf(!has('pg-becquer-obras-escogidas'))(
    'Bécquer: las leyendas se separan, las rimas cortas quedan juntas',
    async () => {
      const s = await structure('pg-becquer-obras-escogidas');

      expect(titled(s, 'MAESE PÉREZ EL ORGANISTA')?.ancestors).toEqual(['LEYENDAS']);
      expect(titled(s, 'RIMAS')).toBeDefined();
      expect(s.sections.some((x) => x.ancestors.includes('RIMAS'))).toBe(false);
    },
  );

  it.skipIf(!has('se-sherlock-holmes'))(
    'Sherlock Holmes: solo se subdivide el cuento que tiene partes',
    async () => {
      const s = await structure('se-sherlock-holmes');
      const scandal = s.sections.filter((x) => x.ancestors[0] === 'A Scandal in Bohemia');

      expect(scandal.map((x) => x.title)).toEqual(['I', 'II', 'III']);
      expect(titled(s, 'The Redheaded League')?.ancestors).toEqual([]);
    },
  );

  it.skipIf(!has('se-vindication-rights-woman'))(
    'Vindication: la portadilla del libro se fusiona con el capítulo I',
    async () => {
      const s = await structure('se-vindication-rights-woman');
      const first = s.sections.find((x) => x.title === 'I');

      expect(first?.documents).toEqual(['epub/text/halftitlepage.xhtml', 'epub/text/chapter-1.xhtml']);
    },
  );

  it.skipIf(!has('idpf-moby-dick'))('Moby-Dick: el índice no lineal queda aislado', async () => {
    const s = await structure('idpf-moby-dick');
    const nonLinear = s.sections.filter((x) => !x.linear);

    expect(s.sections.filter((x) => x.title.startsWith('Chapter')).length).toBe(135);
    expect(nonLinear.every((x) => x.documents.length <= 1)).toBe(true);
  });
});

describe('corpus: etapa 5 (clasificación)', () => {
  const kindOf = (s: BookStructure, title: string) => titled(s, title)?.kind;
  const books = [
    'pg-don-quijote',
    'pg-marianela',
    'pg-becquer-obras-escogidas',
    'se-sherlock-holmes',
    'se-vindication-rights-woman',
    'idpf-moby-dick',
    'idpf-wasteland-otf-obf',
    'idpf-accessible-epub-3',
  ].filter(has);

  it.skipIf(books.length === 0).each(books)(
    '%s: ningún capítulo numerado queda fuera de la narración',
    async (id) => {
      const s = await structure(id);
      const chapters = s.sections.filter((x) =>
        /^((chapter|capítulo) [\divxlc]+\b|-[ivxlc]+- |[ivxlc]+\.?$)/i.test(x.title),
      );

      expect(chapters.filter((x) => x.kind !== 'narrative').map((x) => x.title)).toEqual([]);
    },
  );

  it.skipIf(!has('pg-don-quijote'))(
    'Don Quijote: el índice HTML, los avisos de Gutenberg y los preliminares legales se ocultan',
    async () => {
      const s = await structure('pg-don-quijote');

      expect(kindOf(s, 'por Miguel de Cervantes Saavedra')).toBe('front_matter');
      expect(kindOf(s, 'The Project Gutenberg eBook of Don Quijote')).toBe('front_matter');
      expect(kindOf(s, 'TASA')).toBe('front_matter');
      expect(kindOf(s, 'THE FULL PROJECT GUTENBERG™ LICENSE')).toBe('back_matter');
      expect(kindOf(s, 'PRÓLOGO')).toBe('narrative');
    },
  );

  it.skipIf(!has('se-vindication-rights-woman'))(
    'Vindication: semántica de Standard Ebooks, con el capítulo I visible',
    async () => {
      const s = await structure('se-vindication-rights-woman');

      expect(kindOf(s, 'Titlepage')).toBe('front_matter');
      expect(kindOf(s, 'I')).toBe('narrative');
      expect(kindOf(s, 'Endnotes')).toBe('notes');
      expect(kindOf(s, 'Uncopyright')).toBe('back_matter');
    },
  );

  it.skipIf(!has('idpf-wasteland-otf-obf'))('The Waste Land: notas del autor', async () => {
    const s = await structure('idpf-wasteland-otf-obf');

    expect(kindOf(s, 'NOTES ON "THE WASTE LAND"')).toBe('notes');
    expect(s.sections.filter((x) => x.kind === 'narrative')).toHaveLength(5);
  });

  it.skipIf(!has('idpf-accessible-epub-3'))(
    'Accessible EPUB 3: copyright e índice sin marcar se detectan por contenido',
    async () => {
      const s = await structure('idpf-accessible-epub-3');
      const beforePreface = s.sections.slice(0, s.sections.findIndex((x) => x.title === 'Preface'));

      expect(beforePreface.every((x) => x.kind === 'front_matter')).toBe(true);
    },
  );
});
