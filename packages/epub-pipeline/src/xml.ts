import { XMLParser } from 'fast-xml-parser';

/**
 * Parser XML para los documentos de estructura del EPUB (container.xml, OPF,
 * encryption.xml, NCX). No se usa para el contenido XHTML de los capítulos.
 *
 * Seguridad: fast-xml-parser nunca resuelve entidades externas (sin XXE), y los
 * límites de `processEntities` evitan ataques de expansión ("billion laughs").
 * Los prefijos de namespace se eliminan (`dc:title` → `title`, `opf:role` → `role`),
 * lo que simplifica leer OPF escritos con o sin prefijos.
 */

export type XmlNode = Record<string, unknown>;

/** Elementos que pueden repetirse y se normalizan siempre a arrays. */
const ARRAY_TAGS = new Set([
  'rootfile',
  'item',
  'itemref',
  'reference',
  'meta',
  'title',
  'creator',
  'contributor',
  'language',
  'identifier',
  'EncryptedData',
  'link',
  'navPoint',
]);

export function parseXml(xml: string): XmlNode {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    textNodeName: '#text',
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    processEntities: {
      enabled: true,
      maxEntityCount: 50,
      maxEntitySize: 1_000,
      maxTotalExpansions: 500,
      maxExpandedLength: 50_000,
    },
    isArray: (tagName) => ARRAY_TAGS.has(tagName),
  });
  return parser.parse(xml) as XmlNode;
}

export function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

export function child(node: unknown, name: string): XmlNode | undefined {
  if (!isNode(node)) return undefined;
  const value = node[name];
  if (Array.isArray(value)) return isNode(value[0]) ? value[0] : undefined;
  return isNode(value) ? value : undefined;
}

export function children(node: unknown, name: string): XmlNode[] {
  if (!isNode(node)) return [];
  return asArray(node[name]).map((value) => (isNode(value) ? value : { '#text': value }));
}

export function attr(node: unknown, name: string): string | undefined {
  if (!isNode(node)) return undefined;
  const value = node[`@_${name}`];
  return typeof value === 'string' ? value : undefined;
}

/** Texto de un elemento, con espacios internos colapsados. */
export function textOf(node: unknown): string {
  const raw = isNode(node) ? node['#text'] : node;
  if (typeof raw === 'string') return collapseWhitespace(raw);
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  return '';
}

export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function isNode(value: unknown): value is XmlNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
