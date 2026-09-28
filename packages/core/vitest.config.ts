import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/** Tests unitarios del núcleo. SWC compila los decoradores de NestJS como lo hará la app. */
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: { include: ['test/**/*.test.ts'] },
});
