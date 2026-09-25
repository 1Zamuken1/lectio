import { describe, expect, it } from 'vitest';
import { parseXhtml } from '../../../src/dom/xhtml.js';
import { sliceRange } from '../../../src/segmentation/slice.js';

function body(inner: string) {
  const doc = parseXhtml(`<html xmlns="http://www.w3.org/1999/xhtml"><body>${inner}</body></html>`);
  const root = doc.querySelector('body')!;
  const byId = (id: string) => doc.querySelector(`[id="${id}"]`)!;
  const html = (nodes: Node[]) =>
    nodes.map((n) => (n as Element).outerHTML ?? n.textContent).join('');
  return { root, byId, html };
}

describe('sliceRange', () => {
  it('sin límites copia todo el contenido', () => {
    const { root, html } = body('<p>a</p><p>b</p>');

    expect(html(sliceRange(root, null, null))).toBe('<p>a</p><p>b</p>');
  });

  it('corta entre dos elementos hermanos (fin excluido)', () => {
    const { root, byId, html } = body('<h2 id="c1">I</h2><p>uno</p><h2 id="c2">II</h2><p>dos</p>');

    expect(html(sliceRange(root, byId('c1'), byId('c2')))).toBe('<h2 id="c1">I</h2><p>uno</p>');
    expect(html(sliceRange(root, byId('c2'), null))).toBe('<h2 id="c2">II</h2><p>dos</p>');
  });

  it('duplica los ancestros como envoltorio cuando el corte está anidado', () => {
    const { root, byId, html } = body(
      '<div class="cap"><p>antes</p><h2 id="c2">II</h2><p>después</p></div><p>fuera</p>',
    );

    expect(html(sliceRange(root, null, byId('c2')))).toBe('<div class="cap"><p>antes</p></div>');
    expect(html(sliceRange(root, byId('c2'), null))).toBe(
      '<div class="cap"><h2 id="c2">II</h2><p>después</p></div><p>fuera</p>',
    );
  });

  it('funciona cuando el fin está dentro del inicio', () => {
    const { root, byId, html } = body(
      '<section id="s"><h1>Parte</h1><p>intro</p><h2 id="sub">1</h2><p>texto</p></section>',
    );

    expect(html(sliceRange(root, byId('s'), byId('sub')))).toBe(
      '<section id="s"><h1>Parte</h1><p>intro</p></section>',
    );
  });

  it('respeta anclas vacías autocerradas como punto de corte', () => {
    // En modo HTML, <a id="p2"/> quedaría abierto y se tragaría el resto del documento.
    const { root, byId, html } = body('<p>uno</p><a id="p2"/><p>dos</p>');

    expect(html(sliceRange(root, null, byId('p2')))).toBe('<p>uno</p>');
    expect(html(sliceRange(root, byId('p2'), null))).toBe('<a id="p2" /><p>dos</p>');
  });

  it('no incluye comentarios', () => {
    const { root, html } = body('<p>a</p><!-- nota interna --><p>b</p>');

    expect(html(sliceRange(root, null, null))).toBe('<p>a</p><p>b</p>');
  });
});
