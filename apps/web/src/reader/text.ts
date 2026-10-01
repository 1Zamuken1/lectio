import type { Schemas } from '../api/queries';

export { headingMatchesTitle } from './heading';

export type Sentence = Schemas['SentenceDto'];

/** Caracteres de narración por minuto de audio (medido con los perfiles de Lectio). */
export const CHARS_PER_MINUTE = 900;

export const KIND_LABEL: Record<Schemas['ChapterDto']['kind'], string> = {
  narrative: 'narrativa',
  front_matter: 'preliminar',
  back_matter: 'final',
  notes: 'notas',
};

export const estimatedMinutes = (characters: number) =>
  Math.max(1, Math.round(characters / CHARS_PER_MINUTE));

/** "12 min", "1 h 5 min", "2 h". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)} h${rest ? ` ${rest} min` : ''}`;
}

export const formatNumber = (value: number) =>
  value.toLocaleString('es', { useGrouping: 'always' });

/**
 * Primera oración de cada bloque (`data-b`): la posición de lectura es la primera oración
 * del primer bloque visible (frontend §4.2). Los bloques sin oraciones (una imagen) no
 * aparecen.
 */
export function firstSentenceByBlock(sentences: Sentence[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const sentence of sentences) {
    if (sentence.blockIndex >= 0 && !map.has(sentence.blockIndex)) {
      map.set(sentence.blockIndex, sentence.index);
    }
  }
  return map;
}

/** La oración que contiene el offset `offset` del texto de un bloque (o la primera del bloque). */
export function sentenceAtOffset(
  sentences: Sentence[],
  blockIndex: number,
  offset: number,
): Sentence | null {
  const candidates = sentences.filter((s) => s.blockIndex === blockIndex);
  return candidates.find((s) => offset >= s.start && offset <= s.end) ?? candidates[0] ?? null;
}

/** Rango DOM de [start, end) dentro del texto de un bloque (mismos offsets que el pipeline). */
export function rangeFor(block: Element, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let offset = 0;
  let started = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.textContent?.length ?? 0;
    if (!started && start <= offset + length) {
      range.setStart(node, start - offset);
      started = true;
    }
    if (started && end <= offset + length) {
      range.setEnd(node, end - offset);
      return range;
    }
    offset += length;
  }
  return started ? range : null;
}

/** Posición del cursor bajo un clic (cada navegador tiene su versión). */
export function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (doc.caretPositionFromPoint) {
    const position = doc.caretPositionFromPoint(x, y);
    return position && { node: position.offsetNode, offset: position.offset };
  }
  if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(x, y);
    return range && { node: range.startContainer, offset: range.startOffset };
  }
  return null;
}

/** La oración bajo un clic dentro de la prosa: bloque + offset del cursor en su texto. */
export function sentenceAtPoint(
  target: Element,
  x: number,
  y: number,
  sentences: Sentence[],
): Sentence | null {
  const block = target.closest('[data-b]');
  const caret = caretAt(x, y);
  if (!block || !caret || !block.contains(caret.node)) return null;
  const range = document.createRange();
  range.selectNodeContents(block);
  range.setEnd(caret.node, caret.offset);
  return sentenceAtOffset(sentences, Number(block.getAttribute('data-b')), range.toString().length);
}
