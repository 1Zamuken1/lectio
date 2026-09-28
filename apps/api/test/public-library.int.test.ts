import { Module, type INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  ConfigModule,
  PrismaModule,
  PublicCatalogModule,
  PublicCatalogService,
  QueuesModule,
  RedisModule,
  StorageModule,
  SystemAudioService,
} from '@lectio/core';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, signUp, waitForBook, type TestApp } from './helpers/test-app.js';
import { sampleEpub } from './helpers/sample-epub.js';

/** Lo mismo que arma apps/worker/src/seed-public.ts. */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    QueuesModule,
    StorageModule,
    PublicCatalogModule,
  ],
})
class SeedModule {}

let t: TestApp;
let seed: INestApplicationContext;
let catalog: PublicCatalogService;
let epub: Buffer;
let book: { id: string; slug: string };
let chapters: Array<{ id: string }>;

beforeAll(async () => {
  t = await createTestApp({ worker: true });
  seed = await NestFactory.createApplicationContext(SeedModule, { logger: false });
  catalog = seed.get(PublicCatalogService);
});

beforeEach(async () => {
  await t.reset();
  epub = await sampleEpub();
  const published = await catalog.publish({ epub, title: 'El jardín de prueba' });
  expect(published).toMatchObject({ status: 'ready', created: true, slug: 'el-jardin-de-prueba' });
  book = published;
  chapters = (await t.http.get(`/api/v1/books/${book.id}`).expect(200)).body.chapters;
});

afterAll(async () => {
  await seed.close();
  await t.close();
});

async function waitForPublicAudio(chapterId: string, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { body } = await t.http.get(`/api/v1/chapters/${chapterId}/audio`).expect(200);
    if (body.status === 'ready' || body.status === 'error') return body;
    if (Date.now() > deadline) throw new Error(`El audio sigue en ${body.status}`);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

describe('catálogo público', () => {
  it('publicar es idempotente y el slug no se repite', async () => {
    const again = await catalog.publish({ epub, title: 'El jardín de prueba' });
    expect(again).toMatchObject({ id: book.id, slug: book.slug, created: false });
    const other = await catalog.publish({
      epub: await sampleEpub('Otro'),
      title: 'El jardín de prueba',
    });
    expect(other.slug).toBe('el-jardin-de-prueba-2');
    const row = await t.prisma.book.findUniqueOrThrow({ where: { id: book.id } });
    expect(row).toMatchObject({ ownerId: null, isPublic: true, slug: book.slug });
  });

  it('se lee entero sin sesión: lista, slug, detalle, capítulo, portada e imágenes', async () => {
    const list = await t.http.get('/api/v1/books/public').expect(200);
    expect(list.body).toEqual([
      expect.objectContaining({ id: book.id, slug: book.slug, isPublic: true, progress: null }),
    ]);
    const bySlug = await t.http.get(`/api/v1/books/public/${book.slug}`).expect(200);
    expect(bySlug.body).toMatchObject({ id: book.id, slug: book.slug, status: 'ready' });
    expect((await t.http.get('/api/v1/books/public/no-existe').expect(404)).body.code).toBe(
      'BOOK_NOT_FOUND',
    );

    const chapter = await t.http.get(`/api/v1/chapters/${chapters[0]!.id}`).expect(200);
    expect(chapter.headers.etag).toBeDefined();
    await t.http.get(`/api/v1/books/${book.id}/cover`).expect(200);
    await t.http
      .get(`/api/v1/books/${book.id}/resources`)
      .query({ path: 'OEBPS/img/figura.png' })
      .expect(200);
  });

  it('un token inválido no se ignora: 401 también en rutas públicas', async () => {
    await t.http.get('/api/v1/books/public').set('Authorization', 'Bearer basura').expect(401);
  });

  it('los libros privados siguen cerrados: 401 sin sesión, 403 para otra cuenta, fuera del catálogo', async () => {
    const lectora = await signUp(t, 'lectora@example.com');
    const { body } = await t.http
      .post('/api/v1/books')
      .set('Authorization', lectora)
      .attach('file', await sampleEpub('Mi libro'), 'mio.epub')
      .expect(202);
    const own = await waitForBook(t, lectora, body.id);
    expect((await t.http.get(`/api/v1/books/${body.id}`).expect(401)).body.code).toBe(
      'UNAUTHORIZED',
    );
    const chapterId = (own.chapters as Array<{ id: string }>)[0]!.id;
    await t.http.get(`/api/v1/chapters/${chapterId}`).expect(401);
    await t.http.get(`/api/v1/chapters/${chapterId}/audio`).expect(401);
    const otra = await signUp(t, 'otra@example.com');
    await t.http.get(`/api/v1/books/${body.id}`).set('Authorization', otra).expect(403);

    const list = await t.http.get('/api/v1/books/public').expect(200);
    expect(list.body.map((b: { id: string }) => b.id)).toEqual([book.id]);
  });

  it('el audio lo genera el sistema: sin cuota ni log, y se escucha sin sesión', async () => {
    const queued = await seed
      .get(SystemAudioService)
      .enqueueBook(book.id, { language: 'es', limit: 1 });
    expect(queued).toEqual({ voiceId: 'gonzalo', enqueued: 1, skipped: 0 });

    const state = await waitForPublicAudio(chapters[0]!.id);
    expect(state.status).toBe('ready');
    await t.http.get(state.audioUrl).set('Range', 'bytes=0-143').expect(206);
    const segment = await t.prisma.audioSegment.findFirstOrThrow();
    expect(segment).toMatchObject({ requestedById: null, reservedCharacters: 0 });
    expect(await t.prisma.ttsUsageLog.count()).toBe(0);

    // Volver a correrlo no duplica: el capítulo ya está listo.
    const again = await seed
      .get(SystemAudioService)
      .enqueueBook(book.id, { language: 'es', limit: 1 });
    expect(again).toEqual({ voiceId: 'gonzalo', enqueued: 0, skipped: 1 });
  });

  it('los usuarios no piden audio de un libro público ni lo borran', async () => {
    const lectora = await signUp(t, 'lectora@example.com');
    const audio = await t.http
      .post(`/api/v1/chapters/${chapters[0]!.id}/audio`)
      .set('Authorization', lectora)
      .expect(403);
    expect(audio.body.code).toBe('PUBLIC_BOOK_AUDIO');
    await t.http.post(`/api/v1/chapters/${chapters[0]!.id}/audio`).expect(401);
    await t.http.delete(`/api/v1/books/${book.id}`).set('Authorization', lectora).expect(403);
  });

  it('progreso: cada usuario el suyo, y el libro aparece en su biblioteca', async () => {
    const lectora = await signUp(t, 'lectora@example.com');
    const otra = await signUp(t, 'otra@example.com');
    const position = {
      chapterId: chapters[1]!.id,
      sentenceIndex: 2,
      mode: 'listening',
      clientUpdatedAt: new Date(Date.now() - 1000).toISOString(),
    };
    await t.http
      .put(`/api/v1/books/${book.id}/progress`)
      .set('Authorization', lectora)
      .send(position)
      .expect(200);
    await t.http.put(`/api/v1/books/${book.id}/progress`).send(position).expect(401);

    const library = await t.http.get('/api/v1/books').set('Authorization', lectora).expect(200);
    expect(library.body).toEqual([
      expect.objectContaining({
        id: book.id,
        isPublic: true,
        progress: { chapterOrder: 1, totalChapters: 2, mode: 'listening' },
      }),
    ]);
    // La otra cuenta no lo empezó: ni en su biblioteca ni con progreso en el catálogo.
    expect((await t.http.get('/api/v1/books').set('Authorization', otra)).body).toEqual([]);
    const catalogForOther = await t.http.get('/api/v1/books/public').set('Authorization', otra);
    expect(catalogForOther.body[0].progress).toBeNull();
    const catalogForLectora = await t.http
      .get('/api/v1/books/public')
      .set('Authorization', lectora);
    expect(catalogForLectora.body[0].progress).toMatchObject({ chapterOrder: 1 });
    const own = await t.http.get(`/api/v1/books/${book.id}/progress`).set('Authorization', otra);
    expect(own.body.chapterId).toBeNull();
  });
});
