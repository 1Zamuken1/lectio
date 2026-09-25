import {
  collapsedText,
  descendants,
  epubTypes,
  isElement,
  parseXhtml,
  tagName,
} from '../dom/xhtml.js';
import { resolveHref } from '../paths.js';
import { normalizeLandmarkType } from './landmarks.js';
import type { Landmark, TocNode } from './types.js';

/** Lee el documento de navegación de EPUB 3: `<nav epub:type="toc">` y `landmarks`. */
export function parseNavDocument(
  source: string,
  navPath: string,
): { toc: TocNode[]; landmarks: Landmark[] } {
  const navs = [...descendants(parseXhtml(source))].filter((el) => tagName(el) === 'nav');
  const isToc = (nav: Element) =>
    epubTypes(nav).includes('toc') || nav.getAttribute('role') === 'doc-toc';
  // Sin nav tipado, se asume que el primero es el índice (EPUB generados a mano).
  const tocNav = navs.find(isToc) ?? navs.find((nav) => epubTypes(nav).length === 0);
  const landmarksNav = navs.find((nav) => epubTypes(nav).includes('landmarks'));

  return {
    toc: tocNav ? parseList(firstList(tocNav), navPath) : [],
    landmarks: landmarksNav ? parseLandmarks(landmarksNav, navPath) : [],
  };
}

function parseList(list: Element | null, navPath: string): TocNode[] {
  if (!list) return [];
  return Array.from(list.children)
    .filter((li) => tagName(li) === 'li')
    .flatMap((li) => {
      const label = Array.from(li.children).find((el) => ['a', 'span'].includes(tagName(el)));
      const href = label && tagName(label) === 'a' ? label.getAttribute('href') : null;
      const target = href ? resolveHref(navPath, href) : null;
      const children = parseList(firstList(li), navPath);
      const title = label ? collapsedText(label) : '';
      if (!target && children.length === 0) return [];
      return [{ title, target, children }];
    });
}

/** Primer `<ol>` (o `<ul>`, no estándar pero frecuente) hijo directo o anidado en un contenedor. */
function firstList(parent: Element): Element | null {
  for (const child of Array.from(parent.children)) {
    if (['ol', 'ul'].includes(tagName(child))) return child;
  }
  for (const child of Array.from(parent.children)) {
    if (['div', 'section'].includes(tagName(child))) return firstList(child);
  }
  return null;
}

function parseLandmarks(nav: Element, navPath: string): Landmark[] {
  return [...descendants(nav)]
    .filter((el) => tagName(el) === 'a' && isElement(el))
    .flatMap((a) => {
      // Solo sirven las entradas con un tipo reconocido: algunos EPUB meten aquí
      // listas de páginas u otras cosas sin `epub:type`.
      const type = epubTypes(a)
        .map(normalizeLandmarkType)
        .find((t) => t !== null);
      const target = resolveHref(navPath, a.getAttribute('href') ?? '');
      return type && target ? [{ type, ...target }] : [];
    });
}
