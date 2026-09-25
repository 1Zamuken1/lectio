import { collapsedText, descendants, tagName } from '../../dom/xhtml.js';
import type { Section } from '../../segmentation/sections.js';
import type { RuleStats } from '../stats.js';

const LEAF_BLOCK_TAGS = new Set([
  'p',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'header',
  'footer',
]);
const HEADING = /^h[1-6]$/;
/** Un encabezado de página es corto; un párrafo largo repetido no es un artefacto. */
const MAX_HEADER_CHARS = 80;

/**
 * S2a. Textos que se repiten al inicio o al final de muchos documentos del libro:
 * encabezados y pies de página de EPUB que imitan la edición impresa ("Don Quijote",
 * "Capítulo 3" en cada archivo). Se calcula una vez para todo el libro.
 */
export function findRunningHeaders(sections: Section[]): Set<string> {
  const docsByText = new Map<string, Set<string>>();
  let totalDocs = 0;

  for (const section of sections) {
    for (const part of parts(section)) {
      totalDocs++;
      const path = part.getAttribute('data-lectio-src') ?? '';
      for (const block of edgeBlocks(part)) {
        const key = normalize(collapsedText(block));
        if (!key || key.length > MAX_HEADER_CHARS) continue;
        if (!docsByText.has(key)) docsByText.set(key, new Set());
        docsByText.get(key)!.add(path);
      }
    }
  }

  const threshold = Math.max(3, Math.ceil(totalDocs * 0.3));
  return new Set(
    [...docsByText].filter(([, docs]) => docs.size >= threshold).map(([text]) => text),
  );
}

export function removeRunningHeaders(
  section: Section,
  headers: Set<string>,
  stats: RuleStats,
): void {
  if (headers.size === 0) return;
  for (const part of parts(section)) {
    for (const block of edgeBlocks(part)) {
      if (headers.has(normalize(collapsedText(block)))) {
        block.remove();
        stats.S2_running_headers.heuristic++;
      }
    }
  }
}

/**
 * S2b. Cuando un capítulo está repartido en varios archivos (divisiones de Calibre),
 * cada archivo suele repetir el título del capítulo. Se conserva solo el primero.
 */
export function removeDuplicateTitles(section: Section, stats: RuleStats): void {
  // Solo los documentos posteriores al ancla son continuaciones del capítulo; los
  // anteriores son una portadilla fusionada, cuyo título no es una repetición.
  const all = parts(section);
  const anchorIndex = all.findIndex(
    (p) => p.getAttribute('data-lectio-src') === section.anchor.path,
  );
  const [first, ...rest] = all.slice(Math.max(anchorIndex, 0));
  if (!first) return;
  const firstHeading = [...descendants(first)].find((el) => HEADING.test(tagName(el)));
  const titles = new Set(
    [section.title, firstHeading ? collapsedText(firstHeading) : ''].map(normalize).filter(Boolean),
  );
  for (const part of rest) {
    const [opening] = edgeBlocks(part);
    if (
      opening &&
      HEADING.test(tagName(opening)) &&
      titles.has(normalize(collapsedText(opening)))
    ) {
      opening.remove();
      stats.S2_duplicate_titles.heuristic++;
    }
  }
}

function parts(section: Section): Element[] {
  return Array.from(section.content.children).filter((el) => el.hasAttribute('data-lectio-src'));
}

/** Primer y último bloque "hoja" con texto de un documento. */
function edgeBlocks(part: Element): Element[] {
  const blocks = [...descendants(part)].filter(
    (el) =>
      LEAF_BLOCK_TAGS.has(tagName(el)) &&
      collapsedText(el) !== '' &&
      !Array.from(el.children).some((c) => LEAF_BLOCK_TAGS.has(tagName(c))),
  );
  if (blocks.length < 2) return [];
  return [blocks[0]!, blocks[blocks.length - 1]!];
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}
