import type { ClassificationSignal, SectionKind } from '../classification/classify.js';
import type { RuleStats } from '../cleaning/stats.js';
import type { PipelineWarning } from '../errors.js';
import type { NarratedSection, NarrationStats } from '../narration/narrate.js';
import type { NavigationSource } from '../navigation/types.js';

/** Caracteres por minuto de audio, aproximado para voces neuronales a velocidad normal. */
export const CHARS_PER_MINUTE = 900;

/**
 * Trazabilidad del procesamiento de un libro. Se guarda en `Book.processing_report`:
 * demuestra que la limpieza es medible y sirve para calibrar reglas con el corpus.
 */
export interface ProcessingReport {
  pipelineVersion: number;
  durationMs: number;
  navSource: NavigationSource;
  language: { value: string; source: 'metadata' | 'detected' };
  chapters: Record<SectionKind, number> & { total: number };
  classification: Array<{
    orderIndex: number;
    title: string;
    kind: SectionKind;
    signal: ClassificationSignal;
    confidence: 'high' | 'low';
    evidence: string;
  }>;
  cleaning: RuleStats;
  narration: NarrationStats;
  characters: {
    /** Caracteres de narración de los capítulos narrativos (lo que se enviaría al TTS). */
    narrative: number;
    /** Caracteres de narración de todas las secciones. */
    all: number;
    estimatedMinutes: number;
  };
  warnings: PipelineWarning[];
}

export function buildReport(args: {
  pipelineVersion: number;
  durationMs: number;
  navSource: NavigationSource;
  language: ProcessingReport['language'];
  sections: NarratedSection[];
  cleaning: RuleStats;
  narration: NarrationStats;
  warnings: PipelineWarning[];
}): ProcessingReport {
  const { sections } = args;
  const count = (kind: SectionKind) => sections.filter((s) => s.kind === kind).length;
  const narrative = sections
    .filter((s) => s.kind === 'narrative')
    .reduce((n, s) => n + s.characterCount, 0);

  return {
    pipelineVersion: args.pipelineVersion,
    durationMs: Math.round(args.durationMs),
    navSource: args.navSource,
    language: args.language,
    chapters: {
      total: sections.length,
      narrative: count('narrative'),
      front_matter: count('front_matter'),
      back_matter: count('back_matter'),
      notes: count('notes'),
    },
    classification: sections.map((s, orderIndex) => ({
      orderIndex,
      title: s.title,
      kind: s.kind,
      signal: s.classification.signal,
      confidence: s.classification.confidence,
      evidence: s.classification.evidence,
    })),
    cleaning: args.cleaning,
    narration: args.narration,
    characters: {
      narrative,
      all: sections.reduce((n, s) => n + s.characterCount, 0),
      estimatedMinutes: Math.round(narrative / CHARS_PER_MINUTE),
    },
    warnings: args.warnings,
  };
}
