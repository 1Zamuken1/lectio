import { onlineManager, type QueryClient } from '@tanstack/react-query';
import { ApiError, isUnreachable, type ApiClient } from '../api/client';
import { indexedDbQueue, memoryQueue, type ProgressQueue } from '../pwa/progress-queue';

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
 *
 * Sin conexión (o si la API no responde), la posición va a una cola en IndexedDB, la
 * última de cada libro, y se envía al volver la red, al abrir la app o al entrar
 * (frontend §6.4). Si entretanto avanzaste en otro dispositivo, el servidor se queda con
 * lo más reciente (`clientUpdatedAt`).
 */
export class ProgressSync {
  readonly #pending = new Map<string, SavedPosition>();
  readonly #timers = new Map<string, number>();
  #syncing: Promise<void> | null = null;

  constructor(
    private readonly api: ApiClient,
    private readonly queryClient: QueryClient,
    /** El usuario con sesión, o null: el progreso de cada uno se encola aparte. */
    private readonly userId: () => string | null,
    private readonly queue: ProgressQueue = typeof indexedDB === 'undefined'
      ? memoryQueue()
      : indexedDbQueue,
  ) {}

  /** Escucha el cierre de la pestaña y el regreso de la red. Una vez por app. */
  install(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flushAll(true);
    });
    window.addEventListener('pagehide', () => this.flushAll(true));
    onlineManager.subscribe((online) => {
      if (online) void this.sync();
    });
  }

  record(
    bookId: string,
    chapterId: string,
    sentenceIndex: number,
    mode: SavedPosition['mode'] = 'reading',
  ): void {
    const position = { chapterId, sentenceIndex, mode, clientUpdatedAt: new Date().toISOString() };
    saveLocalPosition(bookId, position);
    if (!this.userId()) return;
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
    const userId = this.userId();
    if (!position || !userId) return;
    // Sin red ni se intenta: a la cola, y sale al volver.
    if (!onlineManager.isOnline()) {
      void this.queue.put({ userId, bookId, position }).catch(() => undefined);
      return;
    }
    void this.api
      .put(`/api/v1/books/${bookId}/progress`, position, { keepalive })
      .then(() => this.#refreshViews(bookId))
      .catch((error: unknown) => {
        // Sin red o la API caída: se encola. Fuera de rango o libro borrado: se descarta.
        if (keepTrying(error))
          void this.queue.put({ userId, bookId, position }).catch(() => undefined);
      });
  }

  /**
   * Envía lo que quedó en la cola del usuario con sesión, libro por libro. Lo que el
   * servidor acepta o rechaza (4xx) sale de la cola; si la red vuelve a fallar, se deja
   * para la próxima vez. Una sola pasada a la vez.
   */
  sync(): Promise<void> {
    this.#syncing ??= this.#drain().finally(() => {
      this.#syncing = null;
    });
    return this.#syncing;
  }

  async #drain(): Promise<void> {
    const userId = this.userId();
    if (!userId || !onlineManager.isOnline()) return;
    const entries = await this.queue.list(userId).catch(() => []);
    for (const entry of entries) {
      // Lo que se siga leyendo en este libro ya va en camino y es más nuevo.
      const newer = this.#pending.get(entry.bookId);
      if (newer && newer.clientUpdatedAt >= entry.position.clientUpdatedAt) {
        await this.queue.remove(entry).catch(() => undefined);
        continue;
      }
      try {
        await this.api.put(`/api/v1/books/${entry.bookId}/progress`, entry.position);
        this.#refreshViews(entry.bookId);
      } catch (error) {
        if (keepTrying(error)) return;
      }
      await this.queue.remove(entry).catch(() => undefined);
    }
  }

  /** La ficha del atril y la biblioteca muestran el progreso: al volver, se piden de nuevo. */
  #refreshViews(bookId: string) {
    for (const queryKey of [['books'], ['book'], ['progress', bookId]]) {
      void this.queryClient.invalidateQueries({ queryKey, refetchType: 'none' });
    }
  }

  flushAll(keepalive: boolean): void {
    for (const bookId of [...this.#pending.keys()]) this.flush(bookId, keepalive);
  }
}

/**
 * Vale la pena reintentar: no hubo respuesta (o fue 5xx), o la sesión venció (401: al
 * volver a entrar se envía). Un 400 o 404 no mejora reintentando.
 */
function keepTrying(error: unknown): boolean {
  return isUnreachable(error) || (error instanceof ApiError && error.status === 401);
}
