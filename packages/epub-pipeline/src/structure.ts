import {
  classifySections,
  DEFAULT_CLASSIFICATION_OPTIONS,
  type ClassificationOptions,
  type ClassifiedSection,
} from './classification/classify.js';
import type { PipelineWarning } from './errors.js';
import { resolveNavigation } from './navigation/navigation.js';
import type { Navigation } from './navigation/types.js';
import type { OpenedEpub } from './open-epub.js';
import { loadSpineDocuments } from './segmentation/documents.js';
import {
  DEFAULT_SEGMENTATION_OPTIONS,
  segmentSections,
  type SegmentationOptions,
} from './segmentation/sections.js';

export interface StructureOptions {
  segmentation?: Partial<SegmentationOptions>;
  classification?: Partial<ClassificationOptions>;
}

export interface BookStructure {
  navigation: Navigation;
  sections: ClassifiedSection[];
  /** Warnings de las etapas 1 a 5. */
  warnings: PipelineWarning[];
}

/** Etapas 3 (navegación), 4 (segmentación) y 5 (clasificación) sobre un EPUB ya abierto. */
export function readStructure(opened: OpenedEpub, options: StructureOptions = {}): BookStructure {
  const warnings = [...opened.warnings];
  const navigation = resolveNavigation(opened, warnings);
  const documents = loadSpineDocuments(opened, warnings);
  const sections = segmentSections(
    documents,
    navigation,
    { ...DEFAULT_SEGMENTATION_OPTIONS, ...options.segmentation },
    warnings,
  );
  const classified = classifySections(sections, navigation, {
    ...DEFAULT_CLASSIFICATION_OPTIONS,
    ...options.classification,
  });
  return { navigation, sections: classified, warnings };
}
