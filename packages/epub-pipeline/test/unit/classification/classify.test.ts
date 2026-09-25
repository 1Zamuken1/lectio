import { describe, expect, it } from 'vitest';
import { openEpub, readStructure } from '../../../src/index.js';
import {
  buildEpub,
  type BuildEpubChapter,
  type BuildEpubOptions,
} from '../../helpers/build-epub.js';

/** Capítulo "de cuerpo": supera el mínimo de tamaño del cuerpo del libro (2000). */
const core = (id: string, title = id): BuildEpubChapter => ({
  id,
  title,
  body: `<h1>${title}</h1><p>${'Texto narrativo. '.repeat(160)}</p>`,
});

async function classify(options: BuildEpubOptions) {
  const { sections } = readStructure(await openEpub(await buildEpub(options)));
  return sections.map((s) => ({
    title: s.title,
    kind: s.kind,
    signal: s.classification.signal,
    confidence: s.classification.confidence,
  }));
}

const kindOf = (result: Awaited<ReturnType<typeof classify>>, title: string) =>
  result.find((s) => s.title === title)?.kind;

describe('clasificación: señales semánticas', () => {
  it('epub:type específico en el contenedor de la sección', async () => {
    const result = await classify({
      chapters: [
        {
          id: 'tp',
          title: 'Portada',
          body: '<section epub:type="titlepage"><h1>Mi libro</h1></section>',
        },
        core('cap1'),
        {
          id: 'fin',
          title: 'Fin',
          body: '<section epub:type="colophon"><p>Compuesto en Garamond.</p></section>',
        },
      ],
    });

    expect(result[0]).toMatchObject({
      kind: 'front_matter',
      signal: 'semantic',
      confidence: 'high',
    });
    expect(kindOf(result, 'cap1')).toBe('narrative');
    // El colofón depende de la posición: al final es back matter.
    expect(kindOf(result, 'Fin')).toBe('back_matter');
  });

  it('epub:type del <body> y roles ARIA doc-*', async () => {
    const result = await classify({
      chapters: [
        core('cap1'),
        {
          id: 'n',
          title: 'Anotaciones',
          body: '<p>1. Una nota.</p>',
          bodyAttributes: 'epub:type="endnotes"',
        },
        {
          id: 'g',
          title: 'Voces',
          body: '<div role="doc-glossary"><p>Término: definición.</p></div>',
        },
      ],
    });

    expect(kindOf(result, 'Anotaciones')).toBe('notes');
    expect(kindOf(result, 'Voces')).toBe('back_matter');
  });

  it('un tipo específico gana al título ("Índice" marcado como capítulo es narrativa)', async () => {
    const result = await classify({
      chapters: [
        core('cap1'),
        {
          id: 'i',
          title: 'Índice',
          body: '<section epub:type="chapter"><p>Un capítulo llamado así.</p></section>',
        },
      ],
    });

    expect(kindOf(result, 'Índice')).toBe('narrative');
  });

  it('un tipo genérico gana al título ("Notas" en bodymatter es narrativa)', async () => {
    const result = await classify({
      chapters: [
        core('cap1'),
        {
          id: 'n',
          title: 'Notas',
          body: '<p>Notas de un viaje.</p>',
          bodyAttributes: 'epub:type="bodymatter"',
        },
      ],
    });

    expect(kindOf(result, 'Notas')).toBe('narrative');
  });

  it('la portadilla fusionada no oculta el primer capítulo del grupo', async () => {
    const result = await classify({
      chapters: [
        {
          id: 'ht',
          title: 'Mi libro',
          body: '<section epub:type="halftitlepage"><h2>Mi libro</h2></section>',
        },
        { ...core('cap1', 'I'), body: `<section epub:type="chapter">${core('x').body}</section>` },
        { ...core('cap2', 'II'), body: `<section epub:type="chapter">${core('y').body}</section>` },
      ],
      toc: [
        {
          title: 'Mi libro',
          href: 'ht.xhtml',
          children: [
            { title: 'I', href: 'cap1.xhtml' },
            { title: 'II', href: 'cap2.xhtml' },
          ],
        },
      ],
    });

    expect(result.map((s) => [s.title, s.kind])).toEqual([
      ['I', 'narrative'],
      ['II', 'narrative'],
    ]);
  });
});

describe('clasificación: landmarks', () => {
  it('un landmark tipado que apunta a la sección la clasifica', async () => {
    const result = await classify({
      chapters: [
        core('cap1'),
        { id: 'ded', title: 'Para Ana', body: '<p>Para Ana, siempre.</p>' },
        core('cap2'),
      ],
      navigation: 'nav',
      extraFiles: {
        'OEBPS/nav.xhtml': `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body>
          <nav epub:type="toc"><ol><li><a href="cap1.xhtml">cap1</a></li><li><a href="ded.xhtml">Para Ana</a></li><li><a href="cap2.xhtml">cap2</a></li></ol></nav>
          <nav epub:type="landmarks"><ol><li><a epub:type="dedication" href="ded.xhtml">Dedicatoria</a></li></ol></nav>
        </body></html>`,
      },
    });

    expect(result.find((s) => s.title === 'Para Ana')).toMatchObject({
      kind: 'front_matter',
      signal: 'landmark',
    });
  });

  it('lo corto antes del landmark bodymatter es front matter', async () => {
    const result = await classify({
      chapters: [
        { id: 'a', title: 'Advertencia', body: `<p>${'Nota editorial. '.repeat(40)}</p>` },
        core('cap1'),
        core('cap2'),
      ],
      navigation: 'nav',
      extraFiles: {
        'OEBPS/nav.xhtml': `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body>
          <nav epub:type="toc"><ol><li><a href="a.xhtml">Advertencia</a></li><li><a href="cap1.xhtml">cap1</a></li><li><a href="cap2.xhtml">cap2</a></li></ol></nav>
          <nav epub:type="landmarks"><ol><li><a epub:type="bodymatter" href="cap1.xhtml">Inicio</a></li></ol></nav>
        </body></html>`,
      },
    });

    expect(result[0]).toMatchObject({ kind: 'front_matter', confidence: 'low' });
  });
});

describe('clasificación: títulos', () => {
  it.each([
    ['Dedicatoria', 'front_matter'],
    ['Agradecimientos', 'front_matter'],
    ['Notas', 'notes'],
    ['The Project Gutenberg eBook of Marianela', 'front_matter'],
  ])('"%s" al principio → %s', async (title, kind) => {
    const result = await classify({
      chapters: [{ id: 'x', title, body: '<p>Contenido breve.</p>' }, core('cap1'), core('cap2')],
    });

    expect(kindOf(result, title)).toBe(kind);
  });

  it.each([
    ['Índice', 'back_matter'],
    ['Colofón', 'back_matter'],
    ['Sobre el autor', 'back_matter'],
    ['THE FULL PROJECT GUTENBERG™ LICENSE', 'back_matter'],
  ])('"%s" al final → %s', async (title, kind) => {
    const result = await classify({
      chapters: [
        core('cap1'),
        core('cap2'),
        { id: 'x', title, body: `<p>${'Texto largo. '.repeat(300)}</p>` },
      ],
    });

    expect(kindOf(result, title)).toBe(kind);
  });

  it('el índice depende de su posición: al principio es front matter', async () => {
    const result = await classify({
      chapters: [
        { id: 'i', title: 'Índice', body: '<p>Capítulos.</p>' },
        core('cap1'),
        core('cap2'),
      ],
    });

    expect(kindOf(result, 'Índice')).toBe('front_matter');
  });
});

describe('clasificación: heurísticas', () => {
  it('una sección con casi todo el texto en enlaces es un índice', async () => {
    const links = Array.from(
      { length: 12 },
      (_, i) => `<p><a href="cap${i}.xhtml">Capítulo ${i}. De lo que sucedió</a></p>`,
    );
    const result = await classify({
      chapters: [
        { id: 'toc', title: 'por el autor', body: links.join('') },
        core('cap1'),
        core('cap2'),
      ],
    });

    expect(result[0]).toMatchObject({
      kind: 'front_matter',
      signal: 'heuristic',
      confidence: 'low',
    });
  });

  it('bloques numerados con aspecto de notas', async () => {
    const notes = Array.from(
      { length: 5 },
      (_, i) => `<p>${i + 1}. Referencia a la página ${i * 7}.</p>`,
    );
    const result = await classify({
      chapters: [core('cap1'), { id: 'n', title: 'Al margen', body: notes.join('') }],
    });

    expect(kindOf(result, 'Al margen')).toBe('notes');
  });

  it('aviso legal corto antes del cuerpo', async () => {
    const result = await classify({
      chapters: [
        {
          id: 'c',
          title: 'Mi libro',
          body: '<p>© 2024 Editorial Ejemplo. Todos los derechos reservados. ISBN 978-0-00.</p>',
        },
        core('cap1'),
      ],
    });

    expect(result[0]).toMatchObject({ kind: 'front_matter', signal: 'heuristic' });
  });

  it('secciones cortas fuera del cuerpo son material auxiliar; en medio, narrativa (conservador)', async () => {
    const result = await classify({
      chapters: [
        { id: 'a', title: 'Antes', body: '<p>Breve.</p>' },
        core('cap1'),
        { id: 'm', title: 'Interludio', body: '<p>Un capítulo muy corto.</p>' },
        core('cap2'),
        { id: 'z', title: 'Después', body: '<p>Breve.</p>' },
      ],
    });

    expect(result.map((s) => [s.title, s.kind])).toEqual([
      ['Antes', 'front_matter'],
      ['cap1', 'narrative'],
      ['Interludio', 'narrative'],
      ['cap2', 'narrative'],
      ['Después', 'back_matter'],
    ]);
  });

  it('sin señales, una sección se considera narrativa', async () => {
    const result = await classify({ chapters: [core('cap1')] });

    expect(result[0]).toMatchObject({ kind: 'narrative', signal: 'default' });
  });
});

describe('segmentación de zonas sin índice', () => {
  it('antes de la primera entrada, cada documento es una sección aparte', async () => {
    const result = await classify({
      chapters: [
        { id: 'portada', title: 'Portada', body: '<h1>Mi libro</h1>', inToc: false },
        { id: 'legal', title: 'Créditos', body: '<p>© 2024 Editorial.</p>', inToc: false },
        core('cap1'),
      ],
    });

    expect(result.map((s) => s.title)).toEqual(['Mi libro', 'Créditos', 'cap1']);
  });
});
