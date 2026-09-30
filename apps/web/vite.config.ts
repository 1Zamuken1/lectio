import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * En desarrollo la API se sirve por el mismo origen (proxy a :3000): la cookie del refresh
 * token (SameSite=Strict, Path=/api/v1/auth) funciona sin CORS, igual que al desplegar
 * detrás de un mismo dominio.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: false } },
  },
  preview: { port: 4174 },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
