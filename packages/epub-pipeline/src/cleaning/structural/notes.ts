import { collapsedText, descendants, semanticTypes, tagName } from '../../dom/xhtml.js';
import { resolveHref } from '../../paths.js';
import type { SpineDocument } from '../../segmentation/documents.js';
import type { Section } from '../../segmentation/sections.js';
import type { RuleStats } from '../stats.js';

/** Nota encontrada: el elemento original y el id estable que usa el lector (`n1`, `n2`...). */
export interface ExtractedNote {
  id: string;
  body: Element;
  /** Documento de origen, para resolver las rutas relativas (imágenes) de la nota. */
  path: string;
}

const NOTE_TYPES = new Set(['footnote', 'endnote', 'rearnote', 'note']);
const NOTE_CONTAINER_TYPES = new Set(['footnotes', 'endnotes', 'rearnotes']);
const BACKLINK_TYPES = new Set(['backlink']);
/** Marca de llamada: "1", "[3]", "(2)", "*", "†", "a". */
const MARKER_TEXT = /^\s*[[(]?(\d{1,3}|[*†‡§¶]|[a-z])[\])]?\s*$/i;
const NOTE_HINT = /note|fn|foot/i;
const NOTE_BODY_TAGS = new Set(['li', 'aside', 'dd']);

/**
 * S4. Las llamadas a nota (`noteref`) se reescriben como enlaces a `#n1`, `#n2`... y las
 * notas se reúnen en una lista del capítulo, para mostrarlas en un popover del lector.
 *
 * - Una nota dentro de la propia sección se extrae del flujo: leída donde está,
 *   interrumpe la frase (y en EPUB con notas al final de cada capítulo, se leería de corrido).
 * - Una nota en otro lugar del libro (una sección "Notas" aparte) se copia, sin tocar
 *   esa sección, que conserva su contenido.
 * - Las notas semánticas sin llamada que las referencie también se extraen del flujo.
 *
 * En una sección que es en sí misma de notas no se extrae nada.
 */
export function extractNotes(
  section: Section & { kind: string },
  documents: ReadonlyMap<string, SpineDocument>,
  stats: RuleStats,
): ExtractedNote[] {
  if (section.kind === 'notes') return [];

  const notes: ExtractedNote[] = [];
  const idByBody = new Map<Element, string>();
  const localBodies = new Set<Element>();

  for (const ref of findNoteRefs(section.content, documents)) {
    let id = idByBody.get(ref.body);
    if (!id) {
      id = `n${notes.length + 1}`;
      idByBody.set(ref.body, id);
      notes.push({ id, body: withoutBacklinks(ref.body, ref.anchor), path: ref.path });
      if (section.content.contains(ref.body)) localBodies.add(ref.body);
    }
    rewriteRef(ref.anchor, id);
    stats.S4_notes[ref.semantic ? 'semantic' : 'heuristic']++;
  }

  // Notas semánticas locales que nadie referencia: también interrumpirían la narración.
  for (const element of [...descendants(section.content)]) {
    if (localBodies.has(element) || !isSemanticNote(element)) continue;
    if ([...localBodies].some((body) => body.contains(element) || element.contains(body))) continue;
    const id = `n${notes.length + 1}`;
    notes.push({ id, body: withoutBacklinks(element, null), path: sourcePath(element) ?? '' });
    localBodies.add(element);
    stats.S4_notes.semantic++;
  }

  for (const body of localBodies) {
    const container = noteContainer(body, section.content);
    body.remove();
    if (container && collapsedTextWithoutHeadings(container) === '') container.remove();
  }
  return notes;
}

interface NoteRef {
  anchor: Element;
  target: Element;
  body: Element;
  path: string;
  semantic: boolean;
}

function findNoteRefs(root: Element, documents: ReadonlyMap<string, SpineDocument>): NoteRef[] {
  const refs: NoteRef[] = [];
  for (const anchor of descendants(root)) {
    if (tagName(anchor) !== 'a') continue;
    const href = anchor.getAttribute('href');
    if (!href || !href.includes('#')) continue;

    const semantic = semanticTypes(anchor).includes('noteref');
    if (!semantic && !looksLikeNoteRef(anchor)) continue;

    const partPath = sourcePath(anchor);
    const target = partPath ? resolveHref(partPath, href) : null;
    if (!target?.fragment) continue;
    const element = findTarget(root, target.path, target.fragment, documents);
    if (!element) continue;
    refs.push({ anchor, target: element, body: noteBody(element), path: target.path, semantic });
  }

  // Los enlaces de vuelta ("[1]" dentro de la nota, que apunta a la llamada) tienen el
  // mismo aspecto que una llamada, y en Gutenberg ambos se apuntan mutuamente. Se
  // distinguen así: el "cuerpo" de un enlace de vuelta es otra llamada (un <a>), y
  // además el enlace de vuelta está dentro del cuerpo de una nota real.
  const anchors = new Set(refs.map((r) => r.anchor));
  const real = refs.filter((ref) => !anchors.has(ref.body) && !ref.body.contains(ref.anchor));
  return real.filter(
    (ref) => !real.some((other) => other.body !== ref.body && other.body.contains(ref.anchor)),
  );
}

function looksLikeNoteRef(anchor: Element): boolean {
  if (!MARKER_TEXT.test(collapsedText(anchor))) return false;
  const parent = anchor.parentElement;
  const inSup =
    (parent && tagName(parent) === 'sup') ||
    [...descendants(anchor)].some((el) => tagName(el) === 'sup');
  const hinted =
    NOTE_HINT.test(anchor.getAttribute('class') ?? '') ||
    NOTE_HINT.test(anchor.getAttribute('id') ?? '') ||
    NOTE_HINT.test(anchor.getAttribute('href') ?? '');
  return inSup || hinted;
}

/** Busca el destino primero en la sección (versión ya cortada) y si no, en el documento original. */
function findTarget(
  root: Element,
  path: string,
  fragment: string,
  documents: ReadonlyMap<string, SpineDocument>,
): Element | null {
  for (const part of Array.from(root.children)) {
    if (part.getAttribute('data-lectio-src') !== path) continue;
    const local = [...descendants(part)].find((el) => el.getAttribute('id') === fragment);
    if (local) return local;
  }
  return documents.get(path)?.byId.get(fragment) ?? null;
}

/**
 * El destino del enlace suele ser la nota misma (`<li id="note-3">`), pero a veces es
 * una etiqueta dentro de ella (`<div class="footnote"><p><a id="Footnote_1">[1]</a> …`).
 */
function noteBody(target: Element): Element {
  if (isSemanticNote(target)) return target;
  let node: Element | null = target;
  for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
    if (node.hasAttribute('data-lectio-src') || tagName(node) === 'body') break;
    if (
      isSemanticNote(node) ||
      NOTE_BODY_TAGS.has(tagName(node)) ||
      NOTE_HINT.test(node.getAttribute('class') ?? '')
    ) {
      return node;
    }
  }
  // Sin contenedor reconocible: el bloque que contiene al destino.
  let block: Element | null = target;
  while (block && !['p', 'div'].includes(tagName(block))) block = block.parentElement;
  return block && !block.hasAttribute('data-lectio-src') ? block : target;
}

function isSemanticNote(element: Element): boolean {
  return semanticTypes(element).some((t) => NOTE_TYPES.has(t));
}

/** Copia de la nota sin los enlaces de vuelta ("↩", o la etiqueta que apunta a la llamada). */
function withoutBacklinks(body: Element, anchor: Element | null): Element {
  const copy = body.cloneNode(true) as Element;
  const anchorId = anchor?.getAttribute('id');
  for (const link of [...descendants(copy)]) {
    if (tagName(link) !== 'a') continue;
    const href = link.getAttribute('href') ?? '';
    const isBacklink =
      semanticTypes(link).some((t) => BACKLINK_TYPES.has(t)) ||
      (anchorId !== null && anchorId !== undefined && href.endsWith(`#${anchorId}`)) ||
      /^\s*(↩|↑|\^)︎?️?\s*$/.test(collapsedText(link));
    if (isBacklink) link.remove();
  }
  return copy;
}

function rewriteRef(anchor: Element, id: string): void {
  for (const attribute of Array.from(anchor.attributes)) anchor.removeAttribute(attribute.name);
  anchor.setAttribute('href', `#${id}`);
  anchor.setAttribute('data-lectio-note', id);
}

/**
 * Contenedor de notas a eliminar si queda vacío. Se prefiere el contenedor semántico
 * (`<section epub:type="footnotes">`, que suele incluir un encabezado "Notas") sobre la
 * lista más cercana, para no dejar ese encabezado huérfano.
 */
function noteContainer(body: Element, root: Element): Element | null {
  let nearest: Element | null = null;
  for (let node = body.parentElement; node && node !== root; node = node.parentElement) {
    if (node.hasAttribute('data-lectio-src')) break;
    if (semanticTypes(node).some((t) => NOTE_CONTAINER_TYPES.has(t))) return node;
    if (
      !nearest &&
      (['ol', 'ul'].includes(tagName(node)) || NOTE_HINT.test(node.getAttribute('class') ?? ''))
    ) {
      nearest = node;
    }
  }
  return nearest;
}

function collapsedTextWithoutHeadings(element: Element): string {
  const copy = element.cloneNode(true) as Element;
  for (const heading of [...descendants(copy)]) {
    if (/^h[1-6]$/.test(tagName(heading))) heading.remove();
  }
  return collapsedText(copy);
}

function sourcePath(element: Element): string | null {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const path = node.getAttribute('data-lectio-src');
    if (path) return path;
  }
  return null;
}
