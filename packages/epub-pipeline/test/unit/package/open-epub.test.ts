import { describe, expect, it } from 'vitest';
import { openEpub } from '../../../src/index.js';
import { buildEpub, buildZip } from '../../helpers/build-epub.js';

const chapters = [
  { id: 'cap1', title: 'Uno', body: '<p>Uno.</p>' },
  { id: 'cap2', title: 'Dos', body: '<p>Dos.</p>' },
];

describe('openEpub: metadata', () => {
  it('extrae título, autores, idioma e identificador', async () => {
    const { metadata, warnings } = await openEpub(
      await buildEpub({
        chapters,
        metadata: { title: 'Marianela', creators: ['Benito Pérez Galdós'], language: 'es' },
      }),
    );

    expect(metadata).toMatchObject({
      title: 'Marianela',
      authors: ['Benito Pérez Galdós'],
      language: 'es',
      languageTag: 'es',
    });
    expect(metadata.identifier).toMatch(/^urn:uuid:/);
    expect(warnings).toEqual([]);
  });

  it.each([
    ['es-ES', 'es'],
    ['EN-us', 'en'],
    ['spa', 'es'],
    ['fre', 'fr'],
    ['ja', 'ja'],
  ])('normaliza el idioma %s a %s', async (tag, expected) => {
    const { metadata } = await openEpub(await buildEpub({ chapters, metadata: { language: tag } }));

    expect(metadata.language).toBe(expected);
    expect(metadata.languageTag).toBe(tag);
  });

  it('EPUB 3: usa el título marcado como principal y excluye roles que no son de autor', async () => {
    const { metadata } = await openEpub(
      await buildEpub({
        chapters,
        metadata: {
          title: 'Subtítulo irrelevante',
          creators: [],
          extra: `
            <dc:title id="t2">Título principal</dc:title>
            <meta refines="#t2" property="title-type">main</meta>
            <dc:creator id="c1">Autora Real</dc:creator>
            <meta refines="#c1" property="role" scheme="marc:relators">aut</meta>
            <dc:creator id="c2">Editor Moderno</dc:creator>
            <meta refines="#c2" property="role" scheme="marc:relators">edt</meta>`,
        },
      }),
    );

    expect(metadata.title).toBe('Título principal');
    expect(metadata.authors).toEqual(['Autora Real']);
  });

  it('EPUB 2: lee el rol desde el atributo opf:role', async () => {
    const { metadata } = await openEpub(
      await buildEpub({
        version: 2,
        chapters,
        metadata: {
          creators: [],
          extra: `
            <dc:creator xmlns:opf="http://www.idpf.org/2007/opf" opf:role="aut">Autor</dc:creator>
            <dc:creator xmlns:opf="http://www.idpf.org/2007/opf" opf:role="trl">Traductora</dc:creator>`,
        },
      }),
    );

    expect(metadata.authors).toEqual(['Autor']);
  });

  it('si ningún creador es autor, muestra igualmente los que hay', async () => {
    const { metadata } = await openEpub(
      await buildEpub({
        chapters,
        metadata: {
          creators: [],
          extra: `<dc:creator id="c1">Solo Editor</dc:creator>
                  <meta refines="#c1" property="role">edt</meta>`,
        },
      }),
    );

    expect(metadata.authors).toEqual(['Solo Editor']);
  });

  it('advierte si faltan título o idioma, sin fallar', async () => {
    const epub = await buildEpub({ chapters, metadata: { title: '', language: '' } });
    const { metadata, warnings } = await openEpub(epub);

    expect(metadata.title).toBeNull();
    expect(metadata.language).toBeNull();
    expect(warnings.map((w) => w.code)).toEqual(['TITLE_MISSING', 'LANGUAGE_MISSING']);
  });
});

describe('openEpub: manifest y spine', () => {
  it('resuelve rutas en subdirectorios y con caracteres escapados', async () => {
    const { package: pkg } = await openEpub(
      await buildEpub({
        chapters: [
          { id: 'cap1', href: 'Text/Cap%C3%ADtulo%201.xhtml', title: 'Uno', body: '<p>x</p>' },
        ],
      }),
    );

    expect(pkg.spine[0]?.item.path).toBe('OEBPS/Text/Capítulo 1.xhtml');
  });

  it('funciona con el OPF en la raíz del contenedor', async () => {
    const { package: pkg } = await openEpub(await buildEpub({ chapters, opfDir: '' }));

    expect(pkg.path).toBe('content.opf');
    expect(pkg.spine.map((s) => s.item.path)).toEqual(['cap1.xhtml', 'cap2.xhtml']);
  });

  it('respeta linear="no"', async () => {
    const { package: pkg } = await openEpub(
      await buildEpub({
        chapters: [...chapters, { id: 'notas', title: 'Notas', body: '<p>1.</p>', linear: false }],
      }),
    );

    expect(pkg.spine.map((s) => [s.idref, s.linear])).toEqual([
      ['cap1', true],
      ['cap2', true],
      ['notas', false],
    ]);
  });

  it('identifica nav (EPUB 3) y NCX', async () => {
    const epub3 = await openEpub(await buildEpub({ chapters }));
    const epub2 = await openEpub(await buildEpub({ version: 2, chapters }));

    expect(epub3.package.version).toBe(3);
    expect(epub3.package.navItem?.path).toBe('OEBPS/nav.xhtml');
    expect(epub3.package.ncxItem?.path).toBe('OEBPS/toc.ncx');
    expect(epub2.package.version).toBe(2);
    expect(epub2.package.navItem).toBeNull();
    expect(epub2.package.ncxItem?.path).toBe('OEBPS/toc.ncx');
  });

  it('descarta del spine los items inexistentes, con warning', async () => {
    const epub = await buildEpub({
      chapters,
      extraManifestItems:
        '<item id="fantasma" href="no-existe.xhtml" media-type="application/xhtml+xml"/>',
    });
    // Se agrega el itemref a mano: el helper solo genera itemrefs de capítulos reales.
    const patched = await rewriteOpf(epub, (opf) =>
      opf.replace(
        '</spine>',
        '<itemref idref="fantasma"/><itemref idref="ni-en-manifest"/></spine>',
      ),
    );
    const { package: pkg, warnings } = await openEpub(patched);

    expect(pkg.spine.map((s) => s.idref)).toEqual(['cap1', 'cap2']);
    expect(warnings.map((w) => w.code)).toEqual([
      'MANIFEST_ITEM_MISSING',
      'SPINE_ITEM_UNRESOLVED',
      'SPINE_ITEM_UNRESOLVED',
    ]);
  });
});

describe('openEpub: errores y advertencias del contenedor', () => {
  it('advierte si el mimetype es incorrecto o falta, pero abre el libro', async () => {
    const wrong = await openEpub(await buildEpub({ chapters, mimetype: 'application/zip' }));
    const missing = await openEpub(await buildEpub({ chapters, mimetype: null }));

    expect(wrong.warnings.map((w) => w.code)).toEqual(['MIMETYPE_INVALID']);
    expect(missing.warnings.map((w) => w.code)).toEqual(['MIMETYPE_INVALID']);
  });

  it('advierte si el mimetype no es la primera entrada', async () => {
    const zip = await buildZip({
      'META-INF/container.xml': containerFor('content.opf'),
      mimetype: 'application/epub+zip',
      'content.opf': minimalOpf,
      'cap1.xhtml': '<html><body><p>x</p></body></html>',
    });

    expect((await openEpub(zip)).warnings.map((w) => w.code)).toEqual(['MIMETYPE_NOT_FIRST']);
  });

  it('falla con MISSING_PACKAGE si falta container.xml', async () => {
    await expect(
      openEpub(await buildEpub({ chapters, omitContainer: true })),
    ).rejects.toMatchObject({
      code: 'MISSING_PACKAGE',
    });
  });

  it('falla con MISSING_PACKAGE si el OPF declarado no existe', async () => {
    const zip = await buildZip({
      mimetype: 'application/epub+zip',
      'META-INF/container.xml': containerFor('OEBPS/no-existe.opf'),
    });

    await expect(openEpub(zip)).rejects.toMatchObject({
      code: 'MISSING_PACKAGE',
      details: { path: 'OEBPS/no-existe.opf' },
    });
  });

  it('falla con MISSING_PACKAGE si el OPF no tiene <package>', async () => {
    const epub = await rewriteOpf(await buildEpub({ chapters }), () => '<otra-cosa/>');

    await expect(openEpub(epub)).rejects.toMatchObject({ code: 'MISSING_PACKAGE' });
  });

  it('falla con NO_TEXT_CONTENT si el spine está vacío', async () => {
    await expect(openEpub(await buildEpub({ chapters: [] }))).rejects.toMatchObject({
      code: 'NO_TEXT_CONTENT',
    });
  });

  it('rechaza XML con expansión de entidades abusiva ("billion laughs")', async () => {
    const lol = `<?xml version="1.0"?>
<!DOCTYPE package [
  <!ENTITY a "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa">
  <!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">
  <!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;">
  <!ENTITY d "&c;&c;&c;&c;&c;&c;&c;&c;&c;&c;&c;&c;&c;&c;&c;&c;&c;&c;&c;&c;">
]>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>&d;</dc:title></metadata>
  <manifest><item id="c" href="cap1.xhtml" media-type="application/xhtml+xml"/></manifest>
  <spine><itemref idref="c"/></spine>
</package>`;
    const epub = await rewriteOpf(await buildEpub({ chapters }), () => lol);

    // Lo importante: no expande 8 millones de caracteres ni cuelga el proceso.
    const result = await openEpub(epub).then(
      (opened) => opened.metadata.title?.length ?? 0,
      () => 0,
    );
    expect(result).toBeLessThan(100_000);
  });
});

const minimalOpf = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>T</dc:title><dc:language>es</dc:language>
  </metadata>
  <manifest><item id="c" href="cap1.xhtml" media-type="application/xhtml+xml"/></manifest>
  <spine><itemref idref="c"/></spine>
</package>`;

function containerFor(opfPath: string): string {
  return `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="${opfPath}" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;
}

/** Reescribe el OPF de un EPUB generado, para casos que el helper no produce directamente. */
async function rewriteOpf(epub: Buffer, transform: (opf: string) => string): Promise<Buffer> {
  const { readZip } = await import('../../helpers/read-zip.js');
  const files = Object.fromEntries(
    (await readZip(epub)).map((e) => [
      e.path,
      e.path === 'OEBPS/content.opf' ? transform(e.content) : e.data,
    ]),
  );
  return buildZip(files);
}
