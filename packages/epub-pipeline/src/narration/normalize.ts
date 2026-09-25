/**
 * Normalización para TTS (etapa 9). Lo que no se toca a propósito: números, fechas y
 * abreviaturas del cuerpo. Los motores neuronales los verbalizan mejor que cualquier
 * regla propia, y reescribirlos arriesga introducir errores.
 */

const INVISIBLE = /[\u00AD\u200B-\u200D\u2060\uFEFF]/g;
// eslint-disable-next-line no-control-regex -- se buscan justamente caracteres de control
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function normalizeNarration(text: string, vocabulary: ReadonlySet<string>): string {
  const cleaned = text.normalize('NFC').replace(INVISIBLE, '').replace(CONTROL, '');
  // Primero la división silábica ("conver- sión"): tiene la misma forma que un guion de inciso.
  const joined = softenDashes(joinHyphenation(cleaned, vocabulary));
  const collapsed = joined
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?…»”)])/g, '$1')
    .trim();
  // Una oración sin letras ni cifras ("* * *", "—") no tiene nada que narrar.
  return /[\p{L}\p{N}]/u.test(collapsed) ? collapsed : '';
}

/** Raya, semirraya y barra horizontal: las que se usan para diálogos e incisos. */
const DASH = '[—–―]';

/**
 * Rayas de diálogo e inciso ("—Vamos —dijo el viajero—, humanidad tenemos"). Edge TTS
 * hace en cada raya una pausa de coma (~200 ms, medido): en un diálogo con acotación
 * se acumulan varias seguidas y la lectura suena entrecortada. Se quitan de la
 * narración; las comas se conservan porque dan la entonación.
 *
 * - raya inicial del parlamento: se elimina;
 * - raya pegada a un signo de cierre ("gozo—,"): se elimina, el signo se conserva;
 * - raya entre palabras: se convierte en espacio.
 *
 * El guion común solo se trata como raya cuando está separado por espacios
 * ("dijo - con voz grave"): entre dos letras ("franco-alemán") es parte de la palabra.
 */
function softenDashes(text: string): string {
  return text
    .replace(new RegExp(`^\\s*${DASH}+\\s*`, 'u'), '')
    .replace(new RegExp(`\\s*${DASH}+\\s*(?=[,.;:!?…»”’")])`, 'gu'), '')
    .replace(new RegExp(`\\s*${DASH}+\\s*`, 'gu'), ' ')
    .replace(/(?<=\p{L})\s+-\s+(?=\p{L})|(?<=\p{L})-\s+(?=[\p{L}«"“])|(?<=\s)-(?=\p{L})/gu, ' ');
}

/**
 * Guiones de división silábica de EPUB convertidos desde PDF ("conver- sión"). Se unen
 * solo si la palabra completa aparece en el libro: "bien- estar" no se une si el libro
 * no usa "bienestar", y los compuestos reales con guion quedan como están.
 */
function joinHyphenation(text: string, vocabulary: ReadonlySet<string>): string {
  return text.replace(/(\p{L}+)-\s+(\p{Ll}+)/gu, (match, left: string, right: string) =>
    vocabulary.has(`${left}${right}`.toLowerCase()) ? `${left}${right}` : match,
  );
}

/** Palabras del libro (en minúsculas), para validar la unión de guiones. */
export function buildVocabulary(texts: Iterable<string>): Set<string> {
  const vocabulary = new Set<string>();
  for (const text of texts) {
    for (const word of text.match(/\p{L}+/gu) ?? []) vocabulary.add(word.toLowerCase());
  }
  return vocabulary;
}

const ROMAN = /^(?=[MDCLXVI])M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
const ROMAN_VALUES: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
const NUMBERED_WORDS =
  /^(capítulo|capitulo|parte|libro|tomo|canto|carta|sección|seccion|acto|escena|chapter|part|book|volume|section|act|scene|canto|letter)$/i;

/**
 * Título anunciado al comenzar un capítulo: "Segunda parte. Capítulo 74. De cómo…".
 * - Los números romanos pasan a arábigos solo en contextos seguros ("Capítulo IV",
 *   "-XXI-", "V." al inicio, o un título que es solo el número): "Luis XIV" o el
 *   pronombre inglés "I" no se tocan.
 * - Los títulos en mayúsculas se pasan a minúsculas con inicial mayúscula: algunos
 *   motores deletrean las palabras en mayúsculas como si fueran siglas.
 */
export function announcementFor(title: string, parent: string | null): string {
  const parts = [parent, title].filter((t): t is string => Boolean(t)).map(normalizeTitle);
  return parts.map((p) => (/[.!?…:]$/.test(p) ? p : `${p}.`)).join(' ');
}

export function normalizeTitle(title: string): string {
  // Primero los romanos: tras pasar a minúsculas, "XXI." sería "Xxi." y ya no se reconocería.
  let result = convertRomanNumerals(title.replace(/\s+/g, ' ').trim()).replace(
    /^-\s*(\d+)\s*-\s*/,
    '$1. ',
  );
  if (!/\p{Ll}/u.test(result) && /\p{Lu}.*\p{Lu}/u.test(result)) {
    // Mayúscula al inicio y tras un punto: "Capítulo 74. De cómo cayó malo".
    result = result
      .toLowerCase()
      .replace(
        /(^|[.!?:]\s+)(\P{L}*)(\p{L})/gu,
        (_, stop: string, prefix: string, first: string) => stop + prefix + first.toUpperCase(),
      );
  }
  return result;
}

function convertRomanNumerals(title: string): string {
  const tokens = title.split(/(\s+)/);
  const words = tokens.filter((t) => !/^\s+$/.test(t));
  return tokens
    .map((token, i) => {
      const match = /^([-(]?)([MDCLXVI]+|[mdclxvi]+)([-.):]?)$/.exec(token);
      if (!match) return token;
      const [, open, numeral, close] = match as unknown as [string, string, string, string];
      const upper = numeral.toUpperCase();
      if (!ROMAN.test(upper)) return token;
      const previousWord = tokens
        .slice(0, i)
        .reverse()
        .find((t) => !/^\s+$/.test(t));
      const isFirst = previousWord === undefined;
      const afterNumberedWord = previousWord !== undefined && NUMBERED_WORDS.test(previousWord);
      // En minúsculas, solo tras "capítulo", "parte"...: "di" o "mix" son palabras.
      if (numeral !== upper && !afterNumberedWord) return token;
      const safe =
        words.length === 1 ||
        afterNumberedWord ||
        (isFirst && (open === '-' || close === '.' || close === '-' || close === ':'));
      // "I" suelto al inicio sin puntuación es el pronombre inglés.
      if (!safe || (upper === 'I' && isFirst && !close && words.length > 1)) return token;
      return `${open}${romanToNumber(upper)}${close}`;
    })
    .join('');
}

function romanToNumber(roman: string): number {
  let total = 0;
  for (let i = 0; i < roman.length; i++) {
    const value = ROMAN_VALUES[roman[i]!]!;
    const next = ROMAN_VALUES[roman[i + 1] ?? ''] ?? 0;
    total += value < next ? -value : value;
  }
  return total;
}
