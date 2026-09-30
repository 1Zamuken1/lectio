import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  narrationFingerprint,
  PIPELINE_VERSION,
  PipelineError,
  processEpub,
  type Sentence,
} from '@lectio/epub-pipeline';
import { SystemAudioService } from '../../audio/application/system-audio.service.js';
import { FILE_STORAGE, type FileStorage } from '../../storage/file-storage.js';
import type { StaleBook } from '../domain/model.js';
import {
  BOOK_PROCESSING_QUEUE,
  BOOK_REPOSITORY,
  type BookProcessingQueue,
  type BookRepository,
} from '../domain/ports.js';
import { planChapters } from '../domain/reprocess.js';
import { storeBookFiles } from './process-book.service.js';

export type ReprocessOutcome =
  | {
      status: 'reprocessed';
      from: number | null;
      to: number;
      kept: number;
      created: number;
      removed: number;
      progressMoved: number;
      /** Audio del sistema (libros públicos) que quedó obsoleto y se volvió a encolar. */
      publicAudioEnqueued: number;
    }
  /** No hay nada que hacer: ya no existe, no está listo o ya tiene la versión actual. */
  | { status: 'skipped'; reason: 'missing' | 'not-ready' | 'up-to-date' | 'changed' }
  /** Hay audio generándose en un capítulo que se quitaría: correrlo de nuevo más tarde. */
  | { status: 'deferred' }
  /** La versión nueva no pudo procesarlo: el libro sigue listo con la versión anterior. */
  | { status: 'failed'; code: string; message: string };

/**
 * Reprocesa libros ya listos con la versión actual del pipeline (docs/lectio-arquitectura-api.md
 * §1.5, flujo de reprocesamiento). A diferencia de la subida, el libro sigue `ready` y se
 * puede leer todo el tiempo: el contenido nuevo reemplaza al anterior en una transacción,
 * y si el pipeline falla, se queda con el anterior.
 *
 * Los capítulos que se conservan (mismo título, en orden) mantienen su id, así su progreso
 * y su audio siguen ahí; el audio cuya narración cambió queda marcado obsoleto y el
 * usuario lo regenera gratis cuando quiera. Nada se regenera ni se cobra solo, salvo el
 * audio de los libros públicos, que es del sistema.
 */
@Injectable()
export class ReprocessBookService {
  private readonly logger = new Logger('ReprocessBook');

  constructor(
    @Inject(BOOK_REPOSITORY) private readonly books: BookRepository,
    @Inject(BOOK_PROCESSING_QUEUE) private readonly queue: BookProcessingQueue,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    private readonly systemAudio: SystemAudioService,
  ) {}

  /** Los libros listos con una versión anterior (todos, o solo esos ids). */
  listStale(ids?: string[]): Promise<StaleBook[]> {
    return this.books.listStale(PIPELINE_VERSION, ids);
  }

  /** Encola el reprocesamiento en el worker (un job por libro; repetirlo no duplica). */
  async enqueue(bookId: string): Promise<void> {
    await this.queue.enqueueReprocess(bookId);
  }

  async reprocess(bookId: string): Promise<ReprocessOutcome> {
    const target = await this.books.findReprocessTarget(bookId);
    if (!target) return { status: 'skipped', reason: 'missing' };
    if (target.status !== 'ready') return { status: 'skipped', reason: 'not-ready' };
    if ((target.pipelineVersion ?? 0) >= PIPELINE_VERSION) {
      return { status: 'skipped', reason: 'up-to-date' };
    }

    const source = await this.storage.get(target.sourceKey);
    if (!source) {
      return failed(bookId, this.logger, 'SOURCE_MISSING', 'No se encontró el EPUB en el storage.');
    }
    let book;
    try {
      book = await processEpub(source);
    } catch (error) {
      if (error instanceof PipelineError)
        return failed(bookId, this.logger, error.code, error.message);
      throw error;
    }

    // Las imágenes se guardan por hash de su ruta: las mismas se sobrescriben con lo mismo.
    const coverKey = await storeBookFiles(this.storage, bookId, book);
    const plan = planChapters(target.chapters, book.chapters);
    const legacyHashes = new Map(
      target.chapters
        .filter((c) => c.narrationHash === null)
        .map((c) => [c.id, narrationFingerprint(c.sentences as Sentence[])]),
    );
    const result = await this.books.applyReprocess(bookId, {
      book,
      coverKey,
      plan,
      legacyHashes,
      expectedVersion: target.pipelineVersion,
    });
    if (result.status === 'stale') return { status: 'skipped', reason: 'changed' };
    if (result.status === 'busy') return { status: 'deferred' };

    // Sin transacción que los proteja: si falla, quedan archivos huérfanos, no datos rotos.
    for (const key of result.orphanedKeys) {
      await this.storage.delete(key).catch((error: unknown) => {
        this.logger.warn(`No se pudo borrar ${key}: ${String(error)}`);
      });
    }
    const publicAudioEnqueued = target.isPublic
      ? await this.systemAudio.regenerateOutdated(bookId, book.metadata.language)
      : 0;
    return {
      status: 'reprocessed',
      from: target.pipelineVersion,
      to: book.pipelineVersion,
      kept: result.kept,
      created: result.created,
      removed: result.removed,
      progressMoved: result.progressMoved,
      publicAudioEnqueued,
    };
  }
}

function failed(bookId: string, logger: Logger, code: string, message: string): ReprocessOutcome {
  logger.warn(`Libro ${bookId}: no se pudo reprocesar (${code}: ${message}); sigue con su versión`);
  return { status: 'failed', code, message };
}
