import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  FILE_STORAGE,
  GenerateAudioService,
  ReprocessBookService,
  SystemAudioService,
  type FileStorage,
} from '@lectio/core';
import { PIPELINE_VERSION } from '../../../packages/epub-pipeline/src/index.js';
import {
  createTestApp,
  signUp,
  waitForAudio,
  waitForBook,
  type TestApp,
} from './helpers/test-app.js';
import { sampleEpub } from './helpers/sample-epub.js';

/**
 * Reprocesar libros ya listos con la versión actual del pipeline. Una versión "anterior"
 * se simula en la base: pipeline_version más baja, sin huellas de narración (como los
 * libros de antes de que existieran) y, donde hace falta, una narración guardada distinta
 * de la que produce hoy el pipeline (lo que haría una regla nueva, como la de la tilde).
 */
let t: TestApp;
let lectora: string;
let reprocess: ReprocessBookService;

beforeAll(async () => {
  t = await createTestApp({ worker: true });
  reprocess = t.worker!.get(ReprocessBookService);
});

beforeEach(async () => {
  await t.reset();
  lectora = await signUp(t, 'lectora@example.com');
});

afterAll(async () => {
  await t.close();
});

interface Book {
  id: string;
  chapters: Array<{ id: string; title: string; characterCount: number }>;
}

async function uploadBook(): Promise<Book> {
  const { body } = await t.http
    .post('/api/v1/books')
    .set('Authorization', lectora)
    .attach('file', await sampleEpub(), 'libro.epub')
    .expect(202);
  return (await waitForBook(t, lectora, body.id)) as unknown as Book;
}

async function generate(chapterId: string, auth = lectora) {
  await t.http.post(`/api/v1/chapters/${chapterId}/audio`).set('Authorization', auth).expect(202);
  const state = await waitForAudio(t, auth, chapterId);
  expect(state.status).toBe('ready');
  return state;
}

/**
 * El libro como lo habría dejado una versión anterior del pipeline. `oldNarration`: los
 * capítulos cuya narración guardada era otra (el audio se generó con esta, así que al
 * reprocesar queda obsoleto).
 */
async function makeStale(bookId: string, oldNarration: string[] = []) {
  await t.prisma.book.update({
    where: { id: bookId },
    data: { pipelineVersion: PIPELINE_VERSION - 1 },
  });
  const chapters = await t.prisma.chapter.findMany({ where: { bookId } });
  for (const chapter of chapters) {
    const sentences = chapter.sentences as Array<{ narration: string }>;
    if (oldNarration.includes(chapter.id)) {
      const first = sentences.find((s) => s.narration)!;
      first.narration = `${first.narration} Uno ó dos.`;
    }
    await t.prisma.chapter.update({
      where: { id: chapter.id },
      data: { narrationHash: null, sentences },
    });
  }
  await t.prisma.audioSegment.updateMany({
    where: { chapter: { bookId } },
    data: { narrationHash: null },
  });
}

const audioState = (chapterId: string, auth: string | null = lectora) => {
  const request = t.http.get(`/api/v1/chapters/${chapterId}/audio`);
  return (auth ? request.set('Authorization', auth) : request).expect(200);
};
const usage = async () =>
  (await t.http.get('/api/v1/users/me/usage').set('Authorization', lectora)).body;

describe('reprocesar libros', () => {
  it('misma estructura: ids, progreso y audio sobreviven; solo el audio con otra narración queda obsoleto', async () => {
    const book = await uploadBook();
    const [first, second] = book.chapters as [Book['chapters'][0], Book['chapters'][0]];
    await generate(first.id);
    await generate(second.id);
    const position = {
      chapterId: second.id,
      sentenceIndex: 4,
      mode: 'listening',
      clientUpdatedAt: new Date().toISOString(),
    };
    await t.http
      .put(`/api/v1/books/${book.id}/progress`)
      .set('Authorization', lectora)
      .send(position)
      .expect(200);
    await makeStale(book.id, [first.id]);
    const before = await t.http.get(`/api/v1/chapters/${first.id}`).set('Authorization', lectora);

    expect((await reprocess.listStale()).map((b) => b.id)).toEqual([book.id]);
    expect(await reprocess.reprocess(book.id)).toEqual({
      status: 'reprocessed',
      from: PIPELINE_VERSION - 1,
      to: PIPELINE_VERSION,
      kept: 2,
      created: 0,
      removed: 0,
      progressMoved: 0,
      publicAudioEnqueued: 0,
    });

    const detail = await t.http.get(`/api/v1/books/${book.id}`).set('Authorization', lectora);
    expect(detail.body.status).toBe('ready');
    expect(detail.body.pipelineVersion).toBe(PIPELINE_VERSION);
    expect(detail.body.chapters.map((c: { id: string }) => c.id)).toEqual([first.id, second.id]);
    const progress = await t.http
      .get(`/api/v1/books/${book.id}/progress`)
      .set('Authorization', lectora);
    expect(progress.body).toEqual(position);

    // El capítulo se vuelve a descargar: el ETag lleva la versión del pipeline.
    const after = await t.http
      .get(`/api/v1/chapters/${first.id}`)
      .set('Authorization', lectora)
      .set('If-None-Match', before.headers.etag as string)
      .expect(200);
    expect(after.headers.etag).toBe(`"${first.id}.p${PIPELINE_VERSION}"`);

    // Obsoleto, pero se sigue pudiendo escuchar hasta que se regenere.
    const outdated = await audioState(first.id);
    expect(outdated.body).toMatchObject({
      status: 'ready',
      outdated: true,
      outdatedReason: 'narration',
      audioUrl: expect.any(String),
    });
    expect((await audioState(second.id)).body).toMatchObject({
      outdated: false,
      outdatedReason: null,
    });

    // Regenerarlo es gratis: ni reserva ni cobro.
    const old = await t.prisma.audioSegment.findFirstOrThrow({ where: { chapterId: first.id } });
    const spent = await usage();
    const logs = await t.prisma.ttsUsageLog.count();
    const request = await t.http
      .post(`/api/v1/chapters/${first.id}/audio`)
      .set('Authorization', lectora)
      .expect(202);
    expect(request.body.quota).toEqual({ remaining: spent.remaining });
    expect((await usage()).reserved).toBe(0);
    const regenerated = await waitForAudio(t, lectora, first.id);
    expect(regenerated).toMatchObject({ status: 'ready', outdated: false, outdatedReason: null });
    expect(await usage()).toMatchObject({
      consumed: spent.consumed,
      totalCharactersProcessed: spent.totalCharactersProcessed,
    });
    expect(await t.prisma.ttsUsageLog.count()).toBe(logs);

    // La grabación nueva tiene otra clave (no pisa a la que podía estar sonando), y los
    // archivos de la anterior se borran.
    const fresh = await t.prisma.audioSegment.findFirstOrThrow({ where: { chapterId: first.id } });
    expect(fresh.audioKey).not.toBe(old.audioKey);
    expect(fresh.alignmentKey).not.toBe(old.alignmentKey);
    const storage = t.worker!.get<FileStorage>(FILE_STORAGE);
    expect(await storage.get(old.audioKey!)).toBeNull();
    expect(await storage.get(fresh.audioKey!)).not.toBeNull();

    // Ya está al día: una segunda corrida no hace nada.
    expect(await reprocess.reprocess(book.id)).toEqual({ status: 'skipped', reason: 'up-to-date' });
    expect(await reprocess.listStale()).toEqual([]);
  });

  it('si la regeneración falla, sigue la grabación anterior (desactualizada) en vez de perderse', async () => {
    const book = await uploadBook();
    const chapter = book.chapters[0]!;
    await generate(chapter.id);
    await makeStale(book.id, [chapter.id]);
    await reprocess.reprocess(book.id);
    const old = await t.prisma.audioSegment.findFirstOrThrow({ where: { chapterId: chapter.id } });

    // Como si el worker la hubiera tomado y agotado sus reintentos.
    await t.prisma.audioSegment.update({ where: { id: old.id }, data: { status: 'processing' } });
    await t.worker!.get(GenerateAudioService).giveUp(old.id, new Error('Edge no respondió'));

    const state = (await audioState(chapter.id)).body;
    expect(state).toMatchObject({
      status: 'ready',
      outdated: true,
      outdatedReason: 'narration',
      audioUrl: expect.any(String),
    });
    const after = await t.prisma.audioSegment.findUniqueOrThrow({ where: { id: old.id } });
    expect(after).toMatchObject({ audioKey: old.audioKey, reservedCharacters: 0 });
  });

  it('el audio que ya existía sin huella y cuya narración no cambió sigue vigente y se cobra al regenerar por voz', async () => {
    const book = await uploadBook();
    const chapter = book.chapters[0]!;
    await generate(chapter.id);
    await makeStale(book.id);
    await reprocess.reprocess(book.id);
    expect((await audioState(chapter.id)).body.outdated).toBe(false);
    await t.http
      .post(`/api/v1/chapters/${chapter.id}/audio`)
      .set('Authorization', lectora)
      .expect(409);
  });

  it('estructura cambiada: se conserva lo que empareja por título; el progreso de un capítulo quitado se mueve', async () => {
    const book = await uploadBook();
    const [first, second] = book.chapters as [Book['chapters'][0], Book['chapters'][0]];
    await generate(first.id);
    const removedAudio = await generate(second.id);
    const removedSegment = await t.prisma.audioSegment.findFirstOrThrow({
      where: { chapterId: second.id },
    });
    await t.http
      .put(`/api/v1/books/${book.id}/progress`)
      .set('Authorization', lectora)
      .send({
        chapterId: second.id,
        sentenceIndex: 7,
        mode: 'reading',
        clientUpdatedAt: new Date().toISOString(),
      })
      .expect(200);
    await makeStale(book.id);
    // La versión anterior le había puesto otro título: para la nueva es otro capítulo.
    await t.prisma.chapter.update({ where: { id: second.id }, data: { title: 'Capítulo 2' } });
    const spent = await usage();

    expect(await reprocess.reprocess(book.id)).toMatchObject({
      status: 'reprocessed',
      kept: 1,
      created: 1,
      removed: 1,
      progressMoved: 1,
    });
    const detail = await t.http.get(`/api/v1/books/${book.id}`).set('Authorization', lectora);
    const [keptChapter, newChapter] = detail.body.chapters;
    expect(keptChapter.id).toBe(first.id);
    expect(newChapter).toMatchObject({ title: 'Capítulo segundo', orderIndex: 1 });
    expect(newChapter.id).not.toBe(second.id);

    // El progreso pasa al capítulo que ocupa su lugar, desde el principio.
    const progress = await t.http
      .get(`/api/v1/books/${book.id}/progress`)
      .set('Authorization', lectora);
    expect(progress.body).toMatchObject({ chapterId: newChapter.id, sentenceIndex: 0 });

    // El audio del capítulo quitado se fue (también sus archivos); el consumo, no.
    expect((await audioState(first.id)).body.status).toBe('ready');
    expect(await t.prisma.audioSegment.count({ where: { id: removedSegment.id } })).toBe(0);
    const storage = t.worker!.get<FileStorage>(FILE_STORAGE);
    expect(await storage.get(removedSegment.audioKey!)).toBeNull();
    await t.http.get(removedAudio.audioUrl as string).expect(404);
    expect(await usage()).toMatchObject({ consumed: spent.consumed, remaining: spent.remaining });
    expect(await t.prisma.ttsUsageLog.count({ where: { chapterId: null } })).toBe(1);
  });

  it('con audio generándose en un capítulo que se quitaría, se posterga sin tocar nada', async () => {
    const book = await uploadBook();
    const second = book.chapters[1]!;
    await makeStale(book.id);
    await t.prisma.chapter.update({ where: { id: second.id }, data: { title: 'Capítulo 2' } });
    const user = await t.prisma.user.findFirstOrThrow();
    await t.prisma.audioSegment.create({
      data: {
        chapterId: second.id,
        voiceId: 'gonzalo',
        requestedById: user.id,
        reservedCharacters: 10,
      },
    });

    expect(await reprocess.reprocess(book.id)).toEqual({ status: 'deferred' });
    const stored = await t.prisma.book.findUniqueOrThrow({ where: { id: book.id } });
    expect(stored.pipelineVersion).toBe(PIPELINE_VERSION - 1);
    expect(await t.prisma.chapter.count({ where: { id: second.id } })).toBe(1);
  });

  it('si la versión nueva no puede procesarlo, el libro sigue listo con la anterior', async () => {
    const book = await uploadBook();
    await makeStale(book.id);
    const record = await t.prisma.book.findUniqueOrThrow({ where: { id: book.id } });
    await t
      .worker!.get<FileStorage>(FILE_STORAGE)
      .put(record.sourceKey, Buffer.from('no es un EPUB'));

    const outcome = await reprocess.reprocess(book.id);
    expect(outcome).toMatchObject({ status: 'failed', code: expect.any(String) });
    const detail = await t.http.get(`/api/v1/books/${book.id}`).set('Authorization', lectora);
    expect(detail.body).toMatchObject({ status: 'ready', errorCode: null });
    expect(detail.body.pipelineVersion).toBe(PIPELINE_VERSION - 1);
    expect(detail.body.chapters.map((c: { id: string }) => c.id)).toEqual(
      book.chapters.map((c) => c.id),
    );
  });

  it('libro público: el audio del sistema que quedó obsoleto se vuelve a encolar solo', async () => {
    const book = await uploadBook();
    const [first, second] = book.chapters as [Book['chapters'][0], Book['chapters'][0]];
    await t.prisma.book.update({
      where: { id: book.id },
      data: { ownerId: null, isPublic: true, slug: 'el-jardin-de-prueba' },
    });
    await t.worker!.get(SystemAudioService).enqueueBook(book.id, { language: 'es', limit: 2 });
    for (const chapter of [first, second]) {
      expect((await waitForAudio(t, lectora, chapter.id)).status).toBe('ready');
    }
    const firstAudio = await t.prisma.audioSegment.findFirstOrThrow({
      where: { chapterId: first.id },
    });
    await makeStale(book.id, [first.id]);

    expect(await reprocess.reprocess(book.id)).toMatchObject({
      status: 'reprocessed',
      publicAudioEnqueued: 1,
    });
    const regenerated = await waitForAudio(t, lectora, first.id);
    expect(regenerated).toMatchObject({ status: 'ready', outdated: false });
    const segment = await t.prisma.audioSegment.findFirstOrThrow({ where: { id: firstAudio.id } });
    expect(segment.retryCount).toBe(firstAudio.retryCount + 1);
    expect((await audioState(second.id, null)).body.outdated).toBe(false);
    expect(await t.prisma.ttsUsageLog.count()).toBe(0);
  });

  it('por la cola: el worker lo reprocesa y el libro queda al día', async () => {
    const book = await uploadBook();
    await makeStale(book.id);
    await reprocess.enqueue(book.id);
    await reprocess.enqueue(book.id); // mientras espera, es el mismo job
    const deadline = Date.now() + 20_000;
    for (;;) {
      const stored = await t.prisma.book.findUniqueOrThrow({ where: { id: book.id } });
      if (stored.pipelineVersion === PIPELINE_VERSION) break;
      if (Date.now() > deadline) throw new Error('El worker no reprocesó el libro');
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    const chapters = await t.prisma.chapter.findMany({ where: { bookId: book.id } });
    expect(chapters.every((c) => c.narrationHash !== null)).toBe(true);
  });
});
