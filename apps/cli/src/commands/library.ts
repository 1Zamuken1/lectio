import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { BookCard } from './preview.js';
import { style, userPath } from '../ui/terminal.js';
import { embedJson, FONT_LINKS, pageAssets } from '../web/assets.js';

/**
 * Genera la biblioteca (`index.html`) a partir de las fichas `book.json` que deja cada
 * preview en su carpeta. Las rutas quedan relativas: la carpeta se puede servir o
 * comprimir y abrir con doble clic.
 */
export async function library(folder = 'out', options: { quiet?: boolean } = {}): Promise<void> {
  const root = userPath(folder);
  await mkdir(root, { recursive: true });
  const books = await readCards(root);
  const { css, js } = await pageAssets('library');
  const output = join(root, 'index.html');
  await writeFile(output, renderPage(books, css, js), 'utf8');

  if (options.quiet) return;
  const shown = relative(process.env.INIT_CWD ?? process.cwd(), output) || output;
  console.log(`${style.green('✓')} Biblioteca con ${books.length} libro(s) → ${style.blue(shown)}`);
}

async function readCards(root: string): Promise<BookCard[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const books: BookCard[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const cardPath = join(root, entry.name, 'book.json');
    if (!existsSync(cardPath)) continue;
    try {
      const card = JSON.parse(await readFile(cardPath, 'utf8')) as BookCard;
      const prefix = (path: string) => `${encodeURIComponent(entry.name)}/${encodeURI(path)}`;
      books.push({
        ...card,
        preview: prefix(card.preview),
        cover: card.cover ? prefix(card.cover) : null,
      });
    } catch {
      console.warn(style.gray(`  se ignora ${entry.name}/book.json: no es un JSON válido`));
    }
  }
  return books.sort((a, b) => a.title.localeCompare(b.title, 'es'));
}

function renderPage(books: BookCard[], css: string, js: string): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Lectio · Biblioteca</title>
${FONT_LINKS}
<style>${css}</style>
</head>
<body>
<div id="app">Cargando…</div>
<script id="lectio-data" type="application/json">${embedJson({ books })}</script>
<script>${js}</script>
</body>
</html>
`;
}
