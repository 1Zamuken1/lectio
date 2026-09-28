import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, signUp, waitForBook, type TestApp } from './helpers/test-app.js';
import { sampleEpub } from './helpers/sample-epub.js';

/**
 * Pedir audio: cuota, concurrencia, idempotencia y acceso. El worker de estos tests solo
 * procesa libros, así el audio pedido se queda en pending y ocupa su reserva.
 */
let t: TestApp;
let lectora: string;
let book: { id: string; chapters: Array<{ id: string; characterCount: number }> };

beforeAll(async () => {
  t = await createTestApp({ worker: true, audio: false });
});

beforeEach(async () => {
  await t.reset();
  lectora = await signUp(t, 'lectora@example.com');
  const { body } = await t.http
    .post('/api/v1/books')
    .set('Authorization', lectora)
    .attach('file', await sampleEpub(), 'libro.epub')
    .expect(202);
  book = (await waitForBook(t, lectora, body.id)) as unknown as typeof book;
});

afterAll(async () => {
  await t.close();
});

const chapter = (i: number) => book.chapters[i]!;
const audioOf = (i: number) => `/api/v1/chapters/${chapter(i).id}/audio`;
const usage = async () =>
  (await t.http.get('/api/v1/users/me/usage').set('Authorization', lectora).expect(200)).body;

describe('POST /chapters/:id/audio', () => {
  it('reserva la cuota y encola; repetirlo no cobra dos veces', async () => {
    const first = await t.http
      .post(audioOf(0))
      .set('Authorization', lectora)
      .send({ voiceId: 'salome' })
      .expect(202);
    expect(first.body).toEqual({
      chapterId: chapter(0).id,
      voiceId: 'salome',
      status: 'pending',
      quota: { remaining: 300_000 - chapter(0).characterCount },
    });

    const again = await t.http
      .post(audioOf(0))
      .set('Authorization', lectora)
      .send({ voiceId: 'salome' })
      .expect(200);
    expect(again.body).toEqual({ chapterId: chapter(0).id, voiceId: 'salome', status: 'pending' });

    expect(await usage()).toMatchObject({
      quota: 300_000,
      consumed: 0,
      reserved: chapter(0).characterCount,
      remaining: 300_000 - chapter(0).characterCount,
      totalCharactersProcessed: 0,
    });
    const state = await t.http
      .get(audioOf(0))
      .query({ voice: 'salome' })
      .set('Authorization', lectora);
    expect(state.body).toMatchObject({
      status: 'pending',
      progress: { done: 0, total: 0 },
      audioUrl: null,
    });
  });

  it('sin voz, la de por defecto del idioma; una voz de otro idioma: 400', async () => {
    const response = await t.http.post(audioOf(0)).set('Authorization', lectora).expect(202);
    expect(response.body.voiceId).toBe('gonzalo');

    const invalid = await t.http
      .post(audioOf(1))
      .set('Authorization', lectora)
      .send({ voiceId: 'en-US-AndrewNeural' })
      .expect(400);
    expect(invalid.body.code).toBe('VOICE_NOT_AVAILABLE');
    expect(invalid.body.available).toEqual(['gonzalo', 'jorge', 'salome', 'salome-grave']);
  });

  it('concurrencia: como mucho 2 capítulos generándose a la vez', async () => {
    await t.http.post(audioOf(0)).set('Authorization', lectora).expect(202);
    await t.http.post(audioOf(1)).set('Authorization', lectora).expect(202);
    const third = await t.http
      .post(audioOf(0))
      .set('Authorization', lectora)
      .send({ voiceId: 'jorge' })
      .expect(429);
    expect(third.body).toMatchObject({ code: 'AUDIO_CONCURRENCY_LIMIT', limit: 2 });
  });

  it('cuota bajo dos solicitudes simultáneas: solo una pasa', async () => {
    const [a, b] = [chapter(0).characterCount, chapter(1).characterCount];
    // Alcanza para cualquiera de los dos capítulos, pero no para ambos.
    await t.prisma.user.update({
      where: { email: 'lectora@example.com' },
      data: { ttsMonthlyQuota: Math.max(a, b) + 10 },
    });
    const responses = await Promise.all([
      t.http.post(audioOf(0)).set('Authorization', lectora),
      t.http.post(audioOf(1)).set('Authorization', lectora),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([202, 429]);
    const rejected = responses.find((r) => r.status === 429)!;
    expect(rejected.body).toMatchObject({
      code: 'TTS_QUOTA_EXCEEDED',
      required: expect.any(Number),
      remaining: expect.any(Number),
      resetsAt: expect.stringMatching(/^\d{4}-\d{2}-01T00:00:00\.000Z$/),
    });
    expect(rejected.body.remaining).toBeLessThan(rejected.body.required);
    const reserved = (await usage()).reserved;
    expect([a, b]).toContain(reserved);
    expect(await t.prisma.audioSegment.count()).toBe(1);
  });

  it('acceso: libro ajeno 403, capítulo inexistente 404, libro público 403', async () => {
    const otra = await signUp(t, 'otra@example.com');
    const forbidden = await t.http.post(audioOf(0)).set('Authorization', otra).expect(403);
    expect(forbidden.body.code).toBe('BOOK_FORBIDDEN');
    await t.http.get(audioOf(0)).set('Authorization', otra).expect(403);

    const missing = await t.http
      .post('/api/v1/chapters/01920000-0000-7000-8000-000000000000/audio')
      .set('Authorization', lectora)
      .expect(404);
    expect(missing.body.code).toBe('CHAPTER_NOT_FOUND');

    await t.prisma.book.update({ where: { id: book.id }, data: { isPublic: true } });
    const isPublic = await t.http.post(audioOf(0)).set('Authorization', lectora).expect(403);
    expect(isPublic.body.code).toBe('PUBLIC_BOOK_AUDIO');
  });

  it('el detalle del libro muestra el audio por capítulo y voz; no se borra mientras se genera', async () => {
    await t.http
      .post(audioOf(1))
      .set('Authorization', lectora)
      .send({ voiceId: 'jorge' })
      .expect(202);
    const detail = await t.http
      .get(`/api/v1/books/${book.id}`)
      .set('Authorization', lectora)
      .expect(200);
    expect(detail.body.chapters[0].audio).toEqual([]);
    expect(detail.body.chapters[1].audio).toEqual([{ voiceId: 'jorge', status: 'pending' }]);

    const busy = await t.http
      .delete(`/api/v1/books/${book.id}`)
      .set('Authorization', lectora)
      .expect(409);
    expect(busy.body.code).toBe('BOOK_BUSY');
  });
});

describe('GET /chapters/:id/audio', () => {
  it('sin pedir: status none', async () => {
    const response = await t.http.get(audioOf(0)).set('Authorization', lectora).expect(200);
    expect(response.body).toEqual({
      chapterId: chapter(0).id,
      voiceId: 'gonzalo',
      status: 'none',
      progress: null,
      audioUrl: null,
      alignmentUrl: null,
      expiresAt: null,
      durationMs: null,
      provider: null,
      outdated: false,
    });
  });
});

describe('GET /voices', () => {
  it('lista pública, con la de por defecto primero', async () => {
    const response = await t.http.get('/api/v1/voices').query({ language: 'es' }).expect(200);
    expect(response.body[0]).toEqual({
      id: 'gonzalo',
      name: 'Gonzalo',
      language: 'es',
      isDefault: true,
      sampleUrl: '/api/v1/voices/gonzalo/sample',
    });
    expect(response.body).toHaveLength(4);
    await t.http.get('/api/v1/voices/nadie/sample').expect(404);
  });
});
