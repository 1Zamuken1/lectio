import { defineConfig, devices } from '@playwright/test';

/** Un puerto propio: no choca con `pnpm dev` (5173) ni con `preview:pwa` (4174). */
const PORT = 4175;

/**
 * Pruebas de punta a punta sin conexión (fase 7, etapa 5), solo en local: corren contra el
 * build de verdad (con Service Worker) y la API de desarrollo. Antes: `pnpm db:up` y
 * `pnpm dev` (o solo la API), con la biblioteca pública cargada (`pnpm seed:public`).
 *
 *   pnpm --filter @lectio/web test:e2e
 */
export default defineConfig({
  testDir: 'e2e',
  // El Service Worker y IndexedDB son por origen: una prueba a la vez, sin pisarse.
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    serviceWorkers: 'allow',
    locale: 'es-CL',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    { name: 'celular', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `pnpm build && pnpm exec vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
