// Punto de entrada principal: el libro completo procesado (etapas 1 a 9).
export {
  detectLanguage,
  PIPELINE_VERSION,
  processEpub,
  type PipelineOptions,
  type ProcessedBook,
  type ProcessedChapter,
} from './process.js';
export { CHARS_PER_MINUTE, type ProcessingReport } from './report/report.js';

// Etapas individuales, para depurar o probar por separado.
export { openEpub, type OpenEpubOptions, type OpenedEpub } from './open-epub.js';
export {
  PipelineError,
  type PipelineErrorCode,
  type PipelineWarning,
  type PipelineWarningCode,
} from './errors.js';
export {
  DEFAULT_ARCHIVE_LIMITS,
  type ArchiveLimits,
  type EpubArchive,
} from './container/archive.js';
export type { DrmScheme } from './container/drm.js';
export type { BookMetadata } from './package/metadata.js';
export type { CoverImage, CoverSource } from './package/cover.js';
export type { GuideReference, ManifestItem, PackageDocument, SpineItem } from './package/opf.js';
export { readStructure, type BookStructure, type StructureOptions } from './structure.js';
export {
  DEFAULT_CLASSIFICATION_OPTIONS,
  type Classification,
  type ClassificationOptions,
  type ClassificationSignal,
  type ClassifiedSection,
  type SectionKind,
} from './classification/classify.js';
export type { Landmark, Navigation, NavigationSource, TocNode } from './navigation/types.js';
export {
  DEFAULT_SEGMENTATION_OPTIONS,
  type Section,
  type SectionOrigin,
  type SegmentationOptions,
} from './segmentation/sections.js';
export { cleanSections, type CleanedSection, type ReadingNote } from './cleaning/clean.js';
export type { RuleStat, RuleStats, StructuralRule } from './cleaning/stats.js';
export type { SpineDocument } from './segmentation/documents.js';
export {
  narrateSections,
  type NarratedSection,
  type NarrationStats,
  type Sentence,
  type VoicePart,
} from './narration/narrate.js';
export { dialogueRanges, type VoiceKind } from './narration/dialogue.js';
export {
  DEFAULT_NARRATION_OPTIONS,
  type NarrationOptions,
  type NarrationRule,
} from './narration/rules.js';

// Audio (etapas 10 y 11): troceado para el TTS y alineación. Sin red: el proveedor es un puerto.
export { buildAlignment, buildChunks, type AudioChunk } from './audio/chunks.js';
export { alignVoiceUnits, buildVoiceUnits, type PauseKind, type VoiceUnit } from './audio/units.js';
export type { Alignment, TtsBoundary, TtsProvider, TtsResult } from './audio/tts.js';
