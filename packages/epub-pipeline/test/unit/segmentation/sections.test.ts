import { describe, expect, it } from 'vitest';
import { openEpub, readStructure, type SegmentationOptions } from '../../../src/index.js';
import { buildEpub, type BuildEpubOptions } from '../../helpers/build-epub.js';

async function structureOf(
  options: BuildEpubOptions,
  segmentation: Partial<SegmentationOptions> = {},
) {
  const structure = readStructure(await openEpub(await buildEpub(options)), segmentation);
  const summary = structure.sections.map((s) => ({
    title: s.title,
    ancestors: s.ancestors,
    origin: s.origin,
    text: blockText(s.content),
  }));
  return { ...structure, summary, warnings: structure.warnings.map((w) => w.code) };
}

/** Texto de cada nodo de texto unido por espacios (textContent pegaría "Nota" y "suelta"). */
function blockText(root: Node): string {
  const parts: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === 3) parts.push(node.textContent ?? '');
    node.childNodes.forEach(walk);
  };
  walk(root);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/** Párrafo de n caracteres aprox., para controlar los umbrales de tamaño. */
const filler = (label: string, chars: number) =>
  `<p>${label} ${'x'.repeat(Math.max(0, chars - label.length - 1))}</p>`;

describe('segmentación: cortes', () => {
  it('varios capítulos en un mismo archivo, cortados por fragmento', async () => {
    const { summary } = await structureOf({
      chapters: [
        {
          id: 'libro',
          title: 'Libro',
          body: '<h2 id="c1">I</h2><p>uno</p><h2 id="c2">II</h2><p>dos</p><h2 id="c3">III</h2><p>tres</p>',
        },
      ],
      toc: [
        { title: 'Capítulo I', href: 'libro.xhtml#c1' },
        { title: 'Capítulo II', href: 'libro.xhtml#c2' },
        { title: 'Capítulo III', href: 'libro.xhtml#c3' },
      ],
    });

    expect(summary.map((s) => [s.title, s.text])).toEqual([
      ['Capítulo I', 'I uno'],
      ['Capítulo II', 'II dos'],
      ['Capítulo III', 'III tres'],
    ]);
  });

  it('un capítulo repartido en varios archivos (divisiones de Calibre)', async () => {
    const { summary, sections } = await structureOf({
      chapters: [
        { id: 'cap1_split_000', title: 'Uno', body: '<h1>Uno</h1><p>primera mitad</p>' },
        { id: 'cap1_split_001', title: 'Uno', body: '<p>segunda mitad</p>', inToc: false },
        { id: 'cap2', title: 'Dos', body: '<h1>Dos</h1><p>otro</p>' },
      ],
    });

    expect(summary.map((s) => [s.title, s.text])).toEqual([
      ['Uno', 'Uno primera mitad segunda mitad'],
      ['Dos', 'Dos otro'],
    ]);
    expect(sections[0]?.documents).toEqual([
      'OEBPS/cap1_split_000.xhtml',
      'OEBPS/cap1_split_001.xhtml',
    ]);
  });

  it('el contenido previo a la primera entrada forma una sección inicial', async () => {
    const { summary } = await structureOf({
      chapters: [
        {
          id: 'aviso',
          title: 'Aviso',
          body: '<h1>Aviso legal</h1><p>Texto del aviso.</p>',
          inToc: false,
        },
        { id: 'cap1', title: 'Uno', body: '<p>Capítulo.</p>' },
      ],
    });

    expect(summary.map((s) => [s.origin, s.title])).toEqual([
      ['leading', 'Aviso legal'],
      ['toc', 'Uno'],
    ]);
  });

  it('un documento linear="no" queda aislado y no se mezcla con el capítulo anterior', async () => {
    const { summary, sections } = await structureOf({
      chapters: [
        { id: 'cap1', title: 'Uno', body: '<p>uno</p>' },
        {
          id: 'nota',
          title: 'Nota',
          body: '<h1>Nota suelta</h1><p>nota</p>',
          linear: false,
          inToc: false,
        },
        { id: 'cap1b', title: 'Uno (cont.)', body: '<p>continúa</p>', inToc: false },
        { id: 'cap2', title: 'Dos', body: '<p>dos</p>' },
      ],
    });

    expect(summary.map((s) => [s.origin, s.text])).toEqual([
      ['toc', 'uno'],
      ['non-linear', 'Nota suelta nota'],
      ['spine', 'continúa'],
      ['toc', 'dos'],
    ]);
    expect(sections[1]?.linear).toBe(false);
  });

  it('sin índice: una sección por documento, titulada por su primer encabezado', async () => {
    const { summary } = await structureOf({
      navigation: 'none',
      chapters: [
        { id: 'a', title: 'ignorado', body: '<h2>El comienzo</h2><p>a</p>' },
        { id: 'b', title: 'Título del documento', body: '<p>sin encabezado</p>' },
      ],
    });

    expect(summary.map((s) => [s.origin, s.title])).toEqual([
      ['spine', 'El comienzo'],
      ['spine', 'Título del documento'],
    ]);
  });

  it('ordena por posición real si el índice viene desordenado, con warning', async () => {
    const { summary, warnings } = await structureOf({
      chapters: [
        { id: 'cap1', title: 'Uno', body: '<p>uno</p>' },
        { id: 'cap2', title: 'Dos', body: '<p>dos</p>' },
      ],
      toc: [
        { title: 'Dos', href: 'cap2.xhtml' },
        { title: 'Uno', href: 'cap1.xhtml' },
      ],
    });

    expect(summary.map((s) => s.title)).toEqual(['Uno', 'Dos']);
    expect(warnings).toContain('TOC_ORDER_MISMATCH');
  });

  it('fragmento inexistente: usa el inicio del documento, con warning', async () => {
    const { summary, warnings } = await structureOf({
      chapters: [
        { id: 'cap1', title: 'Uno', body: '<p>uno</p>' },
        { id: 'cap2', title: 'Dos', body: '<p>dos</p>' },
      ],
      toc: [
        { title: 'Uno', href: 'cap1.xhtml' },
        { title: 'Dos', href: 'cap2.xhtml#no-existe' },
      ],
    });

    expect(summary.map((s) => [s.title, s.text])).toEqual([
      ['Uno', 'uno'],
      ['Dos', 'dos'],
    ]);
    expect(warnings).toContain('TOC_FRAGMENT_MISSING');
  });

  it('entradas a documentos inexistentes o duplicadas se descartan, con warning', async () => {
    const { summary, warnings } = await structureOf({
      chapters: [
        { id: 'cap1', title: 'Uno', body: '<p>uno</p>' },
        { id: 'cap2', title: 'Dos', body: '<p>dos</p>' },
      ],
      toc: [
        { title: 'Uno', href: 'cap1.xhtml' },
        { title: 'Uno otra vez', href: 'cap1.xhtml' },
        { title: 'Fantasma', href: 'fantasma.xhtml' },
        { title: 'Dos', href: 'cap2.xhtml' },
      ],
    });

    expect(summary.map((s) => s.title)).toEqual(['Uno', 'Dos']);
    expect(warnings).toEqual(
      expect.arrayContaining(['TOC_DUPLICATE_TARGET', 'TOC_ENTRY_UNRESOLVED']),
    );
  });

  it('falla con NO_TEXT_CONTENT si ningún documento tiene texto', async () => {
    await expect(
      structureOf({ chapters: [{ id: 'vacio', title: 'Vacío', body: '<div></div>' }] }),
    ).rejects.toMatchObject({ code: 'NO_TEXT_CONTENT' });
  });
});

describe('segmentación: granularidad (aplanado del índice)', () => {
  const options = { minChapterChars: 1000, maxDepth: 2, minGroupIntroChars: 100 };

  it('divide un nodo en sus hijos si estos son lo bastante largos; la portadilla corta se fusiona', async () => {
    const { summary } = await structureOf(
      {
        chapters: [
          {
            id: 'cuento',
            title: 'Cuento',
            body: `<h1 id="t">Un escándalo</h1><h2 id="i">I</h2>${filler('uno', 1500)}<h2 id="ii">II</h2>${filler('dos', 1500)}`,
          },
          { id: 'otro', title: 'Otro', body: filler('otro cuento', 3000) },
        ],
        toc: [
          {
            title: 'Un escándalo',
            href: 'cuento.xhtml#t',
            children: [
              { title: 'I', href: 'cuento.xhtml#i' },
              { title: 'II', href: 'cuento.xhtml#ii' },
            ],
          },
          { title: 'Otro cuento', href: 'otro.xhtml' },
        ],
      },
      options,
    );

    expect(summary.map((s) => [s.ancestors.join(' › '), s.title])).toEqual([
      ['Un escándalo', 'I'],
      ['Un escándalo', 'II'],
      ['', 'Otro cuento'],
    ]);
    // El encabezado del grupo no se pierde: queda al inicio del primer hijo.
    expect(summary[0]?.text.startsWith('Un escándalo I uno')).toBe(true);
  });

  it('una introducción larga del grupo forma su propia sección', async () => {
    const { summary } = await structureOf(
      {
        chapters: [
          {
            id: 'parte',
            title: 'Parte',
            body: `<h1 id="p">Parte I</h1>${filler('intro', 500)}<h2 id="a">A</h2>${filler('a', 1500)}<h2 id="b">B</h2>${filler('b', 1500)}`,
          },
        ],
        toc: [
          {
            title: 'Parte I',
            href: 'parte.xhtml#p',
            children: [
              { title: 'A', href: 'parte.xhtml#a' },
              { title: 'B', href: 'parte.xhtml#b' },
            ],
          },
        ],
      },
      options,
    );

    expect(summary.map((s) => [s.ancestors.join(' › '), s.title])).toEqual([
      ['', 'Parte I'],
      ['Parte I', 'A'],
      ['Parte I', 'B'],
    ]);
  });

  it('no divide si los hijos son cortos (ej. poemas): el grupo queda como un capítulo', async () => {
    const poems = Array.from(
      { length: 10 },
      (_, i) => `<h3 id="r${i}">Rima ${i}</h3>${filler(`verso ${i}`, 200)}`,
    );
    const { summary } = await structureOf(
      {
        chapters: [{ id: 'rimas', title: 'Rimas', body: `<h1 id="t">Rimas</h1>${poems.join('')}` }],
        toc: [
          {
            title: 'Rimas',
            href: 'rimas.xhtml#t',
            children: poems.map((_, i) => ({ title: `Rima ${i}`, href: `rimas.xhtml#r${i}` })),
          },
        ],
      },
      options,
    );

    expect(summary.map((s) => s.title)).toEqual(['Rimas']);
    expect(summary[0]?.text).toContain('verso 9');
  });

  it('respeta la profundidad máxima', async () => {
    const deep = {
      title: 'Nivel 1',
      href: 'libro.xhtml#n1',
      children: [
        {
          title: 'Nivel 2',
          href: 'libro.xhtml#n2',
          children: [
            { title: 'Nivel 3a', href: 'libro.xhtml#n3a' },
            { title: 'Nivel 3b', href: 'libro.xhtml#n3b' },
          ],
        },
        { title: 'Nivel 2b', href: 'libro.xhtml#n2b' },
      ],
    };
    const body = ['n1', 'n2', 'n3a', 'n3b', 'n2b']
      .map((id) => `<h2 id="${id}">${id}</h2>${filler(id, 1500)}`)
      .join('');
    const { summary } = await structureOf(
      { chapters: [{ id: 'libro', title: 'Libro', body }], toc: [deep] },
      options,
    );

    expect(summary.map((s) => s.title)).toEqual(['Nivel 1', 'Nivel 2', 'Nivel 2b']);
  });

  it('un grupo sin enlace propio (<span>) pasa su título como ancestro', async () => {
    const { summary } = await structureOf(
      {
        chapters: [
          { id: 'a', title: 'A', body: filler('a', 1500) },
          { id: 'b', title: 'B', body: filler('b', 1500) },
        ],
        navigation: 'nav',
        extraFiles: {
          'OEBPS/nav.xhtml': `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
            <body><nav epub:type="toc"><ol><li><span>Primera parte</span><ol>
              <li><a href="a.xhtml">A</a></li><li><a href="b.xhtml">B</a></li>
            </ol></li></ol></nav></body></html>`,
        },
      },
      options,
    );

    expect(summary.map((s) => [s.ancestors.join(' › '), s.title])).toEqual([
      ['Primera parte', 'A'],
      ['Primera parte', 'B'],
    ]);
  });
});
