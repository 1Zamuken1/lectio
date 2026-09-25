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
