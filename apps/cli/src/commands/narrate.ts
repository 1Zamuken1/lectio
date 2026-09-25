import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import {
  buildAlignment,
  buildChunks,
  processEpub,
  type ProcessedBook,
  type ProcessedChapter,
  type TtsResult,
} from '@lectio/epub-pipeline';
import { DEFAULT_RATE, DEFAULT_VOICES, EdgeTtsProvider } from '../tts/edge-tts.adapter.js';
import { slugify } from '../ui/slug.js';
import { formatDuration, formatNumber, style, userPath } from '../ui/terminal.js';

export interface NarrateOptions {
  chapters?: string;
  voice?: string;
  out?: string;
  force?: boolean;
  concurrency?: string;
  rate?: string;
}

/** Un capítulo narrado, tal como lo lee el preview (`audio/manifest.json`). */
export interface ManifestEntry {
  orderIndex: number;
  title: string;
  audio: string;
  alignment: string;
  durationMs: number;
  characters: number;
  voice: string;
  /** Velocidad de síntesis (ej. "+12%"). */
  rate: string;
  provider: string;
  pipelineVersion: number;
}

export async function narrate(file: string, options: NarrateOptions): Promise<void> {
  const input = userPath(file);
  const book = await processEpub(await readFile(input));
  const voice = options.voice ?? DEFAULT_VOICES[book.metadata.language] ?? DEFAULT_VOICES.en!;
  const selected = selectChapters(book, options.chapters);
  if (selected.length === 0) {
    console.error(style.red('No hay capítulos que narrar con esa selección.'));
    process.exitCode = 1;
    return;
  }

  const slug = slugify(book.metadata.title ?? basename(input, '.epub'));
  const dir = userPath(options.out ?? `out/${slug}/audio`);
  await mkdir(dir, { recursive: true });
  const manifestPath = join(dir, 'manifest.json');
  const manifest = await readManifest(manifestPath);

  const totalChars = selected.reduce((n, c) => n + c.characterCount, 0);
  console.log(
    `\n${style.bold(book.metadata.title ?? 'Libro')} · ${selected.length} capítulo(s) · ` +
      `${formatNumber(totalChars)} caracteres · voz ${style.blue(voice)} a ${options.rate ?? DEFAULT_RATE}\n`,
  );

  const provider = new EdgeTtsProvider({ rate: options.rate });
  const concurrency = Math.max(1, Math.min(4, Number(options.concurrency ?? 2)));
  let sent = 0;
  try {
    for (const [position, chapter] of selected.entries()) {
      const prefix = style.gray(`[${position + 1}/${selected.length}]`);
      const name = fileName(chapter);
      const existing = manifest.get(chapter.orderIndex);
      const reusable =
        !options.force &&
        existing?.voice === voice &&
        existing.rate === provider.rate &&
        existing.pipelineVersion === book.pipelineVersion &&
        existsSync(join(dir, existing.audio)) &&
        existsSync(join(dir, existing.alignment));
      if (reusable) {
        console.log(`${prefix} ${chapter.title} ${style.gray('· ya estaba generado')}`);
        continue;
      }

      const started = performance.now();
      const chunks = buildChunks(chapter.sentences, provider.maxChunkChars);
      process.stdout.write(
        `${prefix} ${chapter.title} ${style.gray(`· ${chunks.length} fragmento(s)…`)}`,
      );
      const results = await mapLimit(chunks, concurrency, (chunk) =>
        provider.synthesize({ text: chunk.text, voiceId: voice, language: book.metadata.language }),
      );
      const alignment = buildAlignment(chunks, results);

      // Escritura atómica: un corte a mitad de camino no deja un MP3 incompleto que parezca válido.
      await writeAtomic(
        join(dir, `${name}.mp3`),
        Buffer.concat(results.map((r: TtsResult) => r.audio)),
      );
      await writeAtomic(join(dir, `${name}.alignment.json`), `${JSON.stringify(alignment)}\n`);
      manifest.set(chapter.orderIndex, {
        orderIndex: chapter.orderIndex,
        title: chapter.title,
        audio: `${name}.mp3`,
        alignment: `${name}.alignment.json`,
        durationMs: alignment.durationMs,
        characters: chapter.characterCount,
        voice,
        rate: provider.rate,
        provider: provider.name,
        pipelineVersion: book.pipelineVersion,
      });
      await writeManifest(manifestPath, manifest, dir);
      sent += chunks.reduce((n, c) => n + c.text.length, 0);

      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      console.log(
        ` ${style.green('✓')} ${formatDuration(Math.round(alignment.durationMs / 60000))}` +
          style.gray(` en ${seconds} s${alignment.approximate ? ' · alineación aproximada' : ''}`),
      );
    }
  } finally {
    provider.close();
  }

  console.log(
    `\n${style.green('Listo.')} ${formatNumber(sent)} caracteres enviados a ${provider.name}. ` +
      `Audio en ${style.blue(dir)}\n` +
      style.gray(`Para escucharlo junto al texto: pnpm lectio preview ${file} --open`),
  );
}

/**
 * Selección por el número "#" de `lectio inspect`: "4", "4-6", "4-6,9". Sin selección,
 * todos los capítulos narrativos.
 */
export function selectChapters(book: ProcessedBook, spec?: string): ProcessedChapter[] {
  if (!spec) return book.chapters.filter((c) => c.kind === 'narrative');
  const wanted = new Set<number>();
  for (const part of spec
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)) {
    const [from, to] = part.split('-').map((n) => Number.parseInt(n, 10));
    if (from === undefined || Number.isNaN(from)) continue;
    for (let i = from; i <= (to === undefined || Number.isNaN(to) ? from : to); i++) wanted.add(i);
  }
  return book.chapters.filter((c) => wanted.has(c.orderIndex) && c.characterCount > 0);
}

/** "004 - Perdido": el número conserva el orden en cualquier reproductor. */
function fileName(chapter: ProcessedChapter): string {
  const title = chapter.title
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return `${String(chapter.orderIndex).padStart(3, '0')} - ${title || 'capitulo'}`;
}

async function readManifest(path: string): Promise<Map<number, ManifestEntry>> {
  if (!existsSync(path)) return new Map();
  const entries = JSON.parse(await readFile(path, 'utf8')) as { chapters: ManifestEntry[] };
  return new Map(entries.chapters.map((e) => [e.orderIndex, e]));
}

async function writeManifest(
  path: string,
  manifest: Map<number, ManifestEntry>,
  dir: string,
): Promise<void> {
  const chapters = [...manifest.values()].sort((a, b) => a.orderIndex - b.orderIndex);
  await writeAtomic(path, `${JSON.stringify({ version: 1, chapters }, null, 2)}\n`);
  // Lista de reproducción estándar: sirve para escuchar en cualquier reproductor.
  const playlist = [
    '#EXTM3U',
    ...chapters.flatMap((c) => [`#EXTINF:${Math.round(c.durationMs / 1000)},${c.title}`, c.audio]),
  ];
  await writeAtomic(join(dir, 'playlist.m3u'), `${playlist.join('\n')}\n`);
}

async function writeAtomic(path: string, data: string | Buffer): Promise<void> {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, data);
  // En Windows no se puede reemplazar un archivo que otro programa tiene abierto (un
  // reproductor, o el preview escuchando ese capítulo): se reintenta un momento.
  for (let attempt = 1; ; attempt++) {
    try {
      await rename(temporary, path);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if ((code !== 'EPERM' && code !== 'EBUSY') || attempt === 5) {
        await rm(temporary, { force: true });
        if (code === 'EPERM' || code === 'EBUSY') {
          throw new Error(
            `${basename(path)} está en uso (¿lo estás escuchando?). Cierra el reproductor o el preview y vuelve a intentarlo.`,
            { cause: error },
          );
        }
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    }
  }
}

/** Ejecuta `task` sobre cada elemento con como máximo `limit` en paralelo, conservando el orden. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
