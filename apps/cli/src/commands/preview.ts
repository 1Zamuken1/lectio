import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';
import { processEpub, type ProcessedBook } from '@lectio/epub-pipeline';
import { DEFAULT_PROFILES, DEFAULT_VOICES } from '../tts/voices.js';
import { slugify } from '../ui/slug.js';
import { formatDuration, style, userPath } from '../ui/terminal.js';
import { embedJson, escapeHtml, FONT_LINKS, pageAssets } from '../web/assets.js';
import { loadAudioIndex, voiceChoices, type AudioIndex } from '../web/audio-index.js';
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
  const previewDir = dirname(output);
  const audioRoot = options.audio ? userPath(options.audio) : join(previewDir, 'audio');
  const audio = await loadAudioIndex(book.pipelineVersion, previewDir, audioRoot);
  await writeFile(
    output,
    renderPage(book, css, js, audio, { slug, library: options.out ? null : '../index.html' }),
    'utf8',
  );
  await writeBookCard(book, output, slug, audio, input);
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

/** Datos del libro para el cliente, en forma compacta (una sola página HTML autocontenida). */
interface PageContext {
  slug: string;
  /** Enlace de vuelta a la biblioteca, si el preview está en su carpeta por defecto. */
  library: string | null;
}

function previewData(book: ProcessedBook, audio: AudioIndex, context: PageContext) {
  const language = book.metadata.language;
  const dataUri = (mediaType: string, data: Buffer) =>
    `data:${mediaType};base64,${data.toString('base64')}`;
  return {
    book: book.metadata,
    cover: book.cover ? dataUri(book.cover.mediaType, book.cover.data) : null,
    report: book.report,
    slug: context.slug,
    library: context.library,
    /** Voces que ofrece el reproductor; con el servidor local se pueden generar las que falten. */
    voices: voiceChoices(language, audio),
    defaultVoice: DEFAULT_PROFILES[language] ?? DEFAULT_VOICES[language] ?? null,
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
      orderIndex: c.orderIndex,
      narratable: c.characterCount > 0,
      audios: audio.get(c.orderIndex) ?? {},
    })),
  };
}

function renderPage(
  book: ProcessedBook,
  css: string,
  js: string,
  audio: AudioIndex,
  context: PageContext,
): string {
  const json = embedJson(previewData(book, audio, context));
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
  /** EPUB de origen: el servidor local lo usa para generar audio desde el reproductor. */
  source?: string;
}

async function writeBookCard(
  book: ProcessedBook,
  previewPath: string,
  slug: string,
  audio: AudioIndex,
  source: string,
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
    source,
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
