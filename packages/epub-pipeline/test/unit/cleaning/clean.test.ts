import { describe, expect, it } from 'vitest';
import { cleanSections, openEpub, readStructure } from '../../../src/index.js';
import { buildEpub, type BuildEpubOptions } from '../../helpers/build-epub.js';

async function clean(options: BuildEpubOptions) {
  const opened = await openEpub(await buildEpub(options));
  return cleanSections(readStructure(opened), opened.archive).sections;
}

async function htmlOf(body: string, extra: Partial<BuildEpubOptions> = {}) {
  const [section] = await clean({ chapters: [{ id: 'cap', title: 'Cap', body }], ...extra });
  return section!.contentHtml;
}

describe('S1: números de página y de verso', () => {
  it('elimina marcadores semánticos (epub:type="pagebreak", role="doc-pagebreak")', async () => {
    const html = await htmlOf(
      '<p>Uno<span epub:type="pagebreak" id="p5" title="5"/> dos<span role="doc-pagebreak">6</span> tres.</p>',
    );

    expect(html).toBe('<p data-b="0">Uno dos tres.</p>');
  });

  it('elimina los marcadores de Gutenberg aunque partan una palabra', async () => {
    const html = await htmlOf(
      '<p>ca<span class="x-ebookmaker-pageno" id="Page_10" title="[p. 10]"></span>lle y <span class="pagenum">[Pg 11]</span>más.</p>',
    );

    expect(html).toBe('<p data-b="0">calle y más.</p>');
  });

  it('elimina números de verso', async () => {
    const html = await htmlOf('<div>Out of this stony rubbish?<span class="lnum">20</span></div>');

    expect(html).toBe('<p data-b="0">Out of this stony rubbish?</p>');
  });

  it('un párrafo aislado que es solo un número se conserva ("1984")', async () => {
    const html = await htmlOf('<p>El año fue</p><p>1984</p><p>y nada cambió.</p>');

    expect(html).toContain('<p data-b="1">1984</p>');
  });

  it('una secuencia creciente de párrafos numéricos (PDF convertido) se elimina', async () => {
    const html = await htmlOf(
      '<p>Texto.</p><p>12</p><p>Más texto.</p><p>13</p><p>Sigue.</p><p>14</p>',
    );

    expect(html).toBe(
      '<p data-b="0">Texto.</p><p data-b="1">Más texto.</p><p data-b="2">Sigue.</p>',
    );
  });

  it('no confunde un párrafo con id "p1" con un número de página', async () => {
    expect(await htmlOf('<p id="p1">Primer párrafo.</p>')).toBe(
      '<p data-b="0">Primer párrafo.</p>',
    );
  });
});

describe('S2: encabezados repetidos', () => {
  it('elimina textos repetidos al borde de muchos documentos, no en medio', async () => {
    const chapters = Array.from({ length: 4 }, (_, i) => ({
      id: `c${i}`,
      title: `Capítulo ${i}`,
      body: `<p>MI LIBRO</p><h2>Capítulo ${i}</h2><p>Texto ${i}. MI LIBRO aparece aquí.</p><p>MI LIBRO</p><p>Final ${i}</p>`,
    }));
    const sections = await clean({ chapters });

    expect(sections[0]!.contentHtml).toBe(
      '<h2 data-b="0">Capítulo 0</h2><p data-b="1">Texto 0. MI LIBRO aparece aquí.</p><p data-b="2">MI LIBRO</p><p data-b="3">Final 0</p>',
    );
    expect(sections[0]!.cleaning.S2_running_headers.heuristic).toBe(1);
  });

  it('elimina el título repetido en la continuación de un capítulo partido', async () => {
    const [section] = await clean({
      chapters: [
        { id: 'c1a', title: 'El viaje', body: '<h2>El viaje</h2><p>Parte uno.</p><p>Sigue.</p>' },
        {
          id: 'c1b',
          title: 'El viaje',
          body: '<h2>El viaje</h2><p>Parte dos.</p><p>Fin.</p>',
          inToc: false,
        },
      ],
    });

    expect(section!.contentHtml.match(/El viaje/g)).toHaveLength(1);
  });

  it('no toca el encabezado del capítulo cuando delante se fusionó una portadilla', async () => {
    const [section] = await clean({
      chapters: [
        { id: 'ht', title: 'Mi libro', body: '<h2>I</h2>' },
        { id: 'c1', title: 'I', body: `<h2>I</h2><p>${'Texto. '.repeat(400)}</p>` },
        { id: 'c2', title: 'II', body: `<h2>II</h2><p>${'Texto. '.repeat(400)}</p>` },
      ],
      toc: [
        {
          title: 'Mi libro',
          href: 'ht.xhtml',
          children: [
            { title: 'I', href: 'c1.xhtml' },
            { title: 'II', href: 'c2.xhtml' },
          ],
        },
      ],
    });

    expect(section!.title).toBe('I');
    expect(section!.contentHtml.match(/<h2[^>]*>I<\/h2>/g)).toHaveLength(2);
  });
});

describe('S3: elementos ocultos', () => {
  it('elimina hidden, aria-hidden y display:none, pero conserva imágenes decorativas', async () => {
    const html = await htmlOf(
      `<p>Visible.</p><p hidden="">Oculto.</p><p aria-hidden="true">Oculto.</p>
       <p style="color: red; display: none">Oculto.</p><p><img src="orla.png" alt="" aria-hidden="true"/>Con orla.</p>`,
      {
        extraManifestItems: '<item id="orla" href="orla.png" media-type="image/png"/>',
        extraFiles: { 'OEBPS/orla.png': Buffer.from('x') },
      },
    );

    expect(html).toBe(
      '<p data-b="0">Visible.</p><p data-b="1"><img alt="" src="OEBPS/orla.png">Con orla.</p>',
    );
  });
});

describe('S4: notas al pie', () => {
  it('extrae una nota local, reescribe la llamada y elimina el contenedor vacío', async () => {
    const [section] = await clean({
      chapters: [
        {
          id: 'cap',
          title: 'Cap',
          body: `<p>Una frase<a epub:type="noteref" href="#fn1">1</a> que sigue.</p>
                 <section epub:type="footnotes"><h3>Notas</h3>
                   <aside epub:type="footnote" id="fn1"><p>La nota. <a epub:type="backlink" href="#r1">↩</a></p></aside>
                 </section>`,
        },
      ],
    });

    expect(section!.contentHtml).toBe(
      '<p data-b="0">Una frase<a data-lectio-note="n1" href="#n1">1</a> que sigue.</p>',
    );
    expect(section!.notes).toEqual([{ id: 'n1', html: '<p>La nota.</p>' }]);
  });

  it('copia una nota de la sección de notas sin modificar esa sección', async () => {
    const sections = await clean({
      chapters: [
        {
          id: 'cap',
          title: 'Cap',
          body: '<p>Frase<a epub:type="noteref" href="notas.xhtml#n-1">1</a>.</p>',
        },
        {
          id: 'notas',
          title: 'Notas',
          body: '<ol epub:type="endnotes"><li id="n-1" epub:type="endnote"><p>Una nota. <a href="cap.xhtml#r" role="doc-backlink">↩︎</a></p></li></ol>',
          bodyAttributes: 'epub:type="endnotes"',
        },
      ],
    });

    expect(sections[0]!.notes).toEqual([{ id: 'n1', html: '<p>Una nota.</p>' }]);
    expect(sections[1]!.kind).toBe('notes');
    expect(sections[1]!.contentHtml).toContain('Una nota.');
  });

  it('estilo Gutenberg: llamada y etiqueta se apuntan mutuamente; queda una sola nota', async () => {
    const [section] = await clean({
      chapters: [
        {
          id: 'cap',
          title: 'Prólogo',
          body: `<h2>Prólogo<a class="fnanchor" id="FNanchor_A" href="#Footnote_A">[*]</a></h2><p>Texto.</p>
                 <div class="footnote"><p><a id="Footnote_A" href="#FNanchor_A" class="label">[*]</a> Gracias a los editores.</p></div>`,
        },
      ],
    });

    expect(section!.notes).toEqual([{ id: 'n1', html: '<p>Gracias a los editores.</p>' }]);
    expect(section!.contentHtml).not.toContain('Gracias');
  });

  it('detecta llamadas sin semántica por <sup> + marca numérica', async () => {
    const [section] = await clean({
      chapters: [
        {
          id: 'cap',
          title: 'Cap',
          body: '<p>Texto<sup><a href="#x1">3</a></sup>.</p><p id="x1">3. Una nota suelta.</p><p>Más.</p>',
        },
      ],
    });

    expect(section!.notes.map((n) => n.html)).toEqual(['<p>3. Una nota suelta.</p>']);
  });

  it('un <aside> sin llamada que no es nota se conserva (recuadros del autor)', async () => {
    const html = await htmlOf(
      '<p>Texto.</p><aside class="note"><h4>Nota</h4><p>Recuadro con contenido.</p></aside>',
    );

    expect(html).toContain('Recuadro con contenido.');
  });

  it('una nota semántica sin llamada también sale del flujo', async () => {
    const [section] = await clean({
      chapters: [
        {
          id: 'cap',
          title: 'Cap',
          body: '<p>Texto.</p><aside epub:type="footnote"><p>Huérfana.</p></aside>',
        },
      ],
    });

    expect(section!.contentHtml).toBe('<p data-b="0">Texto.</p>');
    expect(section!.notes).toHaveLength(1);
  });
});

describe('sanitización y HTML de lectura', () => {
  it('descarta scripts y estilos y elimina atributos no permitidos', async () => {
    const html = await htmlOf(
      '<script>alert(1)</script><style>p{}</style><p class="x" style="color:red" id="a" onclick="mal()">Hola <em class="y">mundo</em>.</p>',
    );

    expect(html).toBe('<p data-b="0">Hola <em>mundo</em>.</p>');
  });

  it('desenvuelve contenedores y convierte en párrafo los que solo tienen texto (versos)', async () => {
    const html = await htmlOf(
      '<div class="poem"><div class="stanza"><span>Volverán las oscuras golondrinas</span><br/><span>en tu balcón sus nidos a colgar</span></div></div>',
    );

    expect(html).toBe(
      '<p data-b="0"><span>Volverán las oscuras golondrinas</span> <br><span>en tu balcón sus nidos a colgar</span></p>',
    );
  });

  it('conserva enlaces externos y desenvuelve los internos', async () => {
    const html = await htmlOf(
      '<p>Ver <a href="https://example.com">sitio</a> y <a href="otro.xhtml#x">capítulo</a>.</p>',
    );

    expect(html).toBe('<p data-b="0">Ver <a href="https://example.com">sitio</a> y capítulo.</p>');
  });

  it('resuelve imágenes a rutas del libro, convierte portadas SVG y descarta las inexistentes', async () => {
    const [section] = await clean({
      chapters: [
        {
          id: 'cap',
          href: 'Text/cap.xhtml',
          title: 'Cap',
          body: `<p><img src="../Images/a.jpg" alt="Mapa"/></p><p><img src="no-existe.png"/>Texto.</p>
                 <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="../Images/a.jpg"/></svg>`,
        },
      ],
      extraManifestItems: '<item id="a" href="Images/a.jpg" media-type="image/jpeg"/>',
      extraFiles: { 'OEBPS/Images/a.jpg': Buffer.from('jpg') },
    });

    expect(section!.contentHtml).toBe(
      '<p data-b="0"><img alt="Mapa" src="OEBPS/Images/a.jpg"></p><p data-b="1">Texto.</p><p data-b="2"><img alt="" src="OEBPS/Images/a.jpg"></p>',
    );
    expect(section!.resources).toEqual(['OEBPS/Images/a.jpg']);
  });

  it('envuelve en párrafo el texto suelto que convive con bloques', async () => {
    const html = await htmlOf('<ul><li>Un punto<p>con detalle</p></li></ul>');

    expect(html).toBe('<ul><li><p data-b="0">Un punto</p><p data-b="1">con detalle</p></li></ul>');
  });

  it('colapsa espacios salvo en <pre>, y escapa el texto', async () => {
    const html = await htmlOf('<p>\n\t  Uno   &amp;\n dos &lt;tres&gt;  </p><pre>a  b\n  c</pre>');

    expect(html).toBe(
      '<p data-b="0">Uno &amp; dos &lt;tres&gt;</p><pre data-b="1">a  b\n  c</pre>',
    );
  });

  it('marca como bloque solo el nivel más interno', async () => {
    const [section] = await clean({
      chapters: [
        {
          id: 'cap',
          title: 'Cap',
          body: '<h1>Título</h1><blockquote><p>Cita uno.</p><p>Cita dos.</p></blockquote>',
        },
      ],
    });

    expect(section!.blocks.map((b) => b.textContent)).toEqual(['Título', 'Cita uno.', 'Cita dos.']);
  });
});
