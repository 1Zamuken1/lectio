import { isElement, isText } from '../dom/xhtml.js';

/**
 * Copia el contenido de `root` comprendido entre `start` (incluido) y `end` (excluido),
 * en orden de documento. `start = null` es el inicio de `root`; `end = null`, el final.
 *
 * Un punto de corte puede estar anidado (un `<h2 id>` dentro de `<div class="capitulo">`):
 * los ancestros se copian como envoltorios en ambos lados del corte, para no perder
 * la estructura. Los comentarios y las instrucciones de procesamiento se descartan.
 */
export function sliceRange(root: Element, start: Element | null, end: Element | null): Node[] {
  let inside = start === null;
  let done = false;

  const visit = (node: Node): Node | null => {
    if (node === end) {
      done = true;
      return null;
    }
    if (node === start) inside = true;
    if (isText(node)) return inside ? node.cloneNode(true) : null;
    if (!isElement(node)) return null;

    // Atajo: un elemento completamente dentro del rango se copia entero.
    if (inside && (end === null || !node.contains(end))) return node.cloneNode(true);

    const enteredInside = inside;
    const kept: Node[] = [];
    for (const child of Array.from(node.childNodes)) {
      const copy = visit(child);
      if (copy) kept.push(copy);
      if (done) break;
    }
    if (!enteredInside && kept.length === 0) return null;

    const shell = node.cloneNode(false) as Element;
    for (const copy of kept) shell.appendChild(copy);
    return shell;
  };

  const result: Node[] = [];
  for (const child of Array.from(root.childNodes)) {
    const copy = visit(child);
    if (copy) result.push(copy);
    if (done) break;
  }
  return result;
}
