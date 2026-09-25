import type { GuideReference } from '../package/opf.js';
import type { Landmark } from './types.js';

/**
 * Tipos estructurales de EPUB 3 (vocabulario de `epub:type`) que interesan como
 * landmarks. La etapa de clasificación los usa para distinguir front, body y back matter.
 */
const STRUCTURE_TYPES = new Set([
  'cover',
  'titlepage',
  'frontmatter',
  'bodymatter',
  'backmatter',
  'toc',
  'loi',
  'lot',
  'preface',
  'prologue',
  'introduction',
  'foreword',
  'dedication',
  'epigraph',
  'acknowledgments',
  'copyright-page',
  'colophon',
  'imprint',
  'bibliography',
  'glossary',
  'index',
  'endnotes',
  'footnotes',
  'rearnotes',
  'appendix',
  'afterword',
  'epilogue',
  'conclusion',
]);

/** Equivalencias de los tipos de `<guide>` de EPUB 2. */
const GUIDE_TYPES: Record<string, string> = {
  'title-page': 'titlepage',
  text: 'bodymatter',
  notes: 'endnotes',
  acknowledgements: 'acknowledgments',
};

export function normalizeLandmarkType(type: string): string | null {
  const lower = type.toLowerCase();
  const normalized = GUIDE_TYPES[lower] ?? lower;
  return STRUCTURE_TYPES.has(normalized) ? normalized : null;
}

export function landmarksFromGuide(guide: GuideReference[]): Landmark[] {
  return guide.flatMap((ref) => {
    const type = normalizeLandmarkType(ref.type);
    return type ? [{ type, path: ref.path, fragment: ref.fragment }] : [];
  });
}
