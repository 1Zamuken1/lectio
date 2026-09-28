import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // En tests se usa el código fuente del pipeline, sin necesidad de compilarlo antes.
    alias: {
      '@lectio/epub-pipeline': fileURLToPath(
        new URL('../../packages/epub-pipeline/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
  },
});
