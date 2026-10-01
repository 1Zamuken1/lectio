import type { SavedPosition } from '../reader/position';
import { lectioDb } from './db';

/** Una posición que no llegó al servidor, de un usuario y un libro. */
export interface QueuedProgress {
  userId: string;
  bookId: string;
  position: SavedPosition;
}

/**
 * La cola de progreso sin conexión (frontend §6.4): la última posición de cada libro que
 * no se pudo enviar. Una por usuario y libro, la más reciente; al volver la red se envía.
 * Es una interfaz para que ProgressSync se pruebe sin IndexedDB.
 */
export interface ProgressQueue {
  /** Guarda la posición si es más reciente que la que ya esperaba. */
  put(entry: QueuedProgress): Promise<void>;
  list(userId: string): Promise<QueuedProgress[]>;
  /** Saca la posición, salvo que entretanto haya llegado otra más reciente. */
  remove(entry: QueuedProgress): Promise<void>;
}

const key = (entry: Pick<QueuedProgress, 'userId' | 'bookId'>) => `${entry.userId}:${entry.bookId}`;

const newer = (a: SavedPosition, b: SavedPosition) =>
  Date.parse(a.clientUpdatedAt) > Date.parse(b.clientUpdatedAt);

/** La cola en IndexedDB (store `progress`): sobrevive a cerrar la pestaña sin red. */
export const indexedDbQueue: ProgressQueue = {
  async put(entry) {
    const db = await lectioDb();
    const tx = db.transaction('progress', 'readwrite');
    const current = await tx.store.get(key(entry));
    if (!current || newer(entry.position, current.position)) {
      await tx.store.put({ ...entry, key: key(entry) });
    }
    await tx.done;
  },
  async list(userId) {
    const db = await lectioDb();
    const all = await db.getAll('progress');
    return all
      .filter((e) => e.userId === userId)
      .map((e) => ({ userId: e.userId, bookId: e.bookId, position: e.position }));
  },
  async remove(entry) {
    const db = await lectioDb();
    const tx = db.transaction('progress', 'readwrite');
    const current = await tx.store.get(key(entry));
    if (current && !newer(current.position, entry.position)) await tx.store.delete(key(entry));
    await tx.done;
  },
};

/** En memoria: para los tests y para navegadores sin IndexedDB. */
export function memoryQueue(): ProgressQueue {
  const entries = new Map<string, QueuedProgress>();
  return {
    async put(entry) {
      const current = entries.get(key(entry));
      if (!current || newer(entry.position, current.position)) entries.set(key(entry), entry);
    },
    async list(userId) {
      return [...entries.values()].filter((e) => e.userId === userId);
    },
    async remove(entry) {
      const current = entries.get(key(entry));
      if (current && !newer(current.position, entry.position)) entries.delete(key(entry));
    },
  };
}
