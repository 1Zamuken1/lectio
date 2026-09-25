import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { openEpub } from '../../src/index.js';

// Corpus real (pnpm corpus:download). Si no está descargado, estos tests se saltan
// para que `pnpm test` funcione en un clon limpio.
const corpusDir = fileURLToPath(new URL('../../../../corpus/', import.meta.url));
const books = existsSync(corpusDir)
  ? readdirSync(corpusDir).filter((file) => file.endsWith('.epub'))
  : [];

describe.skipIf(books.length === 0)('corpus: etapas 1 y 2', () => {
  it.each(books)('%s se abre con título, idioma, spine y portada', async (file) => {
    const opened = await openEpub(await readFile(`${corpusDir}${file}`));

    expect(opened.metadata.title).toBeTruthy();
    expect(opened.metadata.language).toMatch(/^(es|en)$/);
    expect(opened.package.spine.length).toBeGreaterThan(0);
    expect(opened.package.navItem ?? opened.package.ncxItem).not.toBeNull();
    expect(opened.cover).not.toBeNull();
    expect(opened.warnings).toEqual([]);
  });
});
