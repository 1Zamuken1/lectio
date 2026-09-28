import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '@lectio/core';
import request from 'supertest';
import { createApp } from '../../src/app.js';

export interface TestApp {
  app: INestApplication;
  http: ReturnType<typeof request>;
  prisma: PrismaService;
  /** Deja la base vacía (entre tests), sin tocar las migraciones. */
  reset(): Promise<void>;
  close(): Promise<void>;
}

/** La API real (misma configuración que main.ts) sobre la base de tests. */
export async function createTestApp(): Promise<TestApp> {
  const app = await createApp({ logger: false });
  await app.init();
  const prisma = app.get(PrismaService);
  return {
    app,
    http: request(app.getHttpServer()),
    prisma,
    async reset() {
      const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
      if (tables.length === 0) return;
      const list = tables.map((t) => `"${t.tablename}"`).join(', ');
      await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
    },
    close: () => app.close(),
  };
}
