import { decodeHTML } from 'entities';
import { DOMParser } from 'linkedom';

/**
 * Los documentos de contenido de un EPUB son XHTML: se parsean como XML para que
 * `<a id="x"/>` se cierre correctamente (el parser HTML lo dejaría abierto y todo
 * lo siguiente quedaría dentro del enlace, rompiendo el corte por fragmento).
 *
 * El modo XML no conoce las entidades con nombre de HTML (`&nbsp;`, `&mdash;`),
 * muy comunes en EPUB reales. Se convierten antes a referencias numéricas.
 */

const XML_ENTITIES = new Set(['amp', 'lt', 'gt', 'quot', 'apos']);

export const ELEMENT_NODE = 1;
export const TEXT_NODE = 3;
export const CDATA_SECTION_NODE = 4;

export function parseXhtml(source: string): Document {
  // Tipos DOM estándar sobre la implementación de linkedom (compatibles en la práctica).
  return new DOMParser().parseFromString(
    encodeNamedEntities(source),
    'text/xml',
  ) as unknown as Document;
}

export function encodeNamedEntities(source: string): string {
  return source.replace(/&([a-zA-Z][a-zA-Z0-9]{1,31});/g, (match, name: string) => {
    if (XML_ENTITIES.has(name)) return match;
    const decoded = decodeHTML(match);
    if (decoded === match) return match;
    return [...decoded].map((char) => `&#x${char.codePointAt(0)?.toString(16)};`).join('');
  });
}

/** Valores de `epub:type` (lista separada por espacios). */
export function epubTypes(element: Element): string[] {
  return (element.getAttribute('epub:type') ?? '').split(/\s+/).filter(Boolean);
}

export function isElement(node: Node): node is Element {
  return node.nodeType === ELEMENT_NODE;
}

export function isText(node: Node): boolean {
  return node.nodeType === TEXT_NODE || node.nodeType === CDATA_SECTION_NODE;
}

/** Nombre de etiqueta en minúsculas y sin prefijo (`h1`, `svg`). */
export function tagName(element: Element): string {
  return (element.localName || element.tagName).toLowerCase();
}

export function collapsedText(node: Node): string {
  return (node.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Elementos descendientes en orden de documento. */
export function* descendants(root: Node): Generator<Element> {
  for (const child of Array.from(root.childNodes)) {
    if (!isElement(child)) continue;
    yield child;
    yield* descendants(child);
  }
}

export function findFirst(root: Node, predicate: (element: Element) => boolean): Element | null {
  for (const element of descendants(root)) {
    if (predicate(element)) return element;
  }
  return null;
}
