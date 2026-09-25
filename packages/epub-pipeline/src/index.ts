/**
 * Versión del pipeline. Se persiste en `Book.pipeline_version` para poder
 * reprocesar los libros cuando cambian las reglas de limpieza.
 */
export const PIPELINE_VERSION = 1;

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
