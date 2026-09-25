import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Los tests del corpus procesan libros completos (Moby-Dick, Don Quijote): con todos
    // los archivos en paralelo pueden superar los 5 s por defecto.
    testTimeout: 60_000,
  },
});
