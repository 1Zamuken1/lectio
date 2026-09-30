import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/**
 * La base IndexedDB de la app (frontend §2.4 y §6.3). Por ahora guarda una sola cosa: la
 * caché de TanStack Query con lo que se vio en la última visita (`kv`). Cada store nuevo
 * sube la versión y se crea en `upgrade`.
 */
interface LectioDB extends DBSchema {
  kv: { key: string; value: string };
}

let db: Promise<IDBPDatabase<LectioDB>> | null = null;

export function lectioDb(): Promise<IDBPDatabase<LectioDB>> {
  db ??= openDB<LectioDB>('lectio', 1, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) database.createObjectStore('kv');
    },
  });
  return db;
}
