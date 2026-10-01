import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import type { Plugin, PreviewServer } from 'vite';
import { headingMatchesTitle } from '../src/reader/heading.js';

/**
 * El prerender de las páginas públicas (frontend §2.1 y §2.4), al final del build: `/`,
 * `/biblioteca` y `/libros/:slug` llevan en el HTML lo que muestran (el catálogo, o la
 * ficha, el índice y el primer capítulo narrativo de un libro), con sus etiquetas para
 * buscadores y para compartir. No hay hidratación: al cargar, React dibuja la app encima
 * (createRoot reemplaza el contenido de #app), y para quien entra por primera vez es el
 * mismo capítulo que abre el lector.
 *
 * También escribe `shell.html` (la página vacía de siempre): la usa el Service Worker sin
 * red y la sirven las rutas de la app (/estudio, /leer), así nunca se ve de pasada el
 * contenido de otra página. Más `sitemap.xml`, `robots.txt`, `_redirects` y `404.html`.
 *
 * Variables: `LECTIO_API_URL` (de dónde leer el catálogo; por defecto la API local),
 * `LECTIO_SITE_URL` (el dominio público: sin él no hay sitemap y las imágenes para
 * compartir van relativas) y `LECTIO_PRERENDER=required` (sin la API, el build falla en
 * vez de seguir sin prerender).
 */

interface BookSummary {
  id: string;
  slug: string | null;
  title: string | null;
  author: string | null;
  language: string | null;
  coverUrl: string | null;
  status: string;
}

interface ChapterSummary {
  id: string;
  orderIndex: number;
  title: string | null;
  kind: string;
  ancestors: string[];
  characterCount: number;
}

interface BookDetail extends BookSummary {
  chapters: ChapterSummary[];
}

interface Chapter {
  id: string;
  title: string | null;
  contentHtml: string;
}

export interface PublicBook {
  detail: BookDetail;
  slug: string;
  first: { summary: ChapterSummary; chapter: Chapter } | null;
}

const TAGLINE = 'Tu biblioteca, leída en voz alta';
const DESCRIPTION =
  'Lectio: lee y escucha libros EPUB con voz neuronal, sincronizados por oración. La biblioteca pública se lee sin cuenta.';
/** Las rutas de la app (con sesión o sin contenido propio): sirven la página vacía. */
const APP_ROUTES = ['/estudio', '/celda', '/leer/*'];

export function prerender(): Plugin {
  const apiUrl = (process.env.LECTIO_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const siteUrl = process.env.LECTIO_SITE_URL?.replace(/\/$/, '') ?? null;
  const required = process.env.LECTIO_PRERENDER === 'required';

  return {
    name: 'lectio-prerender',
    enforce: 'post',
    async generateBundle(_options, bundle) {
      const index = bundle['index.html'];
      if (!index || index.type !== 'asset') return;
      const template = String(index.source);
      const emit = (fileName: string, source: string) =>
        this.emitFile({ type: 'asset', fileName, source });

      emit('shell.html', template);
      emit('404.html', template);
      emit('_redirects', APP_ROUTES.map((route) => `${route} /shell.html 200`).join('\n') + '\n');

      let books: PublicBook[];
      try {
        books = await loadCatalog(apiUrl);
      } catch (error) {
        const message = `No se pudo leer el catálogo público en ${apiUrl} (${String(error)}).`;
        if (required) this.error(`${message} LECTIO_PRERENDER=required: el build se detiene.`);
        this.warn(`${message} Se sigue sin prerender: las páginas públicas cargan como la app.`);
        emit('robots.txt', robots(siteUrl));
        return;
      }

      const site = { siteUrl, template };
      index.source = catalogPage(site, books, 'home');
      // Con extensión .html: Cloudflare Pages, Netlify y vite preview sirven /biblioteca y
      // /libros/:slug sin la barra final.
      emit('biblioteca.html', catalogPage(site, books, 'library'));
      for (const book of books) emit(`libros/${book.slug}.html`, bookPage(site, book));
      emit('robots.txt', robots(siteUrl));
      if (siteUrl) emit('sitemap.xml', sitemap(siteUrl, books));
      else this.warn('Sin LECTIO_SITE_URL no se genera sitemap.xml (necesita URL absolutas).');
      this.info?.(
        `Prerender: ${books.length === 1 ? '1 libro público' : `${books.length} libros públicos`}, la portada y la biblioteca.`,
      );
    },
    // En `vite preview`, las rutas de la app reciben la página vacía, como al desplegar.
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use((req, _res, next) => {
        const path = (req.url ?? '').split('?')[0] ?? '';
        if (/^\/(estudio|celda|leer)(\/|$)/.test(path)) req.url = '/shell.html';
        next();
      });
    },
  };
}

// ------------------------------------------------------------ datos

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`${response.status} en ${url}`);
  return (await response.json()) as T;
}

async function loadCatalog(apiUrl: string): Promise<PublicBook[]> {
  const summaries = await getJson<BookSummary[]>(`${apiUrl}/api/v1/books/public`);
  const books: PublicBook[] = [];
  for (const summary of summaries) {
    if (!summary.slug || summary.status !== 'ready') continue;
    const detail = await getJson<BookDetail>(
      `${apiUrl}/api/v1/books/public/${encodeURIComponent(summary.slug)}`,
    );
    const firstSummary = detail.chapters.find(
      (c) => c.kind === 'narrative' && c.characterCount > 0,
    );
    const first = firstSummary
      ? {
          summary: firstSummary,
          chapter: await getJson<Chapter>(`${apiUrl}/api/v1/chapters/${firstSummary.id}`),
        }
      : null;
    books.push({ detail, slug: summary.slug, first });
  }
  return books.sort((a, b) => (a.detail.title ?? '').localeCompare(b.detail.title ?? '', 'es'));
}

// ------------------------------------------------------------ páginas

export interface Site {
  siteUrl: string | null;
  template: string;
}

interface Head {
  title: string;
  description: string;
  path: string;
  type: 'website' | 'book';
  image?: string | null;
  jsonLd?: Record<string, unknown>;
  screen: 'title' | 'library' | 'reader';
}

/** Llena la plantilla (el index.html del build): las etiquetas del <head> y el #app. */
function render(site: Site, head: Head, fill: (doc: Document) => Node): string {
  const dom = new JSDOM(site.template);
  const doc = dom.window.document;
  doc.title = head.title;
  const meta = (attr: 'name' | 'property', key: string, content: string) => {
    let tag = doc.head.querySelector(`meta[${attr}="${key}"]`);
    if (!tag) {
      tag = doc.createElement('meta');
      tag.setAttribute(attr, key);
      doc.head.append(tag);
    }
    tag.setAttribute('content', content);
  };
  const absolute = (path: string) => (site.siteUrl ? `${site.siteUrl}${path}` : path);
  meta('name', 'description', head.description);
  meta('property', 'og:type', head.type);
  meta('property', 'og:site_name', 'Lectio');
  meta('property', 'og:title', head.title);
  meta('property', 'og:description', head.description);
  meta('property', 'og:url', absolute(head.path));
  meta('property', 'og:locale', 'es_ES');
  meta('name', 'twitter:card', 'summary');
  meta('name', 'twitter:title', head.title);
  meta('name', 'twitter:description', head.description);
  const image = head.image ? absolute(head.image) : absolute('/icons/icon-512.png');
  meta('property', 'og:image', image);
  meta('name', 'twitter:image', image);
  if (head.jsonLd) {
    const script = doc.createElement('script');
    script.type = 'application/ld+json';
    // "<" escapado: el texto del libro no puede cerrar el <script>.
    script.textContent = JSON.stringify(head.jsonLd).replace(
      /</g,
      String.fromCharCode(92) + 'u003c',
    );
    doc.head.append(script);
  }
  doc.body.dataset.screen = head.screen;
  const app = doc.getElementById('app');
  if (app) {
    app.dataset.prerendered = 'true';
    app.replaceChildren(fill(doc));
  }
  return dom.serialize();
}

export function catalogPage(site: Site, books: PublicBook[], which: 'home' | 'library'): string {
  const home = which === 'home';
  const title = home ? `Lectio · ${TAGLINE}` : 'La biblioteca del monasterio · Lectio';
  return render(
    site,
    {
      title,
      description: home
        ? DESCRIPTION
        : `${books.length} libros para leer y escuchar gratis, sin cuenta: ${books
            .slice(0, 4)
            .map((b) => b.detail.title)
            .filter(Boolean)
            .join(', ')}.`,
      path: home ? '/' : '/biblioteca',
      type: 'website',
      screen: home ? 'title' : 'library',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': home ? 'WebSite' : 'CollectionPage',
        name: home ? 'Lectio' : 'La biblioteca del monasterio',
        description: DESCRIPTION,
        inLanguage: 'es',
      },
    },
    (doc) => {
      const main = el(doc, 'main', { class: 'prerender-catalog' });
      main.append(
        el(doc, home ? 'h1' : 'p', { class: 'prerender-logo' }, 'Lectio'),
        el(doc, 'p', { class: 'prerender-tagline' }, TAGLINE),
        el(doc, home ? 'h2' : 'h1', {}, 'La biblioteca del monasterio'),
        el(doc, 'p', {}, 'Libros de dominio público para leer y escuchar, sin cuenta.'),
      );
      const list = el(doc, 'ul', { class: 'prerender-books' });
      for (const book of books) {
        const link = el(doc, 'a', { href: `/libros/${book.slug}` });
        if (book.detail.coverUrl) {
          link.append(el(doc, 'img', { src: book.detail.coverUrl, alt: '', loading: 'lazy' }));
        }
        link.append(
          el(doc, 'span', { class: 'title' }, book.detail.title ?? 'Sin título'),
          el(doc, 'span', { class: 'author' }, book.detail.author ?? ''),
        );
        const item = el(doc, 'li');
        item.append(link);
        list.append(item);
      }
      main.append(list);
      return main;
    },
  );
}

export function bookPage(site: Site, book: PublicBook): string {
  const { detail, slug, first } = book;
  const name = detail.title ?? 'Sin título';
  const author = detail.author ?? '';
  const path = `/libros/${slug}`;
  return render(
    site,
    {
      title: `${name}${author ? `, de ${author}` : ''} · Lectio`,
      description: `${name}${author ? `, de ${author}` : ''}. Léelo gratis en Lectio y escúchalo con voz neuronal sincronizada por oración, sin cuenta.`,
      path,
      type: 'book',
      image: detail.coverUrl,
      screen: 'reader',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Book',
        name,
        ...(author ? { author: { '@type': 'Person', name: author } } : {}),
        inLanguage: detail.language ?? 'es',
        ...(detail.coverUrl && site.siteUrl ? { image: `${site.siteUrl}${detail.coverUrl}` } : {}),
        ...(site.siteUrl ? { url: `${site.siteUrl}${path}` } : {}),
        isAccessibleForFree: true,
      },
    },
    (doc) => {
      // Las mismas clases que el lector: antes de que cargue React se ve casi igual.
      const layout = el(doc, 'div', { class: 'layout prerender-book' });
      const top = el(doc, 'header', { class: 'topbar' });
      const brand = el(doc, 'a', { class: 'brand', href: '/biblioteca' }, 'Lectio');
      brand.append(el(doc, 'small', {}, name));
      top.append(brand);

      const nav = el(doc, 'nav', { class: 'sidebar', 'aria-label': 'Índice del libro' });
      const card = el(doc, 'div', { class: 'book-card' });
      card.append(
        detail.coverUrl ? el(doc, 'img', { src: detail.coverUrl, alt: '' }) : el(doc, 'span'),
      );
      const who = el(doc, 'div');
      who.append(el(doc, 'h1', {}, name), el(doc, 'p', {}, author || 'Autor desconocido'));
      card.append(who);
      const toc = el(doc, 'ul', { class: 'toc' });
      let group = '';
      for (const chapter of detail.chapters.filter((c) => c.kind === 'narrative')) {
        const groupName = chapter.ancestors.join(' › ');
        if (groupName && groupName !== group) {
          toc.append(el(doc, 'li', { class: 'toc-group' }, groupName));
        }
        group = groupName;
        const item = el(doc, 'li');
        const link = el(doc, 'a', { href: `${path}?capitulo=${chapter.orderIndex}` });
        if (chapter.id === first?.summary.id) link.setAttribute('aria-current', 'page');
        link.append(
          el(
            doc,
            'span',
            { class: 'toc-title' },
            chapter.title ?? `Capítulo ${chapter.orderIndex + 1}`,
          ),
        );
        item.append(link);
        toc.append(item);
      }
      nav.append(card, toc);

      const main = el(doc, 'main', { class: 'main', id: 'contenido' });
      if (first) {
        const article = el(doc, 'article', { class: 'chapter' });
        const header = el(doc, 'header', { class: 'chapter-header' });
        const title = first.chapter.title ?? first.summary.title ?? '';
        const prose = el(doc, 'div', { class: 'prose' });
        prose.innerHTML = chapterHtml(doc, detail.id, first.chapter.contentHtml);
        // Como el lector: si el capítulo ya abre con su título, el encabezado se oculta.
        const opening = prose.querySelector('[data-b]');
        const opensWithTitle =
          opening !== null &&
          /^H[1-6]$/.test(opening.tagName) &&
          headingMatchesTitle(opening.textContent ?? '', title);
        header.append(
          el(
            doc,
            'h2',
            { class: opensWithTitle ? 'chapter-title visually-hidden' : 'chapter-title' },
            title,
          ),
        );
        article.append(header, prose);
        main.append(article);
      }
      layout.append(top, nav, main);
      return layout;
    },
  );
}

/**
 * El HTML del capítulo, saneado como en el navegador (DOMPurify), con las imágenes
 * apuntando a la API (los libros públicos no necesitan token) y cargando al bajar.
 */
function chapterHtml(doc: Document, bookId: string, html: string): string {
  const purify = createDOMPurify(doc.defaultView as unknown as Window & typeof globalThis);
  const fragment = purify.sanitize(html, { RETURN_DOM_FRAGMENT: true });
  for (const img of fragment.querySelectorAll('img')) {
    const src = img.getAttribute('src');
    if (src)
      img.setAttribute('src', `/api/v1/books/${bookId}/resources?path=${encodeURIComponent(src)}`);
    img.removeAttribute('srcset');
    img.setAttribute('loading', 'lazy');
  }
  const holder = doc.createElement('div');
  holder.append(fragment);
  return holder.innerHTML;
}

function el(doc: Document, tag: string, attrs: Record<string, string> = {}, text?: string) {
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

// ------------------------------------------------------------ buscadores

export function robots(siteUrl: string | null): string {
  const lines = [
    'User-agent: *',
    'Allow: /',
    // La app con sesión y la API no son páginas para indexar.
    'Disallow: /estudio',
    'Disallow: /leer/',
    'Disallow: /api/',
  ];
  if (siteUrl) lines.push('', `Sitemap: ${siteUrl}/sitemap.xml`);
  return lines.join('\n') + '\n';
}

export function sitemap(siteUrl: string, books: PublicBook[]): string {
  const urls = ['/', '/biblioteca', ...books.map((b) => `/libros/${b.slug}`)];
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((path) => `  <url><loc>${escape(`${siteUrl}${path}`)}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n');
}
