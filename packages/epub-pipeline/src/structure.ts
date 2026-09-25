import type { PipelineWarning } from './errors.js';
import { resolveNavigation } from './navigation/navigation.js';
import type { Navigation } from './navigation/types.js';
import type { OpenedEpub } from './open-epub.js';
import { loadSpineDocuments } from './segmentation/documents.js';
import {
  DEFAULT_SEGMENTATION_OPTIONS,
  segmentSections,
  type Section,
  type SegmentationOptions,
} from './segmentation/sections.js';

export interface BookStructure {
  navigation: Navigation;
  sections: Section[];
  /** Warnings de las etapas 1 a 4. */
  warnings: PipelineWarning[];
}

/** Etapas 3 (navegación) y 4 (segmentación) sobre un EPUB ya abierto. */
export function readStructure(
  opened: OpenedEpub,
  options: Partial<SegmentationOptions> = {},
): BookStructure {
  const warnings = [...opened.warnings];
  const navigation = resolveNavigation(opened, warnings);
  const documents = loadSpineDocuments(opened, warnings);
  const sections = segmentSections(
    documents,
    navigation,
    { ...DEFAULT_SEGMENTATION_OPTIONS, ...options },
    warnings,
  );
  return { navigation, sections, warnings };
}
