import { onlineManager } from '@tanstack/react-query';
import { useMemo, useSyncExternalStore } from 'react';
import { useDownloads } from './downloads';

/**
 * Si hay conexión, según el navegador (eventos online/offline). Es el mismo estado con el
 * que TanStack Query pausa y reanuda las consultas, así que la interfaz y los datos nunca
 * discrepan. TanStack parte suponiendo que hay red: al abrir la app se le dice la verdad.
 */
export function watchConnection(): void {
  onlineManager.setOnline(navigator.onLine);
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    (listener) => onlineManager.subscribe(listener),
    () => onlineManager.isOnline(),
  );
}

/**
 * Si un libro se puede abrir sin conexión: tiene al menos un capítulo descargado. Sin red,
 * las salas muestran apagados los demás.
 */
export function useAvailableOffline(): (bookId: string) => boolean {
  const chapters = useDownloads((s) => s.chapters);
  return useMemo(() => {
    const books = new Set(Object.values(chapters).map((c) => c.bookId));
    return (bookId: string) => books.has(bookId);
  }, [chapters]);
}
