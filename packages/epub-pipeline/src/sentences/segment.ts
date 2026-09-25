import { isElement, isText, tagName } from '../dom/xhtml.js';

/** Texto de un bloque y los tramos que ocupan sus llamadas a nota. */
export interface BlockText {
  text: string;
  /** Rangos [inicio, fin) de las marcas de nota (`<a data-lectio-note>`) dentro de `text`. */
  noteRanges: Array<[number, number]>;
}

/**
 * El texto se toma exactamente como `textContent` del bloque sanitizado: así los
 * offsets de cada oración sirven directamente para resaltarla en el lector con la
 * API Range, sin envolver oraciones en `<span>`.
 */
export function blockText(block: Element): BlockText {
  const noteRanges: Array<[number, number]> = [];
  let text = '';
  const walk = (node: Node, inNote: boolean): void => {
    for (const child of Array.from(node.childNodes)) {
      if (isText(child)) {
        const value = child.textContent ?? '';
        if (inNote && value) noteRanges.push([text.length, text.length + value.length]);
        text += value;
      } else if (isElement(child)) {
        walk(child, inNote || (tagName(child) === 'a' && child.hasAttribute('data-lectio-note')));
      }
    }
  };
  walk(block, false);
  return { text, noteRanges };
}

/** Abreviaturas tras las cuales un punto no cierra la oración. En minúsculas, sin el punto. */
const ABBREVIATIONS: Record<string, Set<string>> = {
  es: new Set([
    'sr',
    'sra',
    'srta',
    'sres',
    'srs',
    'dr',
    'dra',
    'd',
    'dña',
    'ud',
    'uds',
    'vd',
    'vds',
    'lic',
    'ing',
    'prof',
    'pág',
    'págs',
    'pag',
    'cap',
    'caps',
    'fig',
    'núm',
    'num',
    'vol',
    'vols',
    'etc',
    'ej',
    'aprox',
    'av',
    'avda',
    'dpto',
    'ed',
    'eds',
    'op',
    'cit',
    'ibid',
    'id',
    'cf',
    'vid',
    'sto',
    'sta',
    'fr',
    'mons',
    'excmo',
    'excma',
    'ilmo',
    'ilma',
    'gral',
    'cnel',
    'tte',
  ]),
  en: new Set([
    'mr',
    'mrs',
    'ms',
    'dr',
    'prof',
    'st',
    'mt',
    'jr',
    'sr',
    'rev',
    'hon',
    'gen',
    'col',
    'capt',
    'lt',
    'sgt',
    'no',
    'vol',
    'vols',
    'pp',
    'p',
    'fig',
    'ch',
    'etc',
    'vs',
    'viz',
    'cf',
    'ed',
    'eds',
    'ibid',
    'op',
    'cit',
    'approx',
    'dept',
    'esq',
  ]),
};

/**
 * Divide el texto de un bloque en oraciones. Devuelve rangos [inicio, fin) sin espacios
 * en los bordes.
 *
 * Sobre `Intl.Segmenter` se corrigen tres casos que el corpus mostró:
 * - las llamadas a nota se enmascaran con espacios (mismo largo, mismos offsets): pegadas
 *   al punto ("truth.3 To") impedían ver el fin de oración;
 * - un punto tras una abreviatura o una inicial ("Sr.", "pág.", "J.") no cierra la oración;
 * - "¡Qué horror! dijo" y "Why?" he asked" son una sola oración: tras "?" o "!", si lo
 *   siguiente empieza en minúscula, continúa.
 */
export function segmentSentences(
  { text, noteRanges }: BlockText,
  language: string,
): Array<[number, number]> {
  let masked = text;
  for (const [start, end] of noteRanges) {
    masked = masked.slice(0, start) + ' '.repeat(end - start) + masked.slice(end);
  }

  const segmenter = new Intl.Segmenter(language, { granularity: 'sentence' });
  const raw = [...segmenter.segment(masked)].map((s): [number, number] => [
    s.index,
    s.index + s.segment.length,
  ]);
  const abbreviations = ABBREVIATIONS[language] ?? ABBREVIATIONS.en!;

  const merged: Array<[number, number]> = [];
  for (const range of raw) {
    const previous = merged[merged.length - 1];
    if (
      previous &&
      shouldJoin(
        masked.slice(previous[0], previous[1]),
        masked.slice(range[0], range[1]),
        abbreviations,
      )
    ) {
      previous[1] = range[1];
    } else {
      merged.push([...range]);
    }
  }

  return merged
    .map(([start, end]) => trimRange(masked, start, end))
    .filter(([start, end]) => end > start);
}

function shouldJoin(previous: string, next: string, abbreviations: Set<string>): boolean {
  const before = previous.trimEnd();
  const after = next.trimStart();
  if (!after) return true;

  // Abreviatura o inicial al final: "el Sr." + "García llegó".
  const lastWord = /([\p{L}]+)\.$/u.exec(before)?.[1];
  if (lastWord) {
    if (abbreviations.has(lastWord.toLowerCase())) return true;
    if (lastWord.length === 1 && /\p{Lu}/u.test(lastWord)) return true;
  }

  // "?" o "!" (con cierre opcional de comillas) seguido de minúscula: la frase continúa.
  if (/[?!…][»"”’)]*$/u.test(before)) {
    return /^[—–\-«"“‘(]*\s*\p{Ll}/u.test(after);
  }
  return false;
}

function trimRange(text: string, start: number, end: number): [number, number] {
  while (start < end && /\s/.test(text[start]!)) start++;
  while (end > start && /\s/.test(text[end - 1]!)) end--;
  return [start, end];
}
