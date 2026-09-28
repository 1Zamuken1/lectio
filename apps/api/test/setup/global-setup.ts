import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Antes de los tests de integración: apunta DATABASE_URL a la base de tests y le aplica
 * las migraciones. Los procesos de test heredan estas variables.
 */
export default async function setup(): Promise<void> {
  const rootEnv = new URL('../../../../.env', import.meta.url);
  if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) throw new Error('Falta TEST_DATABASE_URL (ver .env.example).');
  if (testUrl === process.env.DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL no puede ser la misma base que DATABASE_URL.');
  }
  process.env.DATABASE_URL = testUrl;
  process.env.NODE_ENV = 'test';
  // Los tests hacen muchos login seguidos; el límite se prueba aparte, encendiéndolo.
  process.env.RATE_LIMIT_ENABLED ??= 'false';
  // Colas y archivos propios: el worker de desarrollo (si está corriendo) no toma estos jobs.
  process.env.QUEUE_PREFIX = 'lectio-test';
  process.env.STORAGE_DIR = join(tmpdir(), 'lectio-test-storage');
  process.env.MAX_UPLOAD_MB = '2';
  // Voz sin red y un solo intento: los tests no dependen de Edge ni esperan reintentos.
  process.env.TTS_PROVIDER ??= 'silent';
  process.env.AUDIO_JOB_ATTEMPTS = '1';
  rmSync(process.env.STORAGE_DIR, { recursive: true, force: true });
  execSync('pnpm exec prisma migrate deploy', {
    cwd: fileURLToPath(new URL('../../../../packages/core', import.meta.url)),
    env: process.env,
    stdio: 'pipe',
  });
  await clearQueues();
}

/** Jobs que quedaron de una corrida anterior interrumpida. */
async function clearQueues(): Promise<void> {
  const { Queue } = await import('bullmq');
  for (const name of ['book-processing', 'audio-generation']) {
    const queue = new Queue(name, {
      prefix: process.env.QUEUE_PREFIX,
      connection: { url: process.env.REDIS_URL },
    });
    await queue.obliterate({ force: true });
    await queue.close();
  }
}
