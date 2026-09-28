import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Variables de la raíz del monorepo (.env); en CI llegan del entorno.
const envFile = new URL('../../.env', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env['DATABASE_URL'] ?? '' },
});
