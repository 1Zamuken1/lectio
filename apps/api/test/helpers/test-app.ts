import { Module, type INestApplication, type INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  AudioGenerationModule,
  BookProcessingModule,
  ConfigModule,
  PrismaModule,
  PrismaService,
  QueuesModule,
  RedisModule,
  StorageModule,
} from '@lectio/core';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const WORKER_BASE = [ConfigModule, PrismaModule, RedisModule, QueuesModule, StorageModule];

/** El worker de los tests: los mismos módulos que apps/worker, en el mismo proceso. */
@Module({ imports: [...WORKER_BASE, BookProcessingModule, AudioGenerationModule] })
class TestWorkerModule {}

/** Solo procesa libros: el audio pedido se queda en pending (para probar cuota y concurrencia). */
@Module({ imports: [...WORKER_BASE, BookProcessingModule] })
class BooksOnlyWorkerModule {}

export interface TestApp {
  app: INestApplication;
  http: ReturnType<typeof request>;
  prisma: PrismaService;
  /** El contexto del worker (con `worker: true`), para usar sus servicios directamente. */
  worker: INestApplicationContext | null;
  /** Deja la base vacía (entre tests), sin tocar las migraciones. */
  reset(): Promise<void>;
  close(): Promise<void>;
}

/**
 * La API real (misma configuración que main.ts) sobre la base de tests. Con `worker: true`
 * levanta también los processors de las colas, como hace apps/worker; con `audio: false`,
 * solo el de libros.
 */
export async function createTestApp(
  options: { worker?: boolean; audio?: boolean } = {},
): Promise<TestApp> {
  const app = await createApp({ logger: false });
  await app.init();
  let worker: INestApplicationContext | null = null;
  if (options.worker) {
    const module = options.audio === false ? BooksOnlyWorkerModule : TestWorkerModule;
    worker = await NestFactory.createApplicationContext(module, { logger: false });
    await worker.init();
  }
  const prisma = app.get(PrismaService);
  return {
    app,
    http: request(app.getHttpServer()),
    prisma,
    worker,
    async reset() {
      const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
      if (tables.length === 0) return;
      const list = tables.map((t) => `"${t.tablename}"`).join(', ');
      await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
    },
    async close() {
      await worker?.close();
      await app.close();
    },
  };
}

/** Crea una cuenta, inicia sesión y devuelve la cabecera Authorization lista para usar. */
export async function signUp(t: TestApp, email: string): Promise<string> {
  const credentials = { email, password: 'una frase larga y segura' };
  await t.http.post('/api/v1/auth/register').send(credentials).expect(201);
  const login = await t.http.post('/api/v1/auth/login').send(credentials).expect(200);
  return `Bearer ${login.body.accessToken}`;
}

/** Espera a que el worker termine de procesar un libro (ready o error). */
export async function waitForBook(
  t: TestApp,
  auth: string,
  bookId: string,
  timeoutMs = 20_000,
): Promise<{ status: string; errorCode: string | null; [key: string]: unknown }> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const response = await t.http.get(`/api/v1/books/${bookId}`).set('Authorization', auth);
    if (response.body.status === 'ready' || response.body.status === 'error') return response.body;
    if (Date.now() > deadline)
      throw new Error(`El libro ${bookId} sigue en ${response.body.status}`);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

/** Espera a que el worker termine el audio de un capítulo (ready o error). */
export async function waitForAudio(
  t: TestApp,
  auth: string,
  chapterId: string,
  voice = 'gonzalo',
  timeoutMs = 20_000,
): Promise<{ status: string; [key: string]: unknown }> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const response = await t.http
      .get(`/api/v1/chapters/${chapterId}/audio`)
      .query({ voice })
      .set('Authorization', auth);
    if (response.body.status === 'ready' || response.body.status === 'error') return response.body;
    if (Date.now() > deadline)
      throw new Error(`El audio de ${chapterId} sigue en ${response.body.status}`);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}
