import { descendants, findFirst, isElement, isText, parseXhtml, tagName } from '../dom/xhtml.js';
import type { PipelineWarning } from '../errors.js';
import type { OpenedEpub } from '../open-epub.js';

const CONTENT_MEDIA_TYPES = new Set(['application/xhtml+xml', 'text/html']);

/** Documento de contenido del spine, parseado e indexado. */
export interface SpineDocument {
  /** Posición en el flujo de documentos (no en el spine original: se omiten los no XHTML). */
  index: number;
  path: string;
  linear: boolean;
  document: Document;
  body: Element;
  /** Elementos con `id` (o `name`, en anclas antiguas) para resolver fragmentos. */
  byId: ReadonlyMap<string, Element>;
  /** Caracteres de texto antes de cada elemento, para medir rangos sin cortar el DOM. */
  charsBefore: ReadonlyMap<Element, number>;
  /** Orden de documento de cada elemento. */
  ordinal: ReadonlyMap<Element, number>;
  totalChars: number;
}

export function loadSpineDocuments(
  opened: OpenedEpub,
  warnings: PipelineWarning[],
): SpineDocument[] {
  const documents: SpineDocument[] = [];
  for (const spineItem of opened.package.spine) {
    const { path, mediaType } = spineItem.item;
    // Imágenes o SVG sueltos en el spine no aportan texto.
    if (!CONTENT_MEDIA_TYPES.has(mediaType)) continue;

    const source = opened.archive.readText(path);
    const document = source === undefined ? null : tryParse(source);
    const body = document && findFirst(document, (el) => tagName(el) === 'body');
    if (!document || !body) {
      warnings.push({
        code: 'DOCUMENT_UNREADABLE',
        message: `No se pudo leer el documento ${path}; se omite.`,
        details: { path },
      });
      continue;
    }
    documents.push({
      index: documents.length,
      path,
      linear: spineItem.linear,
      document,
      body,
      ...indexBody(body),
    });
  }
  return documents;
}

function indexBody(body: Element) {
  const byId = new Map<string, Element>();
  const charsBefore = new Map<Element, number>();
  const ordinal = new Map<Element, number>();
  let chars = 0;
  let order = 0;

  const walk = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (isText(child)) {
        chars += (child.textContent ?? '').replace(/\s+/g, ' ').trim().length;
      } else if (isElement(child)) {
        charsBefore.set(child, chars);
        ordinal.set(child, order++);
        const id =
          child.getAttribute('id') ?? (tagName(child) === 'a' ? child.getAttribute('name') : null);
        if (id && !byId.has(id)) byId.set(id, child);
        walk(child);
      }
    }
  };
  walk(body);
  return { byId, charsBefore, ordinal, totalChars: chars };
}

function tryParse(source: string): Document | null {
  try {
    return parseXhtml(source);
  } catch {
    return null;
  }
}

/** Primer encabezado del contenido, para titular secciones que no vienen del índice. */
export function firstHeadingText(root: Node): string | null {
  for (const element of descendants(root)) {
    if (/^h[1-6]$/.test(tagName(element))) {
      const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (text) return text;
    }
  }
  return null;
}
