import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';
import { processEpub, type Alignment, type ProcessedBook } from '@lectio/epub-pipeline';
import type { ManifestEntry } from './narrate.js';
import { slugify } from '../ui/slug.js';
import { formatDuration, style, userPath } from '../ui/terminal.js';
import { embedJson, escapeHtml, FONT_LINKS, pageAssets } from '../web/assets.js';
import { library } from './library.js';

export async function preview(
  file: string,
  options: { out?: string; audio?: string; open?: boolean },
): Promise<void> {
  const input = userPath(file);
  const book = await processEpub(await readFile(input));
  const slug = slugify(book.metadata.title ?? basename(input, '.epub'));
  const output = userPath(options.out ?? `out/${slug}/preview.html`);

  const { css, js } = await pageAssets('preview');
  await mkdir(dirname(output), { recursive: true });
  const audio = await loadAudio(book, dirname(output), options.audio);
  await writeFile(
    output,
    renderPage(book, css, js, audio, options.out ? null : '../index.html'),
    'utf8',
  );
  await writeBookCard(book, output, slug, audio);
  // Con la ruta por defecto (out/<libro>/), la biblioteca de out/ se actualiza sola.
  if (!options.out) await library(dirname(dirname(output)), { quiet: true });

  const shown = relative(process.env.INIT_CWD ?? process.cwd(), output) || output;
  console.log(
    `${style.green('✓')} ${style.bold(book.metadata.title ?? 'Libro')}: ${book.report.chapters.total} secciones, ` +
      `≈ ${formatDuration(book.report.characters.estimatedMinutes)} de audio → ${style.blue(shown)}`,
  );
  if (audio.size > 0) {
    console.log(
      style.gray(`  con audio en ${audio.size} capítulo(s): el reproductor aparece en el preview`),
    );
  }
  if (options.open) openInBrowser(output);
}

interface ChapterAudio {
  /** Ruta relativa al preview (el MP3 no se incrusta: pesaría decenas de MB). */
  src: string;
  durationMs: number;
  voice: string;
  approximate: boolean;
  /** [índice de oración, inicio ms, fin ms]. */
  sentences: Array<[number, number, number]>;
}

/**
 * Audio generado con `lectio narrate`, si existe: se lee `audio/manifest.json` junto al
 * preview. Se ignoran los capítulos narrados con otra versión del pipeline, porque sus
 * índices de oración podrían no coincidir con el texto actual.
 */
async function loadAudio(
  book: ProcessedBook,
  previewDir: string,
  audioOption?: string,
): Promise<Map<number, ChapterAudio>> {
  const audioDir = audioOption ? userPath(audioOption) : join(previewDir, 'audio');
  const manifestPath = join(audioDir, 'manifest.json');
  const result = new Map<number, ChapterAudio>();
  if (!existsSync(manifestPath)) return result;

  const { chapters } = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    chapters: ManifestEntry[];
  };
  for (const entry of chapters) {
    if (entry.pipelineVersion !== book.pipelineVersion) continue;
    const alignmentPath = join(audioDir, entry.alignment);
    if (!existsSync(alignmentPath) || !existsSync(join(audioDir, entry.audio))) continue;
    const alignment = JSON.parse(await readFile(alignmentPath, 'utf8')) as Alignment;
    const relativePath = relative(previewDir, join(audioDir, entry.audio)).split(/[\\/]/);
    result.set(entry.orderIndex, {
      src: relativePath.map(encodeURIComponent).join('/'),
      durationMs: alignment.durationMs,
      voice: entry.voice,
      approximate: alignment.approximate,
      sentences: alignment.sentences.map((s) => [s.index, s.startMs, s.endMs]),
    });
  }
  return result;
}

/** Datos del libro para el cliente, en forma compacta (una sola página HTML autocontenida). */
function previewData(
  book: ProcessedBook,
  audio: Map<number, ChapterAudio>,
  libraryHref: string | null,
) {
  const dataUri = (mediaType: string, data: Buffer) =>
    `data:${mediaType};base64,${data.toString('base64')}`;
  return {
    book: book.metadata,
    cover: book.cover ? dataUri(book.cover.mediaType, book.cover.data) : null,
    report: book.report,
    /** Enlace de vuelta a la biblioteca, si el preview está en su carpeta por defecto. */
    library: libraryHref,
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
      audio: audio.get(c.orderIndex) ?? null,
    })),
  };
}

function renderPage(
  book: ProcessedBook,
  css: string,
  js: string,
  audio: Map<number, ChapterAudio>,
  libraryHref: string | null,
): string {
  const json = embedJson(previewData(book, audio, libraryHref));
  const title = escapeHtml(book.metadata.title ?? 'Libro');
  return `<!doctype html>
<html lang="${escapeHtml(book.metadata.language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${title} · Lectio</title>
${FONT_LINKS}
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

/** Ficha del libro para la biblioteca (`lectio library`), junto al preview. */
export interface BookCard {
  slug: string;
  title: string;
  author: string | null;
  language: string;
  /** Rutas relativas a la carpeta de la ficha. */
  preview: string;
  cover: string | null;
  chapters: number;
  narratedChapters: number;
  estimatedMinutes: number;
  generatedAt: string;
}

async function writeBookCard(
  book: ProcessedBook,
  previewPath: string,
  slug: string,
  audio: Map<number, ChapterAudio>,
): Promise<void> {
  const dir = dirname(previewPath);
  let cover: string | null = null;
  if (book.cover) {
    const extension = book.cover.mediaType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'img';
    cover = `cover.${extension}`;
    await writeFile(join(dir, cover), book.cover.data);
  }
  const card: BookCard = {
    slug,
    title: book.metadata.title ?? slug,
    author: book.metadata.authors[0] ?? null,
    language: book.metadata.language,
    preview: basename(previewPath),
    cover,
    chapters: book.report.chapters.total,
    narratedChapters: audio.size,
    estimatedMinutes: book.report.characters.estimatedMinutes,
    generatedAt: new Date().toISOString(),
  };
  await writeFile(join(dir, 'book.json'), `${JSON.stringify(card, null, 2)}\n`, 'utf8');
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
