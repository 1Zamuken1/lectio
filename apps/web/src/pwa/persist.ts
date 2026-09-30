import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Query } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import { lectioDb } from './db';

/** Qué se guarda de una visita a la otra: las salas y las fichas (sin conexión se ven igual). */
const KEPT = new Set(['books', 'book']);

/** Lo guardado sirve un mes; después, mejor pedirlo de nuevo. */
const MAX_AGE_MS = 30 * 24 * 60 * 60_000;

/**
 * Guarda la caché de TanStack Query en IndexedDB (frontend §2.4): al abrir la app sin
 * conexión, las salas muestran los libros de la última visita. Solo las listas y las
 * fichas; los capítulos y el audio van por las descargas. Sin IndexedDB (tests, algunos
 * modos privados), no se guarda nada y la app funciona igual en línea.
 */
export function persistOptions(): Omit<PersistQueryClientOptions, 'queryClient'> | null {
  if (typeof indexedDB === 'undefined') return null;
  const persister = createAsyncStoragePersister({
    key: 'lectio:queries',
    storage: {
      getItem: async (key) => (await (await lectioDb()).get('kv', key)) ?? null,
      setItem: async (key, value: string) => void (await (await lectioDb()).put('kv', value, key)),
      removeItem: async (key) => (await lectioDb()).delete('kv', key),
    },
    throttleTime: 2000,
  });
  return {
    persister,
    maxAge: MAX_AGE_MS,
    // Cambia si cambia la forma de los datos guardados: lo viejo se descarta.
    buster: 'v1',
    dehydrateOptions: { shouldDehydrateQuery: kept },
  };
}

function kept(query: Query): boolean {
  return query.state.status === 'success' && KEPT.has(String(query.queryKey[0]));
}
