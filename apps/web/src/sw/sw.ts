/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
  type PrecacheEntry,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (PrecacheEntry | string)[];
};

/**
 * El Service Worker de Lectio (frontend §2.4 y §6.3). El app shell (HTML, JS, CSS, fuentes
 * e íconos) queda precargado: la app abre sin conexión. La API no pasa por aquí salvo las
 * portadas; los datos de las salas se guardan con TanStack Query (persist.ts).
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

self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting();
});
