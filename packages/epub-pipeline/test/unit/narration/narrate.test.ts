import { describe, expect, it } from 'vitest';
import {
  cleanSections,
  narrateSections,
  openEpub,
  readStructure,
  type NarrationOptions,
} from '../../../src/index.js';
import { announcementFor, normalizeTitle } from '../../../src/narration/normalize.js';
import { buildEpub, type BuildEpubOptions } from '../../helpers/build-epub.js';

async function narrate(options: BuildEpubOptions, narration: Partial<NarrationOptions> = {}) {
  const opened = await openEpub(await buildEpub(options));
  const cleaned = cleanSections(readStructure(opened), opened.archive).sections;
  return narrateSections(cleaned, opened.metadata.language ?? 'es', narration).sections;
}

/** Narración de un único capítulo, sin el anuncio del título. */
async function narrationOf(body: string, narration: Partial<NarrationOptions> = {}) {
  const [section] = await narrate({ chapters: [{ id: 'c', title: 'Cap', body }] }, narration);
  return section!.sentences.filter((s) => s.blockIndex >= 0).map((s) => s.narration);
}

describe('etapa 8: limpieza de narración', () => {
  it('N1: la llamada a nota no se narra, pero sigue en el texto', async () => {
    const [section] = await narrate({
      chapters: [
        {
          id: 'c',
          title: 'Cap',
          body: '<p>Uno de los mejores hombres,<a epub:type="noteref" href="#n">2</a> cuyas cenizas.</p><aside epub:type="footnote" id="n"><p>Nota.</p></aside>',
        },
      ],
    });
    const sentence = section!.sentences.find((s) => s.blockIndex === 0)!;

    expect(sentence.text).toBe('Uno de los mejores hombres,2 cuyas cenizas.');
    expect(sentence.narration).toBe('Uno de los mejores hombres, cuyas cenizas.');
    expect(section!.narrationStats.N1_noterefs).toBe(1);
  });

  it('N2 y N3: DOIs, URLs y correos; una oración que era solo eso queda vacía', async () => {
    expect(
      await narrationOf(
        '<p>Ver el estudio doi:10.1234/abc.567 publicado. Más en https://example.com/x o en autor@example.com.</p><p>https://example.com</p>',
      ),
    ).toEqual(['Ver el estudio publicado.', 'Más en o en.', '']);
  });

  it('N4: elimina citas con indicio fuerte, conserva paréntesis narrativos', async () => {
    expect(
      await narrationOf(
        '<p>Como se ha mostrado (García et al., 2021, p. 112), el efecto existe.</p>' +
          '<p>Otros lo confirman (Smith &amp; Jones, 2019a; Pérez, 2020).</p>' +
          '<p>Llegó a la corte (Madrid, 1605) sin avisar.</p>' +
          '<p>Leyó la novela (1984) de un tirón.</p>',
      ),
    ).toEqual([
      'Como se ha mostrado, el efecto existe.',
      'Otros lo confirman.',
      'Llegó a la corte (Madrid, 1605) sin avisar.',
      'Leyó la novela (1984) de un tirón.',
    ]);
  });

  it('N5: oraciones que son solo un ISBN o un aviso legal', async () => {
    expect(
      await narrationOf(
        '<p>ISBN 978-84-376-0494-7</p><p>© 2020 Editorial Ejemplo.</p><p>Todos los derechos reservados.</p><p>El © aparece en el libro.</p>',
      ),
    ).toEqual(['', '', '', 'El © aparece en el libro.']);
  });

  it('cada regla se puede desactivar', async () => {
    expect(await narrationOf('<p>Ver https://example.com ahora.</p>', { urls: false })).toEqual([
      'Ver https://example.com ahora.',
    ]);
  });
});

describe('etapa 9: normalización', () => {
  it('quita guiones blandos y caracteres invisibles', async () => {
    expect(await narrationOf('<p>Con\u00ADver\u00ADsa\u200Bción.</p>')).toEqual(['Conversación.']);
  });

  it('une la división silábica solo si la palabra existe en el libro', async () => {
    expect(
      await narrationOf(
        '<p>Tuvimos una conversación larga.</p><p>Otra conver- sación y un bien- estar.</p>',
      ),
    ).toEqual(['Tuvimos una conversación larga.', 'Otra conversación y un bien- estar.']);
  });

  it('una oración sin letras ni cifras no se narra', async () => {
    expect(await narrationOf('<p>Texto.</p><p>* * *</p><p>Más.</p>')).toEqual([
      'Texto.',
      '',
      'Más.',
    ]);
  });

  it('las celdas de tabla y el código no se narran', async () => {
    expect(
      await narrationOf(
        '<p>Datos:</p><table><tr><td>Uno</td><td>Dos</td></tr></table><pre>x = 1;</pre>',
      ),
    ).toEqual(['Datos:', '', '', '']);
  });

  it('los versos separados por <br> no pegan sus palabras', async () => {
    expect(
      await narrationOf('<div>Volverán las oscuras golondrinas<br/>en tu balcón sus nidos</div>'),
    ).toEqual(['Volverán las oscuras golondrinas en tu balcón sus nidos']);
  });
});

describe('anuncio del capítulo', () => {
  it.each([
    ['Capítulo IV. El regreso', 'Capítulo 4. El regreso'],
    ['CAPÍTULO LXXIV. DE CÓMO CAYÓ MALO', 'Capítulo 74. De cómo cayó malo'],
    ['-XXI- Los ojos matan', '21. Los ojos matan'],
    ['V. WHAT THE THUNDER SAID', '5. What the thunder said'],
    ['II', '2'],
    ['Luis XIV y su corte', 'Luis XIV y su corte'],
    ['I Remember', 'I Remember'],
    ['Lo que di', 'Lo que di'],
  ])('normaliza "%s" → "%s"', (title, expected) => {
    expect(normalizeTitle(title)).toBe(expected);
  });

  it('antepone la parte y cierra con punto', () => {
    expect(announcementFor('Capítulo I', 'Segunda parte')).toBe('Segunda parte. Capítulo 1.');
  });

  it('el encabezado que repite el título se convierte en el anuncio', async () => {
    const [section] = await narrate({
      chapters: [{ id: 'c', title: 'Capítulo I', body: '<h2>CAPÍTULO I</h2><p>Texto.</p>' }],
    });

    expect(section!.sentences.map((s) => [s.blockIndex, s.narration])).toEqual([
      [0, 'Capítulo 1.'],
      [1, 'Texto.'],
    ]);
  });

  it('sin encabezado, se agrega un anuncio sintético sin bloque', async () => {
    const [section] = await narrate({
      chapters: [{ id: 'c', title: 'El viaje', body: '<p>Texto.</p>' }],
    });

    expect(section!.sentences[0]).toMatchObject({
      index: 0,
      blockIndex: -1,
      text: '',
      narration: 'El viaje.',
    });
    expect(section!.sentences[1]).toMatchObject({ index: 1, blockIndex: 0 });
  });

  it('atraviesa el subtítulo corto de una portadilla para silenciar el encabezado repetido', async () => {
    const [section] = await narrate({
      chapters: [
        {
          id: 'c',
          title: 'I',
          body: `<h2 id="t">Mi libro</h2><p>Con apuntes sobre otros temas</p><h2 id="i">I</h2><p>${'Texto del capítulo. '.repeat(120)}</p>`,
        },
      ],
      toc: [
        { title: 'Mi libro', href: 'c.xhtml#t', children: [{ title: 'I', href: 'c.xhtml#i' }] },
      ],
    });

    expect(section!.title).toBe('I');
    expect(section!.sentences.slice(0, 4).map((s) => s.narration)).toEqual([
      'Mi libro. 1.',
      'Con apuntes sobre otros temas',
      '',
      'Texto del capítulo.',
    ]);
  });

  it('silencia los encabezados que repiten título o parte, y narra los demás', async () => {
    const long = `<p>${'Texto. '.repeat(400)}</p>`;
    const sections = await narrate({
      chapters: [
        { id: 'ht', title: 'Un escándalo', body: '<h1>Un escándalo</h1>' },
        { id: 'c1', title: 'I', body: `<h2>I</h2><h3>Donde todo empieza</h3>${long}` },
        { id: 'c2', title: 'II', body: `<h2>II</h2>${long}` },
      ],
      toc: [
        {
          title: 'Un escándalo',
          href: 'ht.xhtml',
          children: [
            { title: 'I', href: 'c1.xhtml' },
            { title: 'II', href: 'c2.xhtml' },
          ],
        },
      ],
    });

    expect(sections[0]!.sentences.slice(0, 3).map((s) => s.narration)).toEqual([
      'Un escándalo. 1.',
      '',
      'Donde todo empieza',
    ]);
    // La parte solo se anuncia en su primer capítulo.
    expect(sections[1]!.sentences[0]!.narration).toBe('2.');
  });
});
