import type {
  BookDetail,
  BookRecord,
  BookStatus,
  BookSummary,
  ProcessedBookData,
  ReprocessData,
  ReprocessResult,
  ReprocessTarget,
  StaleBook,
} from './model.js';

export interface BookRepository {
  create(data: {
    id: string;
    ownerId: string;
    sourceKey: string;
    sourceHash: string;
  }): Promise<void>;
  findRecord(id: string): Promise<BookRecord | null>;
  findOwnedByHash(ownerId: string, sourceHash: string): Promise<{ id: string } | null>;
  createPublic(data: {
    id: string;
    slug: string;
    sourceKey: string;
    sourceHash: string;
  }): Promise<void>;
  findPublicByHash(
    sourceHash: string,
  ): Promise<{ id: string; slug: string | null; status: BookStatus } | null>;
  slugTaken(slug: string): Promise<boolean>;
  listLibrary(userId: string): Promise<BookSummary[]>;
  listPublic(userId: string | null): Promise<BookSummary[]>;
  findPublicIdBySlug(slug: string): Promise<string | null>;
  findDetail(id: string): Promise<BookDetail | null>;
  findReport(id: string): Promise<unknown>;
  /** pending → processing; false si ya no estaba pendiente ni en error (otro worker lo tomó). */
  markProcessing(id: string): Promise<boolean>;
  /** Reemplaza los capítulos y deja el libro `ready` (idempotente: un reintento no duplica). */
  saveProcessed(id: string, data: ProcessedBookData): Promise<void>;
  markError(id: string, code: string, message: string): Promise<void>;
  /** Libros listos con una versión del pipeline anterior a `version` (opcionalmente, solo esos ids). */
  listStale(version: number, ids?: string[]): Promise<StaleBook[]>;
  findReprocessTarget(id: string): Promise<ReprocessTarget | null>;
  /**
   * Reemplaza el contenido de un libro ya listo sin cambiar los ids de los capítulos que
   * se conservan (ver ChapterPlan); el libro sigue `ready` durante todo el proceso.
   */
  applyReprocess(id: string, data: ReprocessData): Promise<ReprocessResult>;
  /** ¿Hay audio pending/processing en algún capítulo? */
  hasActiveAudio(id: string): Promise<boolean>;
  delete(id: string): Promise<void>;
}

/** Productor de la cola book-processing (la API encola; el worker procesa). */
export interface BookProcessingQueue {
  enqueue(bookId: string): Promise<void>;
  /** Reprocesar un libro ya listo con la versión actual del pipeline. */
  enqueueReprocess(bookId: string): Promise<void>;
}

export const BOOK_REPOSITORY = Symbol('BOOK_REPOSITORY');
export const BOOK_PROCESSING_QUEUE = Symbol('BOOK_PROCESSING_QUEUE');
