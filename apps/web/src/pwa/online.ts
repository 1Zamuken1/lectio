import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

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
 * Si un libro se puede abrir sin conexión. Hasta que lleguen las descargas (fase 7,
 * etapa 2), ninguno: sin red, las salas los muestran apagados.
 */
export function useAvailableOffline(): (bookId: string) => boolean {
  return () => false;
}
