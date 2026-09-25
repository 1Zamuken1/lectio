import { isElement, isText, tagName } from '../dom/xhtml.js';

const VOID = new Set(['br', 'hr', 'img', 'wbr']);

/**
 * Serializa como HTML (no XHTML): `<br>` en lugar de `<br />`, `<p></p>` en lugar de `<p />`.
 * El contenido ya está sanitizado, así que solo hace falta escapar texto y atributos.
 */
export function serializeChildren(root: Node): string {
  return Array.from(root.childNodes).map(serialize).join('');
}

function serialize(node: Node): string {
  if (isText(node)) return escapeText(node.textContent ?? '');
  if (!isElement(node)) return '';
  const tag = tagName(node);
  // Orden alfabético: salida determinista (linkedom no conserva el orden de inserción).
  const attributes = Array.from(node.attributes)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((a) => ` ${a.name}="${escapeAttribute(a.value)}"`)
    .join('');
  if (VOID.has(tag)) return `<${tag}${attributes}>`;
  return `<${tag}${attributes}>${serializeChildren(node)}</${tag}>`;
}

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', '&quot;');
}
