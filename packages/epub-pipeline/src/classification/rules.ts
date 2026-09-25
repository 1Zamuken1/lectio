/**
 * Reglas de clasificación (etapa 5). Un veredicto `aux` es material auxiliar cuya
 * ubicación decide si es front o back matter (un índice o una página de copyright
 * pueden estar al principio o al final del libro).
 */
export type Verdict = 'narrative' | 'front' | 'back' | 'aux' | 'notes';

/** Tipos semánticos específicos: describen exactamente qué es la sección. */
export const SPECIFIC_TYPES: Readonly<Record<string, Verdict>> = {
  cover: 'front',
  titlepage: 'front',
  halftitlepage: 'front',
  dedication: 'front',
  seriespage: 'front',
  errata: 'front',
  toc: 'aux',
  landmarks: 'aux',
  'page-list': 'aux',
  loi: 'aux',
  lot: 'aux',
  loa: 'aux',
  lov: 'aux',
  'copyright-page': 'aux',
  imprint: 'aux',
  acknowledgments: 'aux',
  contributors: 'aux',
  'other-credits': 'aux',
  // El colofón a veces está al principio (notas del transcriptor, créditos).
  colophon: 'aux',
  index: 'back',
  glossary: 'back',
  bibliography: 'back',
  appendix: 'back',
  footnotes: 'notes',
  endnotes: 'notes',
  rearnotes: 'notes',
  // Texto del autor: aunque esté fuera de los capítulos, se narra.
  chapter: 'narrative',
  subchapter: 'narrative',
  part: 'narrative',
  volume: 'narrative',
  division: 'narrative',
  preface: 'narrative',
  prologue: 'narrative',
  preamble: 'narrative',
  introduction: 'narrative',
  foreword: 'narrative',
  epigraph: 'narrative',
  epilogue: 'narrative',
  afterword: 'narrative',
  conclusion: 'narrative',
};

/** Tipos genéricos: solo dicen en qué zona del libro está la sección. */
export const GENERIC_TYPES: Readonly<Record<string, Verdict>> = {
  frontmatter: 'front',
  bodymatter: 'narrative',
  backmatter: 'back',
};

/**
 * Títulos reconocibles (español e inglés). Se comparan contra el título completo
 * normalizado (minúsculas, sin tildes ni puntuación): "Índice:" → "indice".
 */
const TITLE_RULES: ReadonlyArray<[RegExp, Verdict]> = [
  [
    /^(portada|cubierta|cover|title ?page|pagina de titulo|portadilla|dedicatoria|dedication|creditos|credits|aviso legal|legal notice)$/,
    'front',
  ],
  [/^the project gutenberg e?book of\b/, 'front'],
  // Preliminares legales de las ediciones del Siglo de Oro (Quijote, Lazarillo...).
  [
    /^(tasa|fe de erratas|fee de erratas|testimonio de las erratas|erratas|privilegio|aprobacion|suma del privilegio)$/,
    'front',
  ],
  [/\b(transcriber s|transcriptor|transcripcion) notes?\b|\bnotas? del transcriptor\b/, 'front'],
  [
    /^(indice( general| de contenidos?)?|contenidos?|tabla de contenidos?|sumario|capitulos|table of contents|contents|copyright|derechos de autor|imprint|agradecimientos|acknowledge?ments|lista de ilustraciones|list of illustrations)$/,
    'aux',
  ],
  [
    /^(colophon|colofon|uncopyright|licencia|license|glosario|glossary|bibliografia|bibliography|referencias|references|obras citadas|works cited|sobre el autor|acerca del autor|about the author|del mismo autor|also by .+|otros titulos)$/,
    'back',
  ],
  [/^indice (alfabetico|onomastico|analitico|de nombres|de materias)$|^index$/, 'back'],
  [/project gutenberg.*licen[cs]e|licen[cs]e.*project gutenberg/, 'back'],
  [
    /^(notas|notes|notas al final|notas finales|endnotes|footnotes|notas del (autor|editor|traductor))$/,
    'notes',
  ],
];

export function verdictForTitle(title: string): Verdict | null {
  const normalized = normalizeTitle(title);
  return TITLE_RULES.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}

export function normalizeTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
