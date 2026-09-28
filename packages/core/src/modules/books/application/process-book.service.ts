import { Inject, Injectable, Logger } from '@nestjs/common';
import { PipelineError, processEpub } from '@lectio/epub-pipeline';
import { FILE_STORAGE, storageKeys, type FileStorage } from '../../storage/file-storage.js';
import { BOOK_REPOSITORY, type BookRepository } from '../domain/ports.js';

/** Resultado para el processor: si el error es definitivo, BullMQ no reintenta. */
export type ProcessOutcome =
  | { status: 'ready'; chapters: number }
  | { status: 'error'; code: string; permanent: true }
  | { status: 'skipped' };

/**
 * Procesa un libro subido (docs/lectio-arquitectura-api.md §1.5, flujo de subida): descarga
 * el EPUB, corre el pipeline (etapas 1 a 9) y guarda capítulos, portada e imágenes. Un
 * error del pipeline (DRM, archivo dañado) es definitivo; cualquier otro se propaga para
 * que la cola reintente.
 */
@Injectable()
export class ProcessBookService {
  private readonly logger = new Logger('ProcessBook');

  constructor(
    @Inject(BOOK_REPOSITORY) private readonly books: BookRepository,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  async process(bookId: string): Promise<ProcessOutcome> {
    const record = await this.books.findRecord(bookId);
    if (!record) return { status: 'skipped' }; // se borró mientras esperaba en la cola
    if (!(await this.books.markProcessing(bookId))) return { status: 'skipped' };

    const source = await this.storage.get(record.sourceKey);
    if (!source) {
      await this.books.markError(bookId, 'SOURCE_MISSING', 'No se encontró el EPUB en el storage.');
      return { status: 'error', code: 'SOURCE_MISSING', permanent: true };
    }

    let book;
    try {
      book = await processEpub(source);
    } catch (error) {
      if (error instanceof PipelineError) {
        await this.books.markError(bookId, error.code, error.message);
        this.logger.warn(`Libro ${bookId}: ${error.code} (${error.message})`);
        return { status: 'error', code: error.code, permanent: true };
      }
      throw error;
    }

    // Archivos primero y base después: si algo falla a mitad de camino, el reintento
    // sobrescribe los archivos y el libro nunca queda "ready" con imágenes que faltan.
    const coverKey = book.cover ? storageKeys.cover(bookId, book.cover.mediaType) : null;
    if (book.cover && coverKey) await this.storage.put(coverKey, book.cover.data);
    for (const [path, resource] of book.resources) {
      await this.storage.put(storageKeys.resource(bookId, path), resource.data);
    }
    await this.books.saveProcessed(bookId, { book, coverKey });
    return { status: 'ready', chapters: book.chapters.length };
  }

  /** Último intento fallido por un error inesperado: el libro queda en error. */
  async giveUp(bookId: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    await this.books.markError(bookId, 'PROCESSING_FAILED', message.slice(0, 500));
  }
}
