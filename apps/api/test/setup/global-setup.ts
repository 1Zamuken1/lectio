import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Antes de los tests de integración: apunta DATABASE_URL a la base de tests y le aplica
 * las migraciones. Los procesos de test heredan estas variables.
 */
export default function setup(): void {
  const rootEnv = new URL('../../../../.env', import.meta.url);
  if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) throw new Error('Falta TEST_DATABASE_URL (ver .env.example).');
  if (testUrl === process.env.DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL no puede ser la misma base que DATABASE_URL.');
  }
  process.env.DATABASE_URL = testUrl;
  process.env.NODE_ENV = 'test';
  execSync('pnpm exec prisma migrate deploy', {
    cwd: fileURLToPath(new URL('../../../../packages/core', import.meta.url)),
    env: process.env,
    stdio: 'pipe',
  });
}
