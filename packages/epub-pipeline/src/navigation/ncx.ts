import { resolveHref } from '../paths.js';
import { attr, child, children, parseXml, textOf, type XmlNode } from '../xml.js';
import type { TocNode } from './types.js';

/** Lee la tabla de contenidos de un NCX (EPUB 2, y muchos EPUB 3 por compatibilidad). */
export function parseNcx(source: string, ncxPath: string): TocNode[] {
  const navMap = child(child(parseXml(source), 'ncx'), 'navMap');
  return parsePoints(navMap, ncxPath);
}

function parsePoints(parent: XmlNode | undefined, ncxPath: string): TocNode[] {
  return children(parent, 'navPoint').flatMap((point) => {
    const src = attr(child(point, 'content'), 'src');
    const target = src ? resolveHref(ncxPath, src) : null;
    const nested = parsePoints(point, ncxPath);
    if (!target && nested.length === 0) return [];
    // `<text>` sin atributos se parsea como string, no como nodo: se lee directo.
    const title = textOf(child(point, 'navLabel')?.text);
    return [{ title, target, children: nested }];
  });
}
