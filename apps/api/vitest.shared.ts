import { fileURLToPath } from 'node:url';
import swc from 'unplugin-swc';
import type { ViteUserConfig } from 'vitest/config';

const src = (path: string) => fileURLToPath(new URL(`../../packages/${path}`, import.meta.url));

/**
 * Base común de los tests de la API. SWC (no esbuild) compila el código: NestJS necesita
 * los metadatos de tipos de los decoradores para inyectar dependencias.
 */
export const shared: ViteUserConfig = {
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: {
    // En tests se usa el código fuente de los paquetes, sin compilarlos antes.
    alias: {
      '@lectio/core': src('core/src/index.ts'),
      '@lectio/epub-pipeline': src('epub-pipeline/src/index.ts'),
      '@lectio/tts': src('tts/src/index.ts'),
    },
  },
};
