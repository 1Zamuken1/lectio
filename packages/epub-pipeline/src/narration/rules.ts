/**
 * Reglas de limpieza de narración (etapa 8). Se aplican a cada oración por separado y
 * nunca al texto de lectura. Son las reglas con más riesgo de falsos positivos, así que
 * cada una es conservadora, desactivable y cuenta sus coincidencias para el reporte.
 */

export type NarrationRule = 'N1_noterefs' | 'N2_dois' | 'N3_urls' | 'N4_citations' | 'N5_legal';

export interface NarrationOptions {
  dois: boolean;
  urls: boolean;
  citations: boolean;
  legal: boolean;
}

export const DEFAULT_NARRATION_OPTIONS: NarrationOptions = {
  dois: true,
  urls: true,
  citations: true,
  legal: true,
};

const DOI = /\b(?:doi:\s*)?10\.\d{4,9}\/[^\s)\]]+/gi;
const URL = /\b(?:https?:\/\/|www\.)[^\s)\]]+|\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi;

/**
 * Cita parentética: "(García et al., 2021, p. 112)", "(Smith & Jones, 2019a; Pérez, 2020)".
 * Dos condiciones, ambas necesarias:
 * 1. El paréntesis entero tiene la forma autor(es) + año (+ páginas).
 * 2. Hay un indicio fuerte de cita: "et al.", dos autores, varias citas con ";" o páginas.
 * "(Madrid, 1605)" cumple la forma pero no tiene indicio fuerte: una novela puede decir
 * dónde y cuándo ocurrió algo, así que se conserva. "(1984)" ni siquiera tiene la forma.
 */
const AUTHOR = String.raw`\p{Lu}[\p{L}'’-]+(?:\s+(?:de|del|van|von|da|di|la|le)\s+\p{Lu}[\p{L}'’-]+)?`;
const AUTHORS = String.raw`${AUTHOR}(?:\s+et\s+al\.?|\s*(?:&|y|and)\s*${AUTHOR})?`;
const YEAR = String.raw`(?:1[5-9]|20)\d{2}[a-z]?`;
const PAGES = String.raw`(?:,\s*(?:pp?|págs?)\.\s*\d+(?:\s*[-–]\s*\d+)?)`;
const CITATION = String.raw`${AUTHORS},?\s+${YEAR}${PAGES}?`;
const CITATION_GROUP = new RegExp(String.raw`\s*\((${CITATION}(?:\s*;\s*${CITATION})*)\)`, 'gu');

function isStrongCitation(inner: string): boolean {
  return (
    /\bet\s+al\b/.test(inner) ||
    /\s(?:&|y|and)\s/.test(inner) ||
    inner.includes(';') ||
    /\b(?:pp?|págs?)\.\s*\d/.test(inner)
  );
}

const ISBN = /^\s*ISBN(?:-1[03])?:?\s*[\dXx][\d\s-]{8,}[\dXx]\s*\.?\s*$/i;
const COPYRIGHT = /^\s*(?:©|\(c\)|copyright)\s.*\b(?:1[5-9]|20)\d{2}\b.*$/i;
const RIGHTS = /^\s*(?:todos los derechos reservados|all rights reserved)\.?\s*$/i;

export interface RuleResult {
  text: string;
  removed: number;
}

export function removeDois(text: string): RuleResult {
  return replaceCounting(text, DOI, '');
}

export function removeUrls(text: string): RuleResult {
  return replaceCounting(text, URL, '');
}

export function removeCitations(text: string): RuleResult {
  let removed = 0;
  const result = text.replace(CITATION_GROUP, (match, inner: string) => {
    if (!isStrongCitation(inner)) return match;
    removed++;
    return '';
  });
  return { text: result, removed };
}

/** Oraciones que son solo un ISBN o un aviso legal. */
export function removeLegal(text: string): RuleResult {
  return ISBN.test(text) || COPYRIGHT.test(text) || RIGHTS.test(text)
    ? { text: '', removed: 1 }
    : { text, removed: 0 };
}

function replaceCounting(text: string, pattern: RegExp, replacement: string): RuleResult {
  let removed = 0;
  const result = text.replace(pattern, () => {
    removed++;
    return replacement;
  });
  return { text: result, removed };
}
