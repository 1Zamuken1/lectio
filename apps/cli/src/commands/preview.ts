import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, relative } from 'node:path';
import { processEpub, type ProcessedBook } from '@lectio/epub-pipeline';
import { formatDuration, style, userPath } from '../ui/terminal.js';

/** Los assets viven en apps/cli/assets: misma profundidad desde src/commands y dist/commands. */
const ASSETS = new URL('../../assets/preview/', import.meta.url);

export async function preview(
  file: string,
  options: { out?: string; open?: boolean },
): Promise<void> {
  const input = userPath(file);
  const book = await processEpub(await readFile(input));
  const slug = slugify(book.metadata.title ?? basename(input, '.epub'));
  const output = userPath(options.out ?? `out/${slug}/preview.html`);

  const [css, js] = await Promise.all([
    readFile(new URL('preview.css', ASSETS), 'utf8'),
    readFile(new URL('preview.js', ASSETS), 'utf8'),
  ]);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, renderPage(book, css, js), 'utf8');

  const shown = relative(process.env.INIT_CWD ?? process.cwd(), output) || output;
  console.log(
    `${style.green('✓')} ${style.bold(book.metadata.title ?? 'Libro')}: ${book.report.chapters.total} secciones, ` +
      `≈ ${formatDuration(book.report.characters.estimatedMinutes)} de audio → ${style.blue(shown)}`,
  );
  if (options.open) openInBrowser(output);
}

/** Datos del libro para el cliente, en forma compacta (una sola página HTML autocontenida). */
function previewData(book: ProcessedBook) {
  const dataUri = (mediaType: string, data: Buffer) =>
    `data:${mediaType};base64,${data.toString('base64')}`;
  return {
    book: book.metadata,
    cover: book.cover ? dataUri(book.cover.mediaType, book.cover.data) : null,
    report: book.report,
    resources: Object.fromEntries(
      [...book.resources].map(([path, r]) => [path, dataUri(r.mediaType, r.data)]),
    ),
    chapters: book.chapters.map((c) => ({
      title: c.title,
      ancestors: c.ancestors,
      kind: c.kind,
      classification: c.classification,
      characterCount: c.characterCount,
      html: c.contentHtml,
      notes: c.notes,
      // [bloque, inicio, fin, narración]; la narración es null cuando coincide con el texto.
      sentences: c.sentences.map((s) => [
        s.blockIndex,
        s.start,
        s.end,
        s.narration === s.text ? null : s.narration,
      ]),
    })),
  };
}

function renderPage(book: ProcessedBook, css: string, js: string): string {
  // "<" escapado dentro del JSON: un libro no puede cerrar el <script> con "</script>".
  const lessThan = String.fromCharCode(92) + 'u003c';
  const json = JSON.stringify(previewData(book)).replaceAll('<', lessThan);
  const title = escapeHtml(book.metadata.title ?? 'Libro');
  return `<!doctype html>
<html lang="${escapeHtml(book.metadata.language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${title} · Lectio</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&display=swap">
<style>${css}</style>
</head>
<body>
<div id="app" aria-live="polite">Cargando…</div>
<script id="lectio-data" type="application/json">${json}</script>
<script>${js}</script>
</body>
</html>
`;
}

function slugify(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'libro'
  );
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function openInBrowser(path: string): void {
  const url = `file://${path.replaceAll('\\', '/').replace(/^\/?/, '/')}`;
  const [command, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '""', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];
  spawn(command, args, { detached: true, stdio: 'ignore' }).unref();
}
