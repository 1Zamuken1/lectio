import { describe, expect, it } from 'vitest';
import { openEpub, readStructure } from '../../../src/index.js';
import { buildEpub, type BuildEpubOptions } from '../../helpers/build-epub.js';

async function navigationOf(options: BuildEpubOptions) {
  const structure = readStructure(await openEpub(await buildEpub(options)));
  return { ...structure.navigation, warnings: structure.warnings.map((w) => w.code) };
}

const chapters = [
  { id: 'cap1', title: 'Uno', body: '<h1>Uno</h1><p>Texto uno.</p>' },
  { id: 'cap2', title: 'Dos', body: '<h1>Dos</h1><p>Texto dos.</p>' },
];

describe('navegación', () => {
  it('EPUB 3: usa el nav y conserva la jerarquía', async () => {
    const nav = await navigationOf({
      chapters,
      toc: [
        { title: 'Parte', href: 'cap1.xhtml', children: [{ title: 'Dos', href: 'cap2.xhtml' }] },
      ],
    });

    expect(nav.source).toBe('nav');
    expect(nav.toc).toEqual([
      {
        title: 'Parte',
        target: { path: 'OEBPS/cap1.xhtml', fragment: null },
        children: [
          { title: 'Dos', target: { path: 'OEBPS/cap2.xhtml', fragment: null }, children: [] },
        ],
      },
    ]);
  });

  it('EPUB 2: usa el NCX', async () => {
    const nav = await navigationOf({ version: 2, chapters });

    expect(nav.source).toBe('ncx');
    expect(nav.toc.map((n) => n.title)).toEqual(['Uno', 'Dos']);
  });

  it('si el nav no sirve, cae al NCX con warning', async () => {
    const nav = await navigationOf({
      chapters,
      navigation: 'both',
      // El nav apunta a un archivo que no está en el spine; el NCX (mismo toc) también,
      // así que se construye a mano un caso donde solo el NCX sirve.
      toc: [{ title: 'Uno', href: 'cap1.xhtml' }],
      extraFiles: {
        'OEBPS/nav.xhtml': `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
          <body><nav epub:type="toc"><ol><li><a href="no-existe.xhtml">X</a></li></ol></nav></body></html>`,
      },
    });

    expect(nav.source).toBe('ncx');
    expect(nav.warnings).toContain('TOC_NAV_UNUSABLE');
  });

  it('sin índice utilizable, cae al spine con warning', async () => {
    const nav = await navigationOf({ chapters, navigation: 'none' });

    expect(nav.source).toBe('spine');
    expect(nav.warnings).toContain('TOC_FALLBACK_SPINE');
  });

  it('acepta encabezados de grupo sin enlace (<span>)', async () => {
    const nav = await navigationOf({
      chapters,
      navigation: 'nav',
      extraFiles: {
        'OEBPS/nav.xhtml': `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
          <body><nav epub:type="toc"><ol>
            <li><span>Primera parte</span><ol><li><a href="cap1.xhtml">Uno</a></li></ol></li>
            <li><a href="cap2.xhtml">Dos</a></li>
          </ol></nav></body></html>`,
      },
    });

    expect(nav.toc[0]).toMatchObject({ title: 'Primera parte', target: null });
    expect(nav.toc[0]?.children[0]?.title).toBe('Uno');
  });

  it('landmarks: solo entradas con tipo reconocido; el guide completa los que falten', async () => {
    const nav = await navigationOf({
      chapters,
      navigation: 'nav',
      extraFiles: {
        'OEBPS/nav.xhtml': `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
          <body>
            <nav epub:type="toc"><ol><li><a href="cap1.xhtml">Uno</a></li></ol></nav>
            <nav epub:type="landmarks"><ol>
              <li><a epub:type="bodymatter" href="cap1.xhtml">Comenzar</a></li>
              <li><a href="cap2.xhtml#p5">[p. 5]</a></li>
            </ol></nav>
          </body></html>`,
      },
    });

    expect(nav.landmarks).toEqual([
      { type: 'bodymatter', path: 'OEBPS/cap1.xhtml', fragment: null },
    ]);
  });
});
