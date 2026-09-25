import type { Classification, SectionKind } from './classification/classify.js';
import { cleanSections, type ReadingNote } from './cleaning/clean.js';
import type { NavigationSource } from './navigation/types.js';
import { narrateSections, type Sentence } from './narration/narrate.js';
import type { NarrationOptions } from './narration/rules.js';
import { openEpub, type OpenEpubOptions } from './open-epub.js';
import type { CoverImage } from './package/cover.js';
import { buildReport, type ProcessingReport } from './report/report.js';
import { readStructure, type StructureOptions } from './structure.js';

/**
 * Versión del pipeline. Se persiste en `Book.pipeline_version` para poder
 * reprocesar los libros cuando cambian las reglas de limpieza.
 */
export const PIPELINE_VERSION = 1;

export interface PipelineOptions extends OpenEpubOptions, StructureOptions {
  narration?: Partial<NarrationOptions>;
  /** Idioma a usar si el libro no lo declara y no se puede detectar. */
  fallbackLanguage?: string;
}

export interface ProcessedChapter {
  orderIndex: number;
  title: string;
  /** Nivel inmediatamente superior del índice ("Parte II"), o null. */
  parentTitle: string | null;
  ancestors: string[];
  kind: SectionKind;
  classification: Classification;
  /** HTML de lectura: bloques con `data-b`, llamadas a nota `<a data-lectio-note>`. */
  contentHtml: string;
  sentences: Sentence[];
  notes: ReadingNote[];
  /** Caracteres de narración (lo que se envía al TTS). */
  characterCount: number;
  /** Rutas (dentro del EPUB) de las imágenes que usa el capítulo. */
  resources: string[];
}

export interface ProcessedBook {
  metadata: {
    title: string | null;
    authors: string[];
    language: string;
    identifier: string | null;
  };
  cover: CoverImage | null;
  navSource: NavigationSource;
  chapters: ProcessedChapter[];
  /** Imágenes referenciadas por los capítulos, por ruta. */
  resources: Map<string, { mediaType: string; data: Buffer }>;
  report: ProcessingReport;
  pipelineVersion: number;
}

/**
 * Procesa un EPUB completo (etapas 1 a 9). Lógica pura: recibe los bytes del archivo y
 * devuelve objetos, sin red ni sistema de archivos. Lanza `PipelineError` si el libro
 * no se puede procesar (DRM, archivo dañado, sin texto...).
 */
export async function processEpub(
  file: Buffer,
  options: PipelineOptions = {},
): Promise<ProcessedBook> {
  const started = performance.now();
  const opened = await openEpub(file, options);
  const structure = readStructure(opened, options);
  const cleaned = cleanSections(structure, opened.archive);

  const detected = opened.metadata.language
    ? null
    : detectLanguage(cleaned.sections.flatMap((s) => s.blocks.map((b) => b.textContent ?? '')));
  const language = opened.metadata.language ?? detected ?? options.fallbackLanguage ?? 'es';
  const narrated = narrateSections(cleaned.sections, language, options.narration);

  const chapters = narrated.sections.map((section, orderIndex): ProcessedChapter => ({
    orderIndex,
    title: section.title,
    parentTitle: section.ancestors.at(-1) ?? null,
    ancestors: section.ancestors,
    kind: section.kind,
    classification: section.classification,
    contentHtml: section.contentHtml,
    sentences: section.sentences,
    notes: section.notes,
    characterCount: section.characterCount,
    resources: section.resources,
  }));

  const resources = new Map<string, { mediaType: string; data: Buffer }>();
  const mediaTypes = new Map(
    [...opened.package.manifest.values()].map((i) => [i.path, i.mediaType]),
  );
  for (const path of new Set(chapters.flatMap((c) => c.resources))) {
    const data = opened.archive.read(path);
    if (data)
      resources.set(path, { mediaType: mediaTypes.get(path) ?? 'application/octet-stream', data });
  }

  return {
    metadata: { ...opened.metadata, language },
    cover: opened.cover,
    navSource: structure.navigation.source,
    chapters,
    resources,
    pipelineVersion: PIPELINE_VERSION,
    report: buildReport({
      pipelineVersion: PIPELINE_VERSION,
      durationMs: performance.now() - started,
      navSource: structure.navigation.source,
      language: { value: language, source: opened.metadata.language ? 'metadata' : 'detected' },
      sections: narrated.sections,
      cleaning: cleaned.stats,
      narration: narrated.stats,
      warnings: structure.warnings,
    }),
  };
}

const STOPWORDS: Record<string, Set<string>> = {
  es: new Set([
    'el',
    'la',
    'de',
    'que',
    'y',
    'en',
    'los',
    'se',
    'del',
    'las',
    'por',
    'un',
    'con',
    'no',
    'una',
    'su',
    'para',
    'es',
    'al',
    'lo',
  ]),
  en: new Set([
    'the',
    'of',
    'and',
    'to',
    'in',
    'a',
    'is',
    'that',
    'it',
    'was',
    'he',
    'for',
    'with',
    'as',
    'his',
    'on',
    'be',
    'at',
    'by',
    'i',
  ]),
};

/** Detección mínima (español / inglés) por palabras frecuentes, para libros sin `dc:language`. */
export function detectLanguage(texts: string[]): string | null {
  const scores = Object.fromEntries(Object.keys(STOPWORDS).map((l) => [l, 0])) as Record<
    string,
    number
  >;
  let words = 0;
  for (const text of texts) {
    for (const word of text.toLowerCase().match(/\p{L}+/gu) ?? []) {
      words++;
      for (const [language, set] of Object.entries(STOPWORDS))
        if (set.has(word)) scores[language]!++;
      if (words > 20_000) break;
    }
    if (words > 20_000) break;
  }
  const [best] = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return best && best[1] >= 20 ? best[0] : null;
}
