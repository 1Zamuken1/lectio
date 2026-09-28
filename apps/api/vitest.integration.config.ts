import { defineConfig } from 'vitest/config';
import { shared } from './vitest.shared.js';

/**
 * Tests de integración: la API completa contra Postgres (base lectio_test) y Redis reales.
 * Necesitan `docker compose up -d`. Van de a un archivo a la vez porque comparten la base.
 */
export default defineConfig({
  ...shared,
  test: {
    include: ['test/**/*.int.test.ts'],
    globalSetup: ['test/setup/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
