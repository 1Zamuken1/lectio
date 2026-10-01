/**
 * Dónde quedan las descargas en Cache Storage, compartido por la app (que las guarda) y el
 * Service Worker (que las sirve sin red). Sin tipos del DOM: también compila como worker.
 */
export const DOWNLOADS_CACHE = 'lectio-downloads';

/**
 * El audio y la alineación se guardan por su clave del storage, sin la firma: la URL
 * firmada cambia y vence, pero la clave es estable y única por grabación.
 */
export function mediaCacheUrl(origin: string, key: string): string {
  return `${origin}/api/v1/media?key=${encodeURIComponent(key)}`;
}

/** La clave del storage dentro de una URL de `/media` (firmada o no). */
export function mediaKeyOf(url: URL): string | null {
  return url.pathname === '/api/v1/media' ? url.searchParams.get('key') : null;
}

export function chapterCacheUrl(origin: string, chapterId: string): string {
  return `${origin}/api/v1/chapters/${chapterId}`;
}

/** Las imágenes de un capítulo, tal como las pide el lector. */
export function resourceUrl(bookId: string, path: string): string {
  return `/api/v1/books/${bookId}/resources?path=${encodeURIComponent(path)}`;
}
