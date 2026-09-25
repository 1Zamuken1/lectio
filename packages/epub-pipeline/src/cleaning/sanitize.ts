import type { EpubArchive } from '../container/archive.js';
import { collapsedText, descendants, isElement, isText, tagName } from '../dom/xhtml.js';
import { resolveHref } from '../paths.js';

/**
 * HTML de lectura por lista blanca. Se construye un árbol nuevo en lugar de limpiar el
 * original: lo que no está permitido explícitamente no pasa.
 *
 * - Etiquetas peligrosas o inútiles para leer (script, style, form, nav...) se descartan
 *   con su contenido.
 * - Contenedores estructurales (div, section, header...) se desenvuelven; si solo tienen
 *   contenido en línea (un verso, una línea de diálogo) se convierten en párrafo.
 * - Solo sobreviven atributos seguros: enlaces externos y a notas, imágenes del libro.
 * - Cada bloque de texto recibe `data-b`: la base para anclar oraciones (etapa 7).
 */

const DROP = new Set([
  'script',
  'style',
  'noscript',
  'template',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'select',
  'textarea',
  'link',
  'meta',
  'head',
  'title',
  'nav',
  'audio',
  'video',
  'canvas',
  'map',
  'area',
]);
const INLINE = new Set([
  'em',
  'strong',
  'i',
  'b',
  'u',
  's',
  'small',
  'sub',
  'sup',
  'abbr',
  'cite',
  'q',
  'code',
  'kbd',
  'var',
  'mark',
  'span',
  'br',
  'a',
  'img',
  'dfn',
  'bdi',
  'bdo',
  'time',
  'wbr',
]);
const BLOCK = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'pre',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'figure',
  'figcaption',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
  'hr',
  'aside',
]);
const STRUCTURAL = new Set([
  'div',
  'section',
  'article',
  'header',
  'footer',
  'main',
  'hgroup',
  'center',
  'body',
  'html',
  'address',
  'details',
  'summary',
]);
const RENAME: Record<string, string> = { del: 's', strike: 's', ins: 'u', tt: 'code' };
/** Contenedores que admiten bloques; si mezclan bloques y texto suelto, el texto se envuelve en <p>. */
const FLOW_CONTAINERS = new Set([
  'section',
  'li',
  'blockquote',
  'aside',
  'dd',
  'td',
  'th',
  'figure',
]);
/** Bloques que reciben `data-b` si no contienen otro bloque de esta lista. */
const TEXT_BLOCKS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'blockquote',
  'pre',
  'dt',
  'dd',
  'figcaption',
  'caption',
  'td',
  'th',
  'aside',
]);

const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan'],
  ol: ['start', 'reversed'],
  li: ['value'],
};

export interface SanitizeResult {
  /** `<section>` con el HTML de lectura. */
  content: Element;
  /** Bloques de texto en orden, con `data-b` = su índice. */
  blocks: Element[];
  /** Imágenes referenciadas (rutas dentro del ZIP). */
  resources: string[];
}

export function sanitizeContent(
  root: Element,
  basePath: string | null,
  archive: EpubArchive,
  options: { markBlocks?: boolean } = {},
): SanitizeResult {
  const doc = root.ownerDocument;
  const resources = new Set<string>();

  const convertChildren = (node: Node, path: string | null): Node[] =>
    Array.from(node.childNodes).flatMap((child) => convert(child, path));

  const convert = (node: Node, path: string | null): Node[] => {
    if (isText(node)) return [doc.createTextNode(node.textContent ?? '')];
    if (!isElement(node)) return [];

    const partPath = node.getAttribute('data-lectio-src');
    if (partPath) return convertChildren(node, partPath);

    const tag = tagName(node);
    if (DROP.has(tag)) return [];
    if (tag === 'svg') return svgImage(node, path);
    if (tag === 'math') {
      const alt = node.getAttribute('alttext');
      return alt ? [doc.createTextNode(alt)] : [];
    }

    const children = convertChildren(node, path);
    if (STRUCTURAL.has(tag)) {
      if (children.some(isBlock)) return children;
      return hasContent(children) ? [element('p', children)] : [];
    }

    const target = RENAME[tag] ?? tag;
    if (!INLINE.has(target) && !BLOCK.has(target)) return children; // desconocida: se desenvuelve

    if (target === 'a') return link(node, children);
    if (target === 'img') return image(node.getAttribute('src'), node.getAttribute('alt'), path);

    const copy = element(target, children);
    for (const name of ALLOWED_ATTRIBUTES[target] ?? []) {
      const value = node.getAttribute(name);
      if (value !== null) copy.setAttribute(name, value);
    }
    return [copy];
  };

  const element = (tag: string, children: Node[]): Element => {
    const created = doc.createElement(tag);
    for (const child of children) created.appendChild(child);
    return created;
  };

  const link = (node: Element, children: Node[]): Node[] => {
    const note = node.getAttribute('data-lectio-note');
    const href = node.getAttribute('href') ?? '';
    if (note) {
      const a = element('a', children);
      a.setAttribute('href', `#${note}`);
      a.setAttribute('data-lectio-note', note);
      return [a];
    }
    if (/^(https?:|mailto:)/i.test(href)) {
      const a = element('a', children);
      a.setAttribute('href', href);
      return [a];
    }
    return children; // enlaces internos del EPUB: no tienen sentido fuera de él
  };

  const image = (src: string | null, alt: string | null, path: string | null): Node[] => {
    const resolved = src && path ? resolveHref(path, src) : null;
    if (!resolved || !archive.has(resolved.path)) return [];
    resources.add(resolved.path);
    const img = doc.createElement('img');
    img.setAttribute('src', resolved.path);
    img.setAttribute('alt', alt ?? '');
    return [img];
  };

  /** Portadas e ilustraciones en SVG suelen ser solo un `<image>`: se convierten en `<img>`. */
  const svgImage = (svg: Element, path: string | null): Node[] => {
    const inner = [...descendants(svg)].find((el) => tagName(el) === 'image');
    const href = inner?.getAttribute('xlink:href') ?? inner?.getAttribute('href') ?? null;
    return image(href, svg.getAttribute('aria-label'), path);
  };

  const section = element('section', convertChildren(root, basePath));
  normalize(section);
  collapseWhitespace(section);
  const blocks = options.markBlocks === false ? [] : markBlocks(section);
  return { content: section, blocks, resources: [...resources] };
}

function isBlock(node: Node): boolean {
  return isElement(node) && BLOCK.has(tagName(node));
}

function hasContent(nodes: Node[]): boolean {
  return nodes.some((n) => (isText(n) ? (n.textContent ?? '').trim() !== '' : isElement(n)));
}

/**
 * Envuelve en <p> el texto suelto que convive con bloques (`<li>texto<p>más</p></li>`),
 * y elimina párrafos y encabezados vacíos que dejó la limpieza.
 */
function normalize(root: Element): void {
  for (const container of [root, ...descendants(root)]) {
    if (!FLOW_CONTAINERS.has(tagName(container))) continue;
    const kids = Array.from(container.childNodes);
    if (!kids.some(isBlock)) continue;

    let run: Node[] = [];
    const flush = (before: Node | null) => {
      if (hasContent(run)) {
        const p = container.ownerDocument.createElement('p');
        for (const node of run) p.appendChild(node);
        container.insertBefore(p, before);
      } else {
        for (const node of run) node.parentNode?.removeChild(node);
      }
      run = [];
    };
    for (const kid of kids) {
      if (isBlock(kid)) flush(kid);
      else run.push(kid);
    }
    flush(null);
  }

  for (const element of [...descendants(root)]) {
    const tag = tagName(element);
    const empty =
      collapsedText(element) === '' &&
      ![...descendants(element)].some((el) => ['img', 'hr'].includes(tagName(el)));
    if ((tag === 'p' || /^h[1-6]$/.test(tag)) && empty) element.remove();
  }
}

/**
 * Colapsa espacios y saltos de línea del XHTML original (salvo en <pre>) y recorta los
 * bordes de cada bloque. Así el texto del DOM es exactamente el que se muestra, y los
 * offsets de las oraciones (etapa 7) coinciden con lo que el lector resalta.
 */
function collapseWhitespace(root: Element): void {
  const walk = (node: Node, preformatted: boolean): void => {
    for (const child of Array.from(node.childNodes)) {
      if (isText(child)) {
        if (!preformatted) child.textContent = (child.textContent ?? '').replace(/\s+/g, ' ');
      } else if (isElement(child)) {
        walk(child, preformatted || tagName(child) === 'pre');
      }
    }
  };
  walk(root, false);

  // Un salto de línea (<br>) separa palabras aunque no haya espacio en el texto
  // ("golondrinas<br>en tu balcón"). Se agrega un espacio antes del <br>: no se ve,
  // y hace que el texto del bloque (y la narración) no pegue las líneas.
  for (const br of [...descendants(root)].filter((el) => tagName(el) === 'br')) {
    const before = br.previousSibling;
    if (!before || !isText(before) || !/\s$/.test(before.textContent ?? '')) {
      br.parentNode?.insertBefore(root.ownerDocument.createTextNode(' '), br);
    }
  }

  for (const block of [root, ...descendants(root)]) {
    const tag = tagName(block);
    if (!TEXT_BLOCKS.has(tag) || tag === 'pre') continue;
    const texts = textNodes(block);
    const first = texts[0];
    const last = texts[texts.length - 1];
    if (first) first.textContent = (first.textContent ?? '').replace(/^\s+/, '');
    if (last) last.textContent = (last.textContent ?? '').replace(/\s+$/, '');
  }
}

function textNodes(root: Node): Node[] {
  const result: Node[] = [];
  for (const child of Array.from(root.childNodes)) {
    if (isText(child)) result.push(child);
    else if (isElement(child) && tagName(child) !== 'br') result.push(...textNodes(child));
  }
  return result;
}

function markBlocks(root: Element): Element[] {
  const blocks = [...descendants(root)].filter(
    (el) =>
      TEXT_BLOCKS.has(tagName(el)) &&
      ![...descendants(el)].some((d) => TEXT_BLOCKS.has(tagName(d))),
  );
  blocks.forEach((block, index) => block.setAttribute('data-b', String(index)));
  return blocks;
}
