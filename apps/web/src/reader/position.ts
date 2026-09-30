import type { QueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../api/client';

export interface SavedPosition {
  chapterId: string;
  sentenceIndex: number;
  mode: 'reading' | 'listening';
  /** Cuándo estuviste ahí (no cuándo se envió): así gana lo más reciente entre dispositivos. */
  clientUpdatedAt: string;
}

/** Cada cuánto se envía la posición mientras lees o escuchas, si cambió (frontend §4.2). */
export const SAVE_EVERY_MS = 10_000;

const localKey = (bookId: string) => `lectio:position:${bookId}`;

/** La posición guardada en este navegador: sin sesión, el progreso vive aquí. */
export function loadLocalPosition(bookId: string): SavedPosition | null {
  try {
    const value = localStorage.getItem(localKey(bookId));
    const parsed = value ? (JSON.parse(value) as SavedPosition) : null;
    return parsed && typeof parsed.chapterId === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

function saveLocalPosition(bookId: string, position: SavedPosition): void {
  try {
    localStorage.setItem(localKey(bookId), JSON.stringify(position));
  } catch {
    /* navegación privada: se ignora */
  }
}

/**
 * Guarda dónde vas en cada libro, leyendo (el lector) o escuchando (el reproductor, que
 * sigue sonando fuera del lector). Siempre en el navegador; con sesión, además en el
 * servidor: como mucho cada 10 s, y al instante al ocultar o cerrar la pestaña
 * (`keepalive`: la petición sobrevive a la página).
 */
export class ProgressSync {
  readonly #pending = new Map<string, SavedPosition>();
  readonly #timers = new Map<string, number>();

  constructor(
    private readonly api: ApiClient,
    private readonly queryClient: QueryClient,
    private readonly isAuthenticated: () => boolean,
  ) {}

  /** Escucha el cierre y el ocultamiento de la pestaña. Una vez por app. */
  install(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flushAll(true);
    });
    window.addEventListener('pagehide', () => this.flushAll(true));
  }

  record(
    bookId: string,
    chapterId: string,
    sentenceIndex: number,
    mode: SavedPosition['mode'] = 'reading',
  ): void {
    const position = { chapterId, sentenceIndex, mode, clientUpdatedAt: new Date().toISOString() };
    saveLocalPosition(bookId, position);
    if (!this.isAuthenticated()) return;
    this.#pending.set(bookId, position);
    if (!this.#timers.has(bookId)) {
      this.#timers.set(
        bookId,
        window.setTimeout(() => this.flush(bookId, false), SAVE_EVERY_MS),
      );
    }
  }

  flush(bookId: string, keepalive: boolean): void {
    window.clearTimeout(this.#timers.get(bookId));
    this.#timers.delete(bookId);
    const position = this.#pending.get(bookId);
    this.#pending.delete(bookId);
    if (!position || !this.isAuthenticated()) return;
    void this.api
      .put(`/api/v1/books/${bookId}/progress`, position, { keepalive })
      .then(() => {
        // La ficha del atril y la biblioteca muestran el progreso: al volver, se piden de nuevo.
        for (const queryKey of [['books'], ['book'], ['progress', bookId]]) {
          void this.queryClient.invalidateQueries({ queryKey, refetchType: 'none' });
        }
      })
      .catch(() => undefined); // sin red o fuera de rango: la próxima posición lo corrige
  }

  flushAll(keepalive: boolean): void {
    for (const bookId of [...this.#pending.keys()]) this.flush(bookId, keepalive);
  }
}
