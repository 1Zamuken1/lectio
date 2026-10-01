/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
  type PrecacheEntry,
} from 'workbox-precaching';
import { createPartialResponse } from 'workbox-range-requests';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';
import { DOWNLOADS_CACHE, chapterCacheUrl, mediaCacheUrl, mediaKeyOf } from '../pwa/cache-keys';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (PrecacheEntry | string)[];
};

/**
 * El Service Worker de Lectio (frontend §2.4 y §6.3). El app shell (HTML, JS, CSS, fuentes
 * e íconos) queda precargado: la app abre sin conexión. De la API pasan por aquí las
 * portadas y lo descargado (capítulos, imágenes, audio y alineación, downloads.ts); los
 * datos de las salas se guardan con TanStack Query (persist.ts).
 *
 * Nunca se activa solo: la app muestra "Nueva versión" y, si se toca "Actualizar", manda
 * SKIP_WAITING. Si no, la versión nueva se aplica al cerrar todas las pestañas.
 */
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Cualquier ruta de la app (/estudio, /leer/:id…) abre el index.html precargado.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api\//],
  }),
);

// Las portadas: se muestran al tiro desde la caché y se renuevan por detrás. La URL no
// cambia entre usuarios (es por libro), así que la cabecera Authorization no importa.
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' && /^\/api\/v1\/books\/[^/]+\/cover$/.test(url.pathname),
  new StaleWhileRevalidate({ cacheName: 'lectio-covers' }),
);

/** Lo descargado, si está (las descargas las guarda la app en esta caché). */
async function downloaded(url: string): Promise<Response | undefined> {
  const cache = await caches.open(DOWNLOADS_CACHE);
  return cache.match(url, { ignoreVary: true });
}

// El audio y la alineación descargados: se buscan por la clave del storage (la firma
// cambia y vence; la clave no). El <audio> pide tramos con Range: se responden con 206
// desde el archivo completo. Lo que no está descargado va a la red, como siempre.
registerRoute(
  ({ url, request }) => request.method === 'GET' && mediaKeyOf(url) !== null,
  async ({ url, request }) => {
    const cached = await downloaded(mediaCacheUrl(url.origin, mediaKeyOf(url)!));
    if (!cached) return fetch(request);
    return request.headers.has('Range') ? createPartialResponse(request, cached) : cached;
  },
);

// El texto de un capítulo descargado: primero la red (si el libro se reprocesó, trae lo
// nuevo y renueva la copia); sin red o si el servidor no responde, la copia. Los no descargados no se guardan.
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' && /^\/api\/v1\/chapters\/[^/]+$/.test(url.pathname),
  async ({ url, request }) => {
    const key = chapterCacheUrl(url.origin, url.pathname.split('/').pop()!);
    try {
      const response = await fetch(request);
      const cached = await downloaded(key);
      if (cached && response.status >= 500) return cached;
      if (cached && response.status === 200) {
        const cache = await caches.open(DOWNLOADS_CACHE);
        await cache.put(key, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await downloaded(key);
      if (cached) return cached;
      throw error;
    }
  },
);

// Las imágenes de los capítulos descargados: desde la caché (el EPUB no cambia).
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' && /^\/api\/v1\/books\/[^/]+\/resources$/.test(url.pathname),
  async ({ url, request }) => (await downloaded(url.href)) ?? fetch(request),
);

self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting();
});
