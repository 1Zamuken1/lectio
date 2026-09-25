import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';
import { processEpub, type Alignment, type ProcessedBook } from '@lectio/epub-pipeline';
import type { ManifestEntry } from './narrate.js';
import { slugify } from '../ui/slug.js';
import { formatDuration, style, userPath } from '../ui/terminal.js';

/** Los assets viven en apps/cli/assets: misma profundidad desde src/commands y dist/commands. */
const ASSETS = new URL('../../assets/preview/', import.meta.url);

export async function preview(
  file: string,
  options: { out?: string; audio?: string; open?: boolean },
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
  const audio = await loadAudio(book, dirname(output), options.audio);
  await writeFile(output, renderPage(book, css, js, audio), 'utf8');

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
function previewData(book: ProcessedBook, audio: Map<number, ChapterAudio>) {
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
      audio: audio.get(c.orderIndex) ?? null,
    })),
  };
}

function renderPage(
  book: ProcessedBook,
  css: string,
  js: string,
  audio: Map<number, ChapterAudio>,
): string {
  // "<" escapado dentro del JSON: un libro no puede cerrar el <script> con "</script>".
  const lessThan = String.fromCharCode(92) + 'u003c';
  const json = JSON.stringify(previewData(book, audio)).replaceAll('<', lessThan);
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
