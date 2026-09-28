import { defineConfig } from 'vitest/config';
import { shared } from './vitest.shared.js';

/** Tests unitarios: sin base de datos ni Redis. */
export default defineConfig({
  ...shared,
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/**/*.int.test.ts'],
  },
});
