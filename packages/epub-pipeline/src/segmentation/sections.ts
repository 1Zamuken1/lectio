import { descendants, semanticTypes, tagName } from '../dom/xhtml.js';
import { PipelineError, type PipelineWarning } from '../errors.js';
import type { Navigation, TocNode } from '../navigation/types.js';
import { firstHeadingText, type SpineDocument } from './documents.js';
import { sliceRange } from './slice.js';

export interface SegmentationOptions {
  /**
   * Un nodo del índice se divide en sus hijos solo si el tamaño promedio de los hijos
   * alcanza este mínimo. Evita capítulos de un párrafo (ej. 76 rimas de Bécquer).
   */
  minChapterChars: number;
  /** Profundidad máxima del índice que se convierte en capítulos. */
  maxDepth: number;
  /**
   * Si el contenido propio de un nodo dividido (antes de su primer hijo, ej. la
   * portadilla "Parte primera") es menor que esto, se fusiona con el primer hijo
   * en lugar de formar una sección aparte.
   */
  minGroupIntroChars: number;
}

export const DEFAULT_SEGMENTATION_OPTIONS: SegmentationOptions = {
  minChapterChars: 2000,
  maxDepth: 2,
  minGroupIntroChars: 300,
};

export type SectionOrigin = 'toc' | 'spine' | 'leading' | 'non-linear';

/** Tramo del libro entre dos puntos de corte, aún sin clasificar ni limpiar. */
export interface Section {
  title: string;
  /** Títulos de los niveles superiores del índice ("Parte II"). */
  ancestors: string[];
  origin: SectionOrigin;
  linear: boolean;
  /** Documentos del spine que abarca, en orden. */
  documents: string[];
  /** `<section>` con un `<div data-lectio-src="ruta">` por documento abarcado. */
  content: Element;
  textLength: number;
  /** Dónde empieza: documento e `id` del elemento de corte (null = inicio del documento). */
  start: { path: string; id: string | null };
  /**
   * Punto declarado por la entrada del índice. Coincide con `start`, salvo cuando la
   * portadilla de un grupo se fusionó delante (el capítulo I de un libro con portadilla).
   */
  anchor: { path: string; id: string | null };
  /**
   * Tipos semánticos (`epub:type`, roles `doc-*`) del ancla: `element` los del punto de
   * corte y sus contenedores; `document` los del `<body>`/`<html>`.
   */
  semantics: { element: string[]; document: string[] };
}

interface Position {
  doc: number;
  /** null = inicio del documento. */
  element: Element | null;
}

interface Boundary {
  /** Donde empieza la sección (puede ser anterior al ancla si se fusionó una portadilla). */
  position: Position;
  /** Punto que la entrada del índice declara: de ahí se leen sus tipos semánticos. */
  anchor: Position;
  title: string | null;
  ancestors: string[];
  origin: SectionOrigin;
}

/** Entrada del índice con su posición resuelta. */
interface Point {
  title: string;
  /** Posición propia (null si es un grupo sin enlace). */
  own: Position | null;
  /** Posición efectiva: la propia o la del primer descendiente. */
  position: Position;
  children: Point[];
}

export function segmentSections(
  documents: SpineDocument[],
  navigation: Navigation,
  options: SegmentationOptions,
  warnings: PipelineWarning[],
): Section[] {
  if (documents.length === 0) {
    throw new PipelineError('NO_TEXT_CONTENT', 'El libro no tiene documentos de texto legibles.');
  }
  const measure = new Measure(documents);

  const tocBoundaries =
    navigation.source === 'spine'
      ? []
      : boundariesFromToc(navigation.toc, documents, measure, options, warnings);
  const boundaries = withStructuralBoundaries(
    tocBoundaries.length > 0
      ? tocBoundaries
      : documents.map((d) => ({
          position: { doc: d.index, element: null },
          anchor: { doc: d.index, element: null },
          title: null,
          ancestors: [],
          origin: 'spine' as const,
        })),
    documents,
    measure,
  );

  const sections = buildSections(boundaries, documents, measure);
  if (sections.every((s) => s.textLength === 0)) {
    throw new PipelineError('NO_TEXT_CONTENT', 'El libro no contiene texto.');
  }
  return sections;
}

// ---------------------------------------------------------------------------
// Índice → puntos de corte

function boundariesFromToc(
  toc: TocNode[],
  documents: SpineDocument[],
  measure: Measure,
  options: SegmentationOptions,
  warnings: PipelineWarning[],
): Boundary[] {
  const docByPath = new Map(documents.map((d) => [d.path, d]));
  const points = resolvePoints(toc, docByPath, warnings);
  const allPositions = flatten(points)
    .map((p) => p.position)
    .sort(measure.compare);

  const boundaries: Boundary[] = [];
  // Posición heredada de un grupo cuyo contenido propio se fusiona con su primer hijo.
  let pending: Position | null = null;

  const push = (position: Position, title: string, ancestors: string[]) => {
    const start = pending && measure.compare(pending, position) < 0 ? pending : position;
    pending = null;
    boundaries.push({ position: start, anchor: position, title, ancestors, origin: 'toc' });
  };

  const emit = (level: Point[], depth: number, ancestors: string[]) => {
    for (const point of level) {
      if (shouldSplit(point, depth)) {
        const firstChild = point.children[0]!;
        const intro = point.own ? measure.between(point.own, firstChild.position) : 0;
        if (point.own && intro >= options.minGroupIntroChars)
          push(point.own, point.title, ancestors);
        else if (point.own && !pending) pending = point.own;
        emit(point.children, depth + 1, [...ancestors, point.title]);
      } else {
        push(point.position, point.title, ancestors);
      }
    }
  };

  const shouldSplit = (point: Point, depth: number): boolean => {
    if (point.children.length === 0 || depth >= options.maxDepth) return false;
    const sizes = point.children.map((child) => subtreeChars(child, allPositions, measure));
    const average = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    return average >= options.minChapterChars;
  };

  emit(points, 1, []);
  return sortAndDedupe(boundaries, measure, warnings);
}

function resolvePoints(
  nodes: TocNode[],
  docByPath: ReadonlyMap<string, SpineDocument>,
  warnings: PipelineWarning[],
): Point[] {
  return nodes.flatMap((node) => {
    const children = resolvePoints(node.children, docByPath, warnings);
    let own: Position | null = null;

    if (node.target) {
      const doc = docByPath.get(node.target.path);
      if (!doc) {
        warnings.push({
          code: 'TOC_ENTRY_UNRESOLVED',
          message: `La entrada "${node.title}" apunta a ${node.target.path}, que no es un documento del libro.`,
          details: { title: node.title, path: node.target.path },
        });
      } else {
        const { fragment } = node.target;
        const element = fragment ? (doc.byId.get(fragment) ?? null) : null;
        if (fragment && !element) {
          warnings.push({
            code: 'TOC_FRAGMENT_MISSING',
            message: `La entrada "${node.title}" apunta a #${fragment}, que no existe; se usa el inicio del documento.`,
            details: { title: node.title, path: doc.path, fragment },
          });
        }
        own = { doc: doc.index, element };
      }
    }

    const position = own ?? children[0]?.position ?? null;
    return position ? [{ title: node.title, own, position, children }] : [];
  });
}

/** Tamaño del tramo de un subárbol: desde su posición hasta el siguiente punto que no le pertenece. */
function subtreeChars(point: Point, sortedPositions: Position[], measure: Measure): number {
  const own = flatten([point]).map((p) => p.position);
  const last = own.reduce((max, p) => (measure.compare(p, max) > 0 ? p : max), point.position);
  const next = sortedPositions.find((p) => measure.compare(p, last) > 0) ?? null;
  return measure.between(point.position, next);
}

function sortAndDedupe(
  boundaries: Boundary[],
  measure: Measure,
  warnings: PipelineWarning[],
): Boundary[] {
  const sorted = [...boundaries].sort((a, b) => measure.compare(a.position, b.position));
  if (sorted.some((b, i) => b !== boundaries[i])) {
    warnings.push({
      code: 'TOC_ORDER_MISMATCH',
      message:
        'El orden del índice no coincide con el orden de lectura; se usa el orden de lectura.',
    });
  }
  return sorted.filter((boundary, i) => {
    const previous = sorted[i - 1];
    if (!previous || measure.compare(previous.position, boundary.position) !== 0) return true;
    warnings.push({
      code: 'TOC_DUPLICATE_TARGET',
      message: `"${boundary.title}" apunta al mismo lugar que "${previous.title}"; se conserva la primera.`,
      details: { title: boundary.title, keptTitle: previous.title },
    });
    return false;
  });
}

/**
 * Cortes que no vienen del índice:
 * - el contenido previo a la primera entrada (portadas, avisos) forma su propia sección;
 * - los documentos `linear="no"` quedan aislados, sin mezclarse con el capítulo anterior;
 * - en las zonas sin entradas de índice, cada documento es su propia sección. Fusionar
 *   documentos solo tiene sentido detrás de un capítulo (divisiones de Calibre); una
 *   portada, un copyright y un índice seguidos deben poder clasificarse por separado.
 */
function withStructuralBoundaries(
  boundaries: Boundary[],
  documents: SpineDocument[],
  measure: Measure,
): Boundary[] {
  const result = [...boundaries];
  const has = (position: Position) =>
    result.some((b) => measure.compare(b.position, position) === 0);
  const start: Position = { doc: 0, element: null };

  const add = (position: Position, origin: SectionOrigin) =>
    result.push({ position, anchor: position, title: null, ancestors: [], origin });

  if (!has(start)) add(start, 'leading');
  for (const doc of documents) {
    if (doc.linear) continue;
    const here: Position = { doc: doc.index, element: null };
    if (!has(here)) add(here, 'non-linear');
    const next = documents[doc.index + 1];
    const after: Position = { doc: doc.index + 1, element: null };
    if (next?.linear && !has(after)) add(after, 'spine');
  }

  for (const doc of documents) {
    const here: Position = { doc: doc.index, element: null };
    if (has(here)) continue;
    const covering = result
      .filter((b) => measure.compare(b.position, here) < 0)
      .reduce<Boundary | null>(
        (last, b) => (!last || measure.compare(b.position, last.position) > 0 ? b : last),
        null,
      );
    if (covering && covering.origin !== 'toc') {
      add(here, covering.origin === 'leading' ? 'leading' : 'spine');
    }
  }
  return result.sort((a, b) => measure.compare(a.position, b.position));
}

// ---------------------------------------------------------------------------
// Puntos de corte → secciones

function buildSections(
  boundaries: Boundary[],
  documents: SpineDocument[],
  measure: Measure,
): Section[] {
  const sections: Section[] = [];

  boundaries.forEach((boundary, i) => {
    const start = boundary.position;
    const end = boundaries[i + 1]?.position ?? null;
    const startDoc = documents[start.doc]!;
    const anchorDoc = documents[boundary.anchor.doc]!;
    const content = startDoc.document.createElement('section');
    const spanned: string[] = [];

    const lastDoc = end ? end.doc : documents.length - 1;
    for (let d = start.doc; d <= lastDoc; d++) {
      const doc = documents[d]!;
      // El tramo termina justo al inicio de este documento: no aporta nada.
      if (end && d === end.doc && end.element === null) break;
      const from = d === start.doc ? start.element : null;
      const to = end && d === end.doc ? end.element : null;
      const nodes = sliceRange(doc.body, from, to);
      if (nodes.length === 0) continue;

      const part = startDoc.document.createElement('div');
      part.setAttribute('data-lectio-src', doc.path);
      for (const node of nodes) part.appendChild(node);
      content.appendChild(part);
      spanned.push(doc.path);
    }

    const textLength = measure.between(start, end);
    if (textLength === 0 && !hasImage(content)) return;

    sections.push({
      title:
        boundary.title ||
        firstHeadingText(content) ||
        documentTitle(startDoc) ||
        `Sección ${sections.length + 1}`,
      ancestors: boundary.ancestors,
      origin: boundary.origin,
      linear: startDoc.linear,
      documents: spanned,
      content,
      textLength,
      start: { path: startDoc.path, id: start.element?.getAttribute('id') ?? null },
      anchor: { path: anchorDoc.path, id: boundary.anchor.element?.getAttribute('id') ?? null },
      semantics: sectionSemantics(anchorDoc, boundary.anchor.element),
    });
  });

  return sections;
}

/**
 * Con un punto de corte, sus tipos y los de sus ancestros (el `<h2 id>` suele estar
 * dentro de `<section epub:type="chapter">`). Al inicio del documento, los de la
 * cadena de primeros hijos (`<body>` > `<section epub:type="titlepage">` > ...).
 */
function sectionSemantics(doc: SpineDocument, start: Element | null) {
  const element: string[] = [];
  if (start) {
    for (let node: Element | null = start; node && node !== doc.body; node = node.parentElement) {
      element.push(...semanticTypes(node));
    }
  } else {
    let node = doc.body.firstElementChild;
    for (let depth = 0; node && depth < 4; depth++, node = node.firstElementChild) {
      element.push(...semanticTypes(node));
    }
  }
  const html = doc.body.parentElement;
  const document = [...semanticTypes(doc.body), ...(html ? semanticTypes(html) : [])];
  return { element: [...new Set(element)], document: [...new Set(document)] };
}

function hasImage(root: Element): boolean {
  for (const element of descendants(root)) {
    if (['img', 'image', 'svg'].includes(tagName(element))) return true;
  }
  return false;
}

function documentTitle(doc: SpineDocument): string | null {
  const title = doc.document.querySelector('title')?.textContent?.replace(/\s+/g, ' ').trim();
  return title || null;
}

function flatten(points: Point[]): Point[] {
  return points.flatMap((p) => [p, ...flatten(p.children)]);
}

/** Comparación y medición de posiciones en el flujo global de documentos. */
class Measure {
  readonly #starts: number[] = [];
  readonly #total: number;

  constructor(private readonly documents: SpineDocument[]) {
    let offset = 0;
    for (const doc of documents) {
      this.#starts.push(offset);
      offset += doc.totalChars;
    }
    this.#total = offset;
  }

  compare = (a: Position, b: Position): number => {
    if (a.doc !== b.doc) return a.doc - b.doc;
    return this.#ordinal(a) - this.#ordinal(b);
  };

  /** Caracteres de texto entre dos posiciones (`end = null` es el final del libro). */
  between(start: Position, end: Position | null): number {
    return (end ? this.#offset(end) : this.#total) - this.#offset(start);
  }

  #offset(position: Position): number {
    const doc = this.documents[position.doc]!;
    const local = position.element ? (doc.charsBefore.get(position.element) ?? 0) : 0;
    return this.#starts[position.doc]! + local;
  }

  #ordinal(position: Position): number {
    if (!position.element) return -1;
    return this.documents[position.doc]!.ordinal.get(position.element) ?? -1;
  }
}
