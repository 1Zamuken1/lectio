import type { BookDetail, BookRecord, BookSummary, ProcessedBookData } from './model.js';

export interface BookRepository {
  create(data: {
    id: string;
    ownerId: string;
    sourceKey: string;
    sourceHash: string;
  }): Promise<void>;
  findRecord(id: string): Promise<BookRecord | null>;
  findOwnedByHash(ownerId: string, sourceHash: string): Promise<{ id: string } | null>;
  listByOwner(ownerId: string): Promise<BookSummary[]>;
  findDetail(id: string): Promise<BookDetail | null>;
  findReport(id: string): Promise<unknown>;
  /** pending → processing; false si ya no estaba pendiente ni en error (otro worker lo tomó). */
  markProcessing(id: string): Promise<boolean>;
  /** Reemplaza los capítulos y deja el libro `ready` (idempotente: un reintento no duplica). */
  saveProcessed(id: string, data: ProcessedBookData): Promise<void>;
  markError(id: string, code: string, message: string): Promise<void>;
  /** ¿Hay audio pending/processing en algún capítulo? */
  hasActiveAudio(id: string): Promise<boolean>;
  delete(id: string): Promise<void>;
}

/** Productor de la cola book-processing (la API encola; el worker procesa). */
export interface BookProcessingQueue {
  enqueue(bookId: string): Promise<void>;
}

export const BOOK_REPOSITORY = Symbol('BOOK_REPOSITORY');
export const BOOK_PROCESSING_QUEUE = Symbol('BOOK_PROCESSING_QUEUE');
