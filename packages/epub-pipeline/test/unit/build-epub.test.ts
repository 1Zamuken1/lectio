import { describe, expect, it } from 'vitest';
import { PIPELINE_VERSION } from '../../src/index.js';
import { buildEpub } from '../helpers/build-epub.js';
import { readZip } from '../helpers/read-zip.js';

const chapters = [
  { id: 'cap1', title: 'Capítulo uno', body: '<h1>Capítulo uno</h1><p>Era una vez.</p>' },
  { id: 'cap2', title: 'Capítulo dos', body: '<h1>Capítulo dos</h1><p>Y luego.</p>' },
];

describe('buildEpub (helper de tests)', () => {
  it('pone mimetype primero y sin comprimir, como exige OCF', async () => {
    const entries = await readZip(await buildEpub({ chapters }));

    expect(entries[0]).toMatchObject({
      path: 'mimetype',
      compressed: false,
      content: 'application/epub+zip',
    });
  });

  it('genera container, OPF, navegación y un XHTML por capítulo', async () => {
    const paths = (await readZip(await buildEpub({ chapters }))).map((e) => e.path);

    expect(paths).toEqual(
      expect.arrayContaining([
        'META-INF/container.xml',
        'OEBPS/content.opf',
        'OEBPS/nav.xhtml',
        'OEBPS/toc.ncx',
        'OEBPS/cap1.xhtml',
        'OEBPS/cap2.xhtml',
      ]),
    );
  });

  it('respeta linear="no" y los TOC jerárquicos con fragmentos', async () => {
    const entries = await readZip(
      await buildEpub({
        chapters: [
          ...chapters,
          { id: 'notas', title: 'Notas', body: '<p>1. Nota.</p>', linear: false },
        ],
        toc: [
          {
            title: 'Parte I',
            href: 'cap1.xhtml',
            children: [{ title: 'Sección 1', href: 'cap1.xhtml#s1' }],
          },
        ],
      }),
    );
    const opf = entries.find((e) => e.path === 'OEBPS/content.opf')?.content ?? '';
    const nav = entries.find((e) => e.path === 'OEBPS/nav.xhtml')?.content ?? '';

    expect(opf).toContain('<itemref idref="notas" linear="no"/>');
    expect(nav).toContain('<a href="cap1.xhtml#s1">Sección 1</a>');
  });

  it('permite producir EPUB rotos a propósito', async () => {
    const paths = (
      await readZip(
        await buildEpub({ chapters, navigation: 'none', mimetype: null, omitContainer: true }),
      )
    ).map((e) => e.path);

    expect(paths).not.toContain('mimetype');
    expect(paths).not.toContain('META-INF/container.xml');
    expect(paths).not.toContain('OEBPS/nav.xhtml');
    expect(paths).not.toContain('OEBPS/toc.ncx');
  });

  it('expone la versión del pipeline', () => {
    expect(PIPELINE_VERSION).toBe(1);
  });
});
