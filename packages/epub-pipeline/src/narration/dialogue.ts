/**
 * Diálogo y narración dentro de un bloque (docs/lectio-decision-tts.md §7). El
 * narrador lee cada tramo con una prosodia distinta: la narración algo más grave, el
 * diálogo más agudo y ágil. Aquí solo se decide qué tramo es qué; cómo suena cada uno lo
 * decide el adaptador de TTS.
 *
 * Convenciones que se reconocen:
 * - Raya de diálogo, solo en los idiomas que la usan así (español, portugués, catalán,
 *   gallego): un párrafo que empieza con raya es un parlamento;
 *   cada raya siguiente alterna entre parlamento y acotación del narrador.
 *   "—Vamos —dijo el viajero—, humanidad tenemos." → [Vamos] [dijo el viajero,] [humanidad tenemos.]
 *   La puntuación pegada a la raya que cierra una acotación queda con la acotación. En
 *   inglés, en cambio, la raya inicial atribuye una cita ("—Genesis."): no es diálogo.
 * - Comillas (« », “ ”, " "): en un párrafo sin raya inicial, lo entrecomillado es
 *   diálogo si termina en puntuación dentro de las comillas (“Why,” «¿qué llevas?») o si
 *   es largo; unas pocas palabras sin puntuación suelen ser un término o un apodo
 *   («el Doctor», «aura de aplausos»), no alguien hablando.
 */

export type VoiceKind = 'narration' | 'dialogue';

/** Raya, semirraya, barra horizontal y el "--" de algunos textos de Gutenberg. */
const DASH = /[—―–]|--/g;
/**
 * Si el párrafo abre con guion simple ("-Hola"), las acotaciones también lo usan: un
 * guion tras un espacio y antes de una letra, o tras una palabra y antes de un espacio o
 * de puntuación. Entre dos letras ("franco-alemán") no cuenta.
 */
const HYPHEN_DASH = /[—―–]|--|(?<=\s)-(?=\p{L})|(?<=[\p{L}!?.…])-(?=[\s,.;:]|$)/gu;
const OPENING_DASH = /^\s*(?:[—―–]|--|-(?=\S))/;
const QUOTES: Record<string, string> = { '«': '»', '“': '”', '"': '"' };
const MIN_QUOTED_WORDS = 5;
const DASH_DIALOGUE_LANGUAGES = new Set(['es', 'pt', 'ca', 'gl']);

/** Rangos [inicio, fin) de `text` que son diálogo, ordenados y sin solaparse. */
export function dialogueRanges(text: string, language: string): Array<[number, number]> {
  const opening = DASH_DIALOGUE_LANGUAGES.has(language) ? OPENING_DASH.exec(text) : null;
  if (!opening) return quotedDialogue(text);
  return dashDialogue(text, opening[0].length, opening[0].trim() === '-' ? HYPHEN_DASH : DASH);
}

function dashDialogue(text: string, start: number, dash: RegExp): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let inDialogue = true;
  let from = start;
  dash.lastIndex = start;
  for (let match = dash.exec(text); match; match = dash.exec(text)) {
    const at = match.index;
    const after = at + match[0].length;
    // "1914–1918": una semirraya entre cifras es un rango, no un diálogo.
    if (/\d/.test(text[at - 1] ?? '') && /\d/.test(text[after] ?? '')) continue;
    if (inDialogue) {
      if (at > from) ranges.push([from, at]);
      from = after;
    } else {
      // La raya que cierra la acotación arrastra su puntuación: "—dijo—, humanidad".
      const punctuation = /^[,.;:]*/.exec(text.slice(after))![0].length;
      from = after + punctuation;
    }
    inDialogue = !inDialogue;
  }
  if (inDialogue && from < text.length) ranges.push([from, text.length]);
  return ranges.filter(([a, b]) => /[\p{L}\p{N}]/u.test(text.slice(a, b)));
}

function quotedDialogue(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let i = 0;
  while (i < text.length) {
    const close = QUOTES[text[i]!];
    if (!close) {
      i++;
      continue;
    }
    const end = text.indexOf(close, i + 1);
    if (end === -1) break;
    const inner = text.slice(i + 1, end);
    const spoken =
      /[,.;:!?…]\s*$/u.test(inner) || inner.trim().split(/\s+/).length >= MIN_QUOTED_WORDS;
    if (spoken) ranges.push([i, end + 1]);
    i = end + 1;
  }
  return ranges;
}

/**
 * Parte [start, end) en tramos de narración y diálogo según `ranges`. Los tramos vacíos
 * (solo espacios o puntuación) se descartan.
 */
export function splitByVoice(
  text: string,
  start: number,
  end: number,
  ranges: Array<[number, number]>,
): Array<{ kind: VoiceKind; start: number; end: number }> {
  const parts: Array<{ kind: VoiceKind; start: number; end: number }> = [];
  let cursor = start;
  for (const [a, b] of ranges) {
    if (b <= start || a >= end) continue;
    const from = Math.max(a, start);
    if (from > cursor) parts.push({ kind: 'narration', start: cursor, end: from });
    parts.push({ kind: 'dialogue', start: from, end: Math.min(b, end) });
    cursor = Math.min(b, end);
  }
  if (cursor < end) parts.push({ kind: 'narration', start: cursor, end });
  return parts.filter((p) => /[\p{L}\p{N}]/u.test(text.slice(p.start, p.end)));
}
