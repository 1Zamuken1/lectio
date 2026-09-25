import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { processEpub, type ProcessedBook } from '@lectio/epub-pipeline';
import { audioDir, isNarrated, narrateChapter, readManifest } from '../commands/narrate.js';
import type { BookCard } from '../commands/preview.js';
import { EdgeTtsProvider } from '../tts/edge-tts.adapter.js';
import { resolveVoice } from '../tts/voices.js';

export type JobStatus = 'queued' | 'running' | 'done' | 'error';

export interface Job {
  id: string;
  slug: string;
  chapter: number;
  voice: string;
  /** El siguiente capítulo, pedido por adelantado: cede el turno a lo que se está escuchando. */
  prefetch: boolean;
  status: JobStatus;
  done: number;
  total: number;
  error?: string;
  finishedAt?: number;
}

/** Cuánto se recuerda un trabajo terminado (para que el reproductor vea que terminó). */
const KEEP_FINISHED_MS = 10 * 60_000;
const CONCURRENCY = 2;

/**
 * Cola de narración del servidor local: un capítulo a la vez, para no saturar a Edge
 * (cada capítulo ya son ~130 solicitudes, dos en paralelo). Lo que se está escuchando
 * pasa delante de lo pedido por adelantado; pedir dos veces lo mismo no lo duplica.
 */
export class NarrationQueue {
  readonly #root: string;
  readonly #jobs: Job[] = [];
  readonly #books = new Map<string, Promise<ProcessedBook>>();
  #running = false;
  #counter = 0;

  constructor(root: string) {
    this.#root = root;
  }

  list(slug?: string): Job[] {
    const now = Date.now();
    for (let i = this.#jobs.length - 1; i >= 0; i--) {
      const job = this.#jobs[i]!;
      if (job.finishedAt && now - job.finishedAt > KEEP_FINISHED_MS) this.#jobs.splice(i, 1);
    }
    return this.#jobs.filter((j) => !slug || j.slug === slug);
  }

  /** Encola un capítulo; si ya está generado con esa voz, lo devuelve como terminado. */
  async request(slug: string, chapter: number, voiceId: string, prefetch: boolean): Promise<Job> {
    const pending = this.#jobs.find(
      (j) =>
        j.slug === slug &&
        j.chapter === chapter &&
        j.voice === voiceId &&
        (j.status === 'queued' || j.status === 'running'),
    );
    if (pending) {
      if (!prefetch) pending.prefetch = false;
      return pending;
    }

    const book = await this.book(slug);
    const target = book.chapters.find((c) => c.orderIndex === chapter);
    if (!target || target.characterCount === 0)
      throw new RequestError(404, 'Ese capítulo no tiene texto que narrar.');
    const voice = resolveVoice(voiceId, book.metadata.language);
    const dir = audioDir(join(this.#root, slug), voice);
    const manifest = await readManifest(join(dir, 'manifest.json'));
    const job: Job = {
      id: `j${++this.#counter}`,
      slug,
      chapter,
      voice: voice.id,
      prefetch,
      status: 'queued',
      done: 0,
      total: 0,
    };
    if (isNarrated(manifest.get(chapter), voice, book.pipelineVersion, dir)) {
      return { ...job, status: 'done', finishedAt: Date.now() };
    }
    this.#jobs.push(job);
    void this.#work();
    return job;
  }

  /** El libro procesado de una carpeta de out/, a partir del EPUB que registró su preview. */
  book(slug: string): Promise<ProcessedBook> {
    let book = this.#books.get(slug);
    if (!book) {
      book = this.#load(slug);
      this.#books.set(slug, book);
      book.catch(() => this.#books.delete(slug));
    }
    return book;
  }

  async #load(slug: string): Promise<ProcessedBook> {
    const cardPath = join(this.#root, slug, 'book.json');
    if (!existsSync(cardPath)) throw new RequestError(404, 'No existe ese libro.');
    const card = JSON.parse(await readFile(cardPath, 'utf8')) as BookCard;
    if (!card.source || !existsSync(card.source)) {
      throw new RequestError(
        409,
        'No se encuentra el EPUB de este libro. Vuelve a generar su preview con "pnpm lectio preview".',
      );
    }
    return processEpub(await readFile(card.source));
  }

  async #work(): Promise<void> {
    if (this.#running) return;
    this.#running = true;
    try {
      for (let job = this.#next(); job; job = this.#next()) {
        job.status = 'running';
        let provider: EdgeTtsProvider | null = null;
        try {
          const book = await this.book(job.slug);
          const voice = resolveVoice(job.voice, book.metadata.language);
          provider = new EdgeTtsProvider({ prosody: voice.prosody, trimSilence: true });
          await narrateChapter({
            book,
            chapter: book.chapters.find((c) => c.orderIndex === job.chapter)!,
            voice,
            dir: audioDir(join(this.#root, job.slug), voice),
            provider,
            concurrency: CONCURRENCY,
            onProgress: (done, total) => {
              job.done = done;
              job.total = total;
            },
          });
          job.status = 'done';
        } catch (error) {
          job.status = 'error';
          job.error = error instanceof Error ? error.message : String(error);
        } finally {
          provider?.close();
          job.finishedAt = Date.now();
        }
      }
    } finally {
      this.#running = false;
    }
  }

  #next(): Job | undefined {
    const queued = this.#jobs.filter((j) => j.status === 'queued');
    return queued.find((j) => !j.prefetch) ?? queued[0];
  }
}

/** Error con código HTTP, para responder al cliente con un mensaje claro. */
export class RequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
