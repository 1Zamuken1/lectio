import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { uuidv7 } from '../../../common/ids/uuid.js';
import { APP_CONFIG } from '../../../config/config.module.js';
import type { AppConfig } from '../../../config/env.js';
import {
  FILE_STORAGE,
  mediaTypeOf,
  storageKeys,
  type FileStorage,
} from '../../storage/file-storage.js';
import {
  BookAlreadyExistsError,
  BookBusyError,
  BookForbiddenError,
  BookNotFoundError,
  InvalidUploadError,
} from '../domain/errors.js';
import { assertCanRead } from '../domain/access.js';
import type { BookDetail, BookRecord, BookSummary } from '../domain/model.js';
import {
  BOOK_PROCESSING_QUEUE,
  BOOK_REPOSITORY,
  type BookProcessingQueue,
  type BookRepository,
} from '../domain/ports.js';

/** Un EPUB es un ZIP: empieza con la firma "PK\x03\x04". */
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/**
 * Casos de uso de la biblioteca personal (docs/lectio-arquitectura-api.md §2.2). Subir un
 * libro solo lo guarda y lo encola: el pipeline corre en el worker, fuera de la petición.
 */
@Injectable()
export class BooksService {
  constructor(
    @Inject(BOOK_REPOSITORY) private readonly books: BookRepository,
    @Inject(BOOK_PROCESSING_QUEUE) private readonly queue: BookProcessingQueue,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async upload(
    ownerId: string,
    file: { originalName: string; data: Buffer } | undefined,
  ): Promise<{ id: string; status: 'pending' }> {
    if (!file || file.data.length === 0)
      throw new InvalidUploadError('Falta el archivo (campo "file").');
    if (!/\.epub$/i.test(file.originalName)) {
      throw new InvalidUploadError('Solo se aceptan archivos .epub.');
    }
    if (!file.data.subarray(0, 4).equals(ZIP_SIGNATURE)) {
      throw new InvalidUploadError('El archivo no es un EPUB válido (no es un ZIP).');
    }

    const sourceHash = createHash('sha256').update(file.data).digest('hex');
    const existing = await this.books.findOwnedByHash(ownerId, sourceHash);
    if (existing) throw new BookAlreadyExistsError(existing.id);

    const id = uuidv7();
    const sourceKey = storageKeys.source(id);
    await this.storage.put(sourceKey, file.data);
    await this.books.create({ id, ownerId, sourceKey, sourceHash });
    await this.queue.enqueue(id);
    return { id, status: 'pending' };
  }

  list(ownerId: string): Promise<BookSummary[]> {
    return this.books.listByOwner(ownerId);
  }

  async detail(userId: string, bookId: string): Promise<BookDetail> {
    const detail = await this.books.findDetail(bookId);
    if (!detail) throw new BookNotFoundError();
    assertCanRead(userId, detail);
    return detail;
  }

  async report(userId: string, bookId: string): Promise<unknown> {
    await this.readable(userId, bookId);
    return this.books.findReport(bookId);
  }

  async cover(userId: string, bookId: string): Promise<{ data: Buffer; mediaType: string } | null> {
    const book = await this.readable(userId, bookId);
    if (!book.coverKey) return null;
    const data = await this.storage.get(book.coverKey);
    return data ? { data, mediaType: mediaTypeOf(book.coverKey) } : null;
  }

  /**
   * Imagen de un capítulo, por la ruta que usa su HTML (la del EPUB). La clave se deriva de
   * la ruta, así que no hay forma de pedir un archivo que no sea de este libro.
   */
  async resource(
    userId: string,
    bookId: string,
    path: string,
  ): Promise<{ data: Buffer; mediaType: string } | null> {
    await this.readable(userId, bookId);
    const key = storageKeys.resource(bookId, path);
    const data = await this.storage.get(key);
    return data ? { data, mediaType: mediaTypeOf(key) } : null;
  }

  async remove(userId: string, bookId: string): Promise<void> {
    const book = await this.books.findRecord(bookId);
    if (!book) throw new BookNotFoundError();
    if (book.ownerId !== userId) throw new BookForbiddenError();
    if (await this.books.hasActiveAudio(bookId)) throw new BookBusyError();
    await this.books.delete(bookId);
    await this.storage.deletePrefix(storageKeys.book(bookId));
  }

  /** El registro, si el usuario puede leerlo (dueño o libro público). */
  async readable(userId: string, bookId: string): Promise<BookRecord> {
    const book = await this.books.findRecord(bookId);
    if (!book) throw new BookNotFoundError();
    assertCanRead(userId, book);
    return book;
  }

  get maxUploadBytes(): number {
    return Math.round(this.config.MAX_UPLOAD_MB * 1024 * 1024);
  }
}
