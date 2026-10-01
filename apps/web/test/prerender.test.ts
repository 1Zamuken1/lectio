import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { bookPage, catalogPage, robots, sitemap, type PublicBook } from '../build/prerender';

const template = `<!doctype html><html lang="es"><head><meta name="description" content="x"><title>Lectio</title></head><body><div id="app"></div><script type="module" src="/assets/main.js"></script></body></html>`;

const book: PublicBook = {
  slug: 'marianela',
  detail: {
    id: 'b1',
    slug: 'marianela',
    title: 'Marianela </script><script>alert(1)</script>',
    author: 'Benito Pérez Galdós',
    language: 'es',
    coverUrl: '/api/v1/books/b1/cover',
    status: 'ready',
    chapters: [
      {
        id: 'c0',
        orderIndex: 0,
        title: 'Portada',
        kind: 'front_matter',
        ancestors: [],
        characterCount: 10,
      },
      {
        id: 'c1',
        orderIndex: 1,
        title: '-I- Perdido',
        kind: 'narrative',
        ancestors: [],
        characterCount: 900,
      },
      {
        id: 'c2',
        orderIndex: 2,
        title: '-II- Guiado',
        kind: 'narrative',
        ancestors: [],
        characterCount: 800,
      },
    ],
  },
  first: {
    summary: {
      id: 'c1',
      orderIndex: 1,
      title: '-I- Perdido',
      kind: 'narrative',
      ancestors: [],
      characterCount: 900,
    },
    chapter: {
      id: 'c1',
      title: '-I- Perdido',
      contentHtml:
        '<h1 data-b="0">-I- Perdido</h1><p data-b="1">Se puso el sol.</p><img src="img/mapa.png"><script>robar()</script><p data-b="2" onclick="x()">Fin.</p>',
    },
  },
};

const parse = (html: string) => new JSDOM(html).window.document;

describe('prerender: la página de un libro', () => {
  const doc = parse(bookPage({ siteUrl: 'https://lectio.test', template }, book));

  it('lleva la ficha, el índice narrativo y el primer capítulo, con la app que la reemplaza', () => {
    expect(doc.querySelector('.book-card h1')?.textContent).toContain('Marianela');
    const toc = [...doc.querySelectorAll('.toc a')].map((a) => a.getAttribute('href'));
    expect(toc).toEqual(['/libros/marianela?capitulo=1', '/libros/marianela?capitulo=2']);
    expect(doc.querySelector('.prose')?.textContent).toContain('Se puso el sol.');
    expect(doc.querySelector('#app')?.getAttribute('data-prerendered')).toBe('true');
    expect(doc.querySelector('script[type="module"]')).not.toBeNull();
    expect(doc.body.dataset.screen).toBe('reader');
  });

  it('sanea el capítulo como el navegador y apunta las imágenes a la API', () => {
    const prose = doc.querySelector('.prose')!;
    expect(prose.querySelector('script')).toBeNull();
    expect(prose.querySelector('[onclick]')).toBeNull();
    expect(prose.querySelector('img')?.getAttribute('src')).toBe(
      '/api/v1/books/b1/resources?path=img%2Fmapa.png',
    );
  });

  it('si el capítulo abre con su título, el encabezado queda solo para lectores de pantalla', () => {
    expect(doc.querySelector('.chapter-title')?.className).toContain('visually-hidden');
  });

  it('título, descripción, Open Graph y JSON-LD, sin que el texto cierre el <script>', () => {
    expect(doc.title).toContain('Benito Pérez Galdós');
    expect(doc.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe('book');
    expect(doc.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(
      'https://lectio.test/api/v1/books/b1/cover',
    );
    const scripts = doc.querySelectorAll('script');
    // El de la app y el JSON-LD: el título del libro no agregó ninguno.
    expect(scripts).toHaveLength(2);
    const data = JSON.parse(doc.querySelector('script[type="application/ld+json"]')!.textContent!);
    expect(data['@type']).toBe('Book');
    expect(data.author.name).toBe('Benito Pérez Galdós');
    expect(data.url).toBe('https://lectio.test/libros/marianela');
  });
});

describe('prerender: el catálogo y los buscadores', () => {
  it('la portada y la biblioteca enlazan cada libro', () => {
    for (const which of ['home', 'library'] as const) {
      const doc = parse(catalogPage({ siteUrl: null, template }, [book], which));
      expect(doc.querySelector('.prerender-books a')?.getAttribute('href')).toBe(
        '/libros/marianela',
      );
      expect(doc.querySelector('h1')).not.toBeNull();
    }
  });

  it('robots deja fuera la app con sesión y la API; el sitemap lista las páginas públicas', () => {
    expect(robots('https://lectio.test')).toContain('Disallow: /leer/');
    expect(robots('https://lectio.test')).toContain('Sitemap: https://lectio.test/sitemap.xml');
    expect(robots(null)).not.toContain('Sitemap');
    const xml = sitemap('https://lectio.test', [book]);
    expect(xml).toContain('<loc>https://lectio.test/libros/marianela</loc>');
    expect(xml).toContain('<loc>https://lectio.test/biblioteca</loc>');
  });
});
