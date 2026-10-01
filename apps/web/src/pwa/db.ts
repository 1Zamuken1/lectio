import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { BookDetail } from '../api/queries';
import type { QueuedProgress } from './progress-queue';

/** El audio de un capítulo descargado con una voz (los archivos van en Cache Storage). */
export interface DownloadedVoice {
  voiceId: string;
  /** Claves del storage: con ellas se buscan en la caché (cache-keys.ts). */
  audioKey: string;
  alignmentKey: string;
  bytes: number;
}

/** Un capítulo descargado: su texto e imágenes, y el audio de las voces que se bajaron. */
export interface DownloadRecord {
  chapterId: string;
  bookId: string;
  orderIndex: number;
  /** Las imágenes del capítulo, tal como las pide el lector (para borrarlas después). */
  images: string[];
  /** El texto y las imágenes. */
  textBytes: number;
  voices: DownloadedVoice[];
  savedAt: string;
}

/** La ficha del libro al descargar: sin red, el lector la necesita para abrirlo. */
export interface DownloadedBook {
  bookId: string;
  slug: string | null;
  detail: BookDetail;
  savedAt: string;
}

/**
 * La base IndexedDB de la app (frontend §2.4 y §6.3): la caché de TanStack Query con lo
 * que se vio en la última visita (`kv`), desde la versión 2 las descargas y desde la 3 la
 * cola de progreso sin conexión (`progress`). Cada store nuevo sube la versión y se crea
 * en `upgrade`.
 */
interface LectioDB extends DBSchema {
  kv: { key: string; value: string };
  downloads: { key: string; value: DownloadRecord; indexes: { bookId: string } };
  books: { key: string; value: DownloadedBook };
  progress: { key: string; value: QueuedProgress & { key: string } };
}

let db: Promise<IDBPDatabase<LectioDB>> | null = null;

export function lectioDb(): Promise<IDBPDatabase<LectioDB>> {
  db ??= openDB<LectioDB>('lectio', 3, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) database.createObjectStore('kv');
      if (oldVersion < 2) {
        const downloads = database.createObjectStore('downloads', { keyPath: 'chapterId' });
        downloads.createIndex('bookId', 'bookId');
        database.createObjectStore('books', { keyPath: 'bookId' });
      }
      if (oldVersion < 3) database.createObjectStore('progress', { keyPath: 'key' });
    },
    // Otra pestaña abrió una versión nueva: se suelta la conexión para no bloquearla.
    blocking() {
      void db?.then((open) => open.close());
      db = null;
    },
  });
  return db;
}
