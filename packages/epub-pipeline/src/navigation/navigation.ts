import type { PipelineWarning } from '../errors.js';
import type { OpenedEpub } from '../open-epub.js';
import { landmarksFromGuide } from './landmarks.js';
import { parseNavDocument } from './nav-document.js';
import { parseNcx } from './ncx.js';
import type { Landmark, Navigation, TocNode } from './types.js';

/**
 * Elige la tabla de contenidos: nav de EPUB 3 → NCX → respaldo por spine.
 * Un índice es utilizable si al menos una entrada apunta a un documento del spine.
 */
export function resolveNavigation(opened: OpenedEpub, warnings: PipelineWarning[]): Navigation {
  const { archive, package: pkg } = opened;
  const spinePaths = new Set(pkg.spine.map((s) => s.item.path));
  const usable = (toc: TocNode[]) => someTarget(toc, (path) => spinePaths.has(path));

  let landmarks: Landmark[] = [];
  let navAttempted = false;

  if (pkg.navItem) {
    const source = archive.readText(pkg.navItem.path);
    const nav =
      source === undefined ? null : safely(() => parseNavDocument(source, pkg.navItem!.path));
    landmarks = nav?.landmarks ?? [];
    if (nav && usable(nav.toc))
      return { source: 'nav', toc: nav.toc, landmarks: withGuide(landmarks) };
    navAttempted = true;
  }

  if (pkg.ncxItem) {
    const source = archive.readText(pkg.ncxItem.path);
    const toc = source === undefined ? null : safely(() => parseNcx(source, pkg.ncxItem!.path));
    if (toc && usable(toc)) {
      if (navAttempted) {
        warnings.push({
          code: 'TOC_NAV_UNUSABLE',
          message: 'El documento de navegación no tiene un índice utilizable; se usa el NCX.',
        });
      }
      return { source: 'ncx', toc, landmarks: withGuide(landmarks) };
    }
  }

  warnings.push({
    code: 'TOC_FALLBACK_SPINE',
    message: 'El libro no tiene un índice utilizable; cada documento del spine será una sección.',
  });
  return { source: 'spine', toc: [], landmarks: withGuide(landmarks) };

  // Los landmarks de EPUB 3 tienen prioridad; el guide de EPUB 2 completa los tipos que falten.
  function withGuide(fromNav: Landmark[]): Landmark[] {
    const types = new Set(fromNav.map((l) => l.type));
    const all = [...fromNav, ...landmarksFromGuide(pkg.guide).filter((l) => !types.has(l.type))];
    const seen = new Set<string>();
    return all.filter((l) => {
      const key = `${l.type} ${l.path}#${l.fragment ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

function someTarget(toc: TocNode[], predicate: (path: string) => boolean): boolean {
  return toc.some(
    (node) =>
      (node.target !== null && predicate(node.target.path)) || someTarget(node.children, predicate),
  );
}

function safely<T>(parse: () => T): T | null {
  try {
    return parse();
  } catch {
    return null;
  }
}
