import type { PipelineWarning } from '../errors.js';
import type { DcElement, PackageDocument } from './opf.js';

export interface BookMetadata {
  title: string | null;
  authors: string[];
  /**
   * Código ISO 639-1 (`es`, `en`) cuando se puede normalizar; si no, la subetiqueta
   * primaria tal como viene. null si el OPF no declara idioma (se detectará a partir
   * del texto en una etapa posterior).
   */
  language: string | null;
  /** Valor original de `dc:language`. */
  languageTag: string | null;
  identifier: string | null;
}

/** ISO 639-2 → ISO 639-1 para los idiomas más probables del corpus. */
const ISO_639_2_TO_1: Record<string, string> = {
  spa: 'es',
  eng: 'en',
  fre: 'fr',
  fra: 'fr',
  ger: 'de',
  deu: 'de',
  ita: 'it',
  por: 'pt',
  cat: 'ca',
  glg: 'gl',
  baq: 'eu',
  eus: 'eu',
  lat: 'la',
};

/** Roles MARC que cuentan como autor. Sin rol declarado también se asume autor. */
const AUTHOR_ROLES = new Set(['aut']);

export function extractMetadata(pkg: PackageDocument, warnings: PipelineWarning[]): BookMetadata {
  const title = pickTitle(pkg);
  if (!title) {
    warnings.push({ code: 'TITLE_MISSING', message: 'El OPF no declara título (dc:title).' });
  }

  const languageTag = pkg.metadata.languages[0] ?? null;
  if (!languageTag) {
    warnings.push({ code: 'LANGUAGE_MISSING', message: 'El OPF no declara idioma (dc:language).' });
  }

  return {
    title,
    authors: pickAuthors(pkg),
    language: languageTag ? normalizeLanguage(languageTag) : null,
    languageTag,
    identifier: pkg.metadata.identifiers[0] ?? null,
  };
}

export function normalizeLanguage(tag: string): string {
  const primary = (tag.trim().split(/[-_]/)[0] ?? '').toLowerCase();
  return ISO_639_2_TO_1[primary] ?? primary;
}

/** EPUB 3 puede marcar el título principal con `<meta refines="#id" property="title-type">main</meta>`. */
function pickTitle(pkg: PackageDocument): string | null {
  const { titles } = pkg.metadata;
  const main = titles.find((t) => refinement(pkg, t, 'title-type') === 'main');
  return (main ?? titles[0])?.value || null;
}

function pickAuthors(pkg: PackageDocument): string[] {
  const creators = pkg.metadata.creators.filter((c) => c.value);
  const withRole = creators.map((c) => ({ name: c.value, role: roleOf(pkg, c) }));
  const authors = withRole.filter((c) => c.role === null || AUTHOR_ROLES.has(c.role));
  // Si todos tienen roles distintos de autor (ej. solo "edt"), mejor mostrar algo que nada.
  const chosen = authors.length > 0 ? authors : withRole;
  return [...new Set(chosen.map((c) => c.name))];
}

function roleOf(pkg: PackageDocument, creator: DcElement): string | null {
  return (creator.role ?? refinement(pkg, creator, 'role'))?.toLowerCase() ?? null;
}

function refinement(pkg: PackageDocument, element: DcElement, property: string): string | null {
  if (!element.id) return null;
  const meta = pkg.metadata.metas.find(
    (m) => m.refines === `#${element.id}` && m.property === property,
  );
  return meta?.value || null;
}
