import { collapsedText, descendants, semanticTypes, tagName } from '../../dom/xhtml.js';
import type { RuleStats } from '../stats.js';

const PAGE_CLASS =
  /\b(page-?num(ber)?|pageno|pagenum|pg-?num|x-ebookmaker-pageno|pagebreak|page-break)\b/i;
const PAGE_ID = /^(page|pg)[-_]?[ivxlcdm\d]+$/i;
/** Texto de un marcador de página: vacío, "12", "[p. 12]", "[Pg 12]", "xii". */
const PAGE_TEXT = /^\[?\s*((p|pg|pag|pág|page)\.?\s*)?[\divxlcdm]*\s*\]?$/i;
const LINE_CLASS = /\b(lnum|linenum|line-?num(ber)?|linenumber)\b/i;
const INLINE_TAGS = new Set(['span', 'a', 'small', 'sup', 'b', 'i', 'em', 'strong']);
const LEAF_BLOCKS = new Set(['p', 'div']);

/**
 * S1. Números de página y de verso. No son contenido del autor: son rastros de la
 * edición impresa. Leer "20" cada cinco versos de un poema arruina la escucha.
 */
export function removePageNumbers(root: Element, stats: RuleStats): void {
  for (const element of [...descendants(root)]) {
    if (!element.parentNode) continue; // ya eliminado junto con un ancestro
    const text = collapsedText(element);

    if (semanticTypes(element).includes('pagebreak')) {
      element.remove();
      stats.S1_page_numbers.semantic++;
      continue;
    }
    const tag = tagName(element);
    const className = element.getAttribute('class') ?? '';
    const id = element.getAttribute('id') ?? '';
    const pageLike =
      PAGE_CLASS.test(className) || (PAGE_ID.test(id) && (INLINE_TAGS.has(tag) || text === ''));
    if (pageLike && PAGE_TEXT.test(text)) {
      element.remove();
      stats.S1_page_numbers.heuristic++;
      continue;
    }
    if (LINE_CLASS.test(className) && /^\d{1,5}$/.test(text)) {
      element.remove();
      stats.S1_line_numbers.heuristic++;
    }
  }
  removeNumberSequences(root, stats);
}

/**
 * Párrafos que son solo un número, típicos de EPUB convertidos desde PDF. Uno aislado
 * ("1984") puede ser contenido real, así que solo se eliminan si forman una secuencia
 * creciente de al menos tres dentro de la sección.
 */
function removeNumberSequences(root: Element, stats: RuleStats): void {
  const candidates = [...descendants(root)].filter(
    (el) =>
      LEAF_BLOCKS.has(tagName(el)) &&
      el.children.length === 0 &&
      /^\d{1,4}$/.test(collapsedText(el)),
  );
  if (candidates.length < 3) return;
  const numbers = candidates.map((el) => Number(collapsedText(el)));
  const increasing = numbers.every((n, i) => i === 0 || n > numbers[i - 1]!);
  if (!increasing) return;
  for (const element of candidates) element.remove();
  stats.S1_page_numbers.heuristic += candidates.length;
}
