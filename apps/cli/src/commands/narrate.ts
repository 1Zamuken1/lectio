import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import {
  buildVoiceUnits,
  processEpub,
  type ProcessedBook,
  type ProcessedChapter,
} from '@lectio/epub-pipeline';
import { EdgeTtsProvider } from '../tts/edge-tts.adapter.js';
import { renderUnits } from '../tts/montage.js';
import { resolveVoice, type ResolvedVoice } from '../tts/voices.js';
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

/** Un capítulo narrado, tal como lo lee el preview (`audio/<voz>/manifest.json`). */
export interface ManifestEntry {
  orderIndex: number;
  title: string;
  audio: string;
  alignment: string;
  durationMs: number;
  characters: number;
  /** Perfil de voz ("gonzalo") o voz de Edge usada directamente. */
  voice: string;
  /** Nombre para mostrar: "Gonzalo · hombre · Colombia". */
  voiceLabel?: string;
  /** Prosodia usada, para saber si hay que regenerar: "narración +6%/-7% · diálogo +0%/+10%". */
  rate: string;
  provider: string;
  pipelineVersion: number;
}

/** Carpeta del audio de un libro con una voz: `out/<libro>/audio/<voz>`. */
export function audioDir(bookDir: string, voice: ResolvedVoice): string {
  return join(bookDir, 'audio', voice.id);
}

/** ¿El capítulo ya está generado con esta voz y esta versión del pipeline? */
export function isNarrated(
  entry: ManifestEntry | undefined,
  voice: ResolvedVoice,
  pipelineVersion: number,
  dir: string,
): boolean {
  return (
    entry?.voice === voice.id &&
    entry.rate === voice.prosodyKey &&
    entry.pipelineVersion === pipelineVersion &&
    existsSync(join(dir, entry.audio)) &&
    existsSync(join(dir, entry.alignment))
  );
}

/**
 * Narra un capítulo: una solicitud por unidad de voz, montaje con pausas propias y
 * escritura del MP3, su alineación y el manifiesto. Lo usan la CLI y el servidor local.
 */
export async function narrateChapter(input: {
  book: ProcessedBook;
  chapter: ProcessedChapter;
  voice: ResolvedVoice;
  dir: string;
  provider: EdgeTtsProvider;
  concurrency: number;
  onProgress?: (done: number, total: number) => void;
}): Promise<ManifestEntry> {
  const { book, chapter, voice, dir } = input;
  await mkdir(dir, { recursive: true });
  // Una solicitud por oración o tramo de diálogo; el montaje pone las pausas.
  const units = buildVoiceUnits(chapter.sentences, input.provider.maxChunkChars);
  input.onProgress?.(0, units.length);
  const { audio, alignment } = await renderUnits(units, {
    provider: input.provider,
    voice: voice.voice,
    language: book.metadata.language,
    concurrency: input.concurrency,
    onProgress: input.onProgress,
  });

  const name = fileName(chapter);
  // Escritura atómica: un corte a mitad de camino no deja un MP3 incompleto que parezca válido.
  await writeAtomic(join(dir, `${name}.mp3`), audio);
  await writeAtomic(join(dir, `${name}.alignment.json`), `${JSON.stringify(alignment)}\n`);
  const entry: ManifestEntry = {
    orderIndex: chapter.orderIndex,
    title: chapter.title,
    audio: `${name}.mp3`,
    alignment: `${name}.alignment.json`,
    durationMs: alignment.durationMs,
    characters: chapter.characterCount,
    voice: voice.id,
    voiceLabel: voice.label,
    rate: voice.prosodyKey,
    provider: input.provider.name,
    pipelineVersion: book.pipelineVersion,
  };
  // Se relee justo antes de escribir: otro capítulo pudo terminar mientras tanto.
  const manifestPath = join(dir, 'manifest.json');
  const manifest = await readManifest(manifestPath);
  manifest.set(chapter.orderIndex, entry);
  await writeManifest(manifestPath, manifest, dir);
  return entry;
}

export async function narrate(file: string, options: NarrateOptions): Promise<void> {
  const input = userPath(file);
  const book = await processEpub(await readFile(input));
  const voice = resolveVoice(options.voice, book.metadata.language, options.rate);
  const selected = selectChapters(book, options.chapters);
  if (selected.length === 0) {
    console.error(style.red('No hay capítulos que narrar con esa selección.'));
    process.exitCode = 1;
    return;
  }

  const slug = slugify(book.metadata.title ?? basename(input, '.epub'));
  const dir = options.out ? userPath(options.out) : audioDir(userPath(`out/${slug}`), voice);
  const manifest = await readManifest(join(dir, 'manifest.json'));

  const totalChars = selected.reduce((n, c) => n + c.characterCount, 0);
  console.log(
    `\n${style.bold(book.metadata.title ?? 'Libro')} · ${selected.length} capítulo(s) · ` +
      `${formatNumber(totalChars)} caracteres · voz ${style.blue(voice.label)}\n`,
  );

  const provider = new EdgeTtsProvider({ prosody: voice.prosody, trimSilence: true });
  const concurrency = Math.max(1, Math.min(4, Number(options.concurrency ?? 2)));
  let sent = 0;
  try {
    for (const [position, chapter] of selected.entries()) {
      const prefix = style.gray(`[${position + 1}/${selected.length}]`);
      const reusable =
        !options.force &&
        isNarrated(manifest.get(chapter.orderIndex), voice, book.pipelineVersion, dir);
      if (reusable) {
        console.log(`${prefix} ${chapter.title} ${style.gray('· ya estaba generado')}`);
        continue;
      }

      const started = performance.now();
      process.stdout.write(`${prefix} ${chapter.title}`);
      const entry = await narrateChapter({
        book,
        chapter,
        voice,
        dir,
        provider,
        concurrency,
        onProgress: (done, total) => {
          if (done === 0) process.stdout.write(style.gray(` · ${formatNumber(total)} unidades…`));
        },
      });
      sent += chapter.characterCount;
      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      console.log(
        ` ${style.green('✓')} ${formatDuration(Math.round(entry.durationMs / 60000))}` +
          style.gray(` en ${seconds} s`),
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

export async function readManifest(path: string): Promise<Map<number, ManifestEntry>> {
  if (!existsSync(path)) return new Map();
  const entries = JSON.parse(await readFile(path, 'utf8')) as { chapters: ManifestEntry[] };
  return new Map(entries.chapters.map((e) => [e.orderIndex, e]));
}

export async function writeManifest(
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

export async function writeAtomic(path: string, data: string | Buffer): Promise<void> {
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
