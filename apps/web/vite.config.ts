import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { prerender } from './build/prerender.js';

/** La API por el mismo origen (proxy a :3000), en desarrollo y en `vite preview`. */
const api = { '/api': { target: 'http://localhost:3000', changeOrigin: false } };

/**
 * En desarrollo la API se sirve por el mismo origen (proxy a :3000): la cookie del refresh
 * token (SameSite=Strict, Path=/api/v1/auth) funciona sin CORS, igual que al desplegar
 * detrás de un mismo dominio.
 *
 * La PWA (frontend §2.4): Service Worker propio (`src/sw/sw.ts`, con Workbox) al que el
 * plugin le inyecta la lista del app shell. Solo existe en el build: para probarla sin
 * conexión, `pnpm --filter @lectio/web build && pnpm --filter @lectio/web preview`.
 *
 * El prerender (build/prerender.ts) escribe las páginas públicas con su contenido al
 * terminar el build, leyendo el catálogo de la API (LECTIO_API_URL).
 */
export default defineConfig({
  plugins: [
    react(),
    prerender(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/sw',
      filename: 'sw.ts',
      // La app registra el worker y decide cuándo actualizar (UpdateNotice).
      injectRegister: false,
      registerType: 'prompt',
      injectManifest: {
        // De las fuentes, solo los alfabetos latinos (es, en, pt): el resto lo pide el
        // navegador si un libro lo usa (unicode-range). Son ~340 KB menos de app shell.
        globPatterns: ['**/*.{js,css,html,svg,png}', '**/*-latin-*.woff2'],
        // Las páginas prerenderizadas son para la primera visita y los buscadores: sin
        // red, toda ruta abre shell.html (la app vacía) y React dibuja lo que toque.
        globIgnores: ['index.html', '404.html', 'biblioteca.html', 'libros/**'],
      },
      manifest: {
        name: 'Lectio',
        short_name: 'Lectio',
        description: 'Lee y escucha tus libros EPUB con voz neuronal, sincronizados por oración.',
        lang: 'es',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        // Azul tinta y el papel del tema claro (scriptorium.css).
        theme_color: '#2f4f7a',
        background_color: '#f2e4c4',
        categories: ['books', 'education'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  server: { port: 5173, strictPort: true, proxy: api },
  preview: { port: 4174, proxy: api },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
