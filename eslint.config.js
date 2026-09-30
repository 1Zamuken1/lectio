import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.turbo/**',
      'corpus/**',
      'out/**',
      '**/.scratch/**',
      // Cliente de Prisma generado (prisma generate)
      'packages/core/src/generated/**',
      // Tipos generados desde el OpenAPI de la API
      'apps/web/src/api/schema.d.ts',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  { languageOptions: { globals: globals.node } },
  // La app web corre en el navegador.
  {
    files: ['apps/web/src/**/*.{js,ts,tsx}', 'apps/web/test/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
  // Cliente del preview: corre en el navegador, no en Node.
  {
    files: ['apps/cli/assets/**/*.js'],
    languageOptions: { globals: globals.browser, sourceType: 'script' },
  },
  prettier,
);
