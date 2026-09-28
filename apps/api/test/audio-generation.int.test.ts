import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestApp,
  signUp,
  waitForAudio,
  waitForBook,
  type TestApp,
} from './helpers/test-app.js';
import { failingEpub, sampleEpub } from './helpers/sample-epub.js';

/**
 * Generación completa en el worker con el proveedor silencioso (TTS_PROVIDER=silent): el
 * MP3 y la alineación son reales, solo que sin voz. La prueba con Edge está en
 * audio-edge.int.test.ts, que solo corre si se pide.
 */
let t: TestApp;
let lectora: string;

beforeAll(async () => {
  t = await createTestApp({ worker: true });
});

beforeEach(async () => {
  await t.reset();
  lectora = await signUp(t, 'lectora@example.com');
});

afterAll(async () => {
  await t.close();
});

async function uploadBook(epub: Buffer) {
  const { body } = await t.http
    .post('/api/v1/books')
    .set('Authorization', lectora)
    .attach('file', epub, 'libro.epub')
    .expect(202);
  return (await waitForBook(t, lectora, body.id)) as unknown as {
    id: string;
    chapters: Array<{ id: string; characterCount: number; sentenceCount: number }>;
  };
}

/** Pide una URL firmada relativa (/api/v1/media?...) sin sesión. */
const media = (url: string) => t.http.get(url);

describe('generación de audio', () => {
  it('pending → ready: MP3 con Range, alineación, y el cobro en una transacción', async () => {
    const book = await uploadBook(await sampleEpub());
    const chapter = book.chapters[0]!;
    await t.http
      .post(`/api/v1/chapters/${chapter.id}/audio`)
      .set('Authorization', lectora)
      .expect(202);

    const state = await waitForAudio(t, lectora, chapter.id);
    expect(state).toMatchObject({
      status: 'ready',
      voiceId: 'gonzalo',
      provider: 'silent',
      progress: null,
      outdated: false,
      durationMs: expect.any(Number),
      audioUrl: expect.stringMatching(/^\/api\/v1\/media\?key=.+&exp=\d+&sig=/),
      alignmentUrl: expect.stringContaining('alignment.json'),
    });
    expect(new Date(state.expiresAt as string).getTime()).toBeGreaterThan(Date.now());

    // El MP3, sin sesión: la firma es el permiso.
    const audio = await media(state.audioUrl as string)
      .buffer(true)
      .expect(200);
    expect(audio.headers['content-type']).toBe('audio/mpeg');
    expect(audio.headers['accept-ranges']).toBe('bytes');
    const size = Number(audio.headers['content-length']);
    expect(size).toBeGreaterThan(1000);
    expect(audio.body.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xf3]));

    const part = await media(state.audioUrl as string)
      .set('Range', 'bytes=144-287')
      .buffer(true)
      .expect(206);
    expect(part.headers['content-range']).toBe(`bytes 144-287/${size}`);
    expect(part.body).toHaveLength(144);
    expect(Buffer.compare(part.body, audio.body.subarray(144, 288))).toBe(0);
    await media(state.audioUrl as string)
      .set('Range', `bytes=${size}-`)
      .expect(416);

    // Una oración de la alineación por cada oración narrada del capítulo.
    const alignment = await media(state.alignmentUrl as string).expect(200);
    expect(alignment.body).toMatchObject({
      version: 1,
      durationMs: state.durationMs,
      approximate: false,
    });
    const reading = await t.http
      .get(`/api/v1/chapters/${chapter.id}`)
      .set('Authorization', lectora);
    const narrated = reading.body.sentences.filter((s: { narrated: boolean }) => s.narrated);
    expect(alignment.body.sentences.map((s: { index: number }) => s.index)).toEqual(
      narrated.map((s: { index: number }) => s.index),
    );

    const usage = await t.http.get('/api/v1/users/me/usage').set('Authorization', lectora);
    expect(usage.body).toMatchObject({
      consumed: chapter.characterCount,
      reserved: 0,
      totalCharactersProcessed: chapter.characterCount,
    });
    expect(await t.prisma.ttsUsageLog.count()).toBe(1);
    const segment = await t.prisma.audioSegment.findFirstOrThrow();
    expect(segment.unitsTotal).toBeGreaterThan(0);
    expect(segment.unitsDone).toBe(segment.unitsTotal);

    const again = await t.http
      .post(`/api/v1/chapters/${chapter.id}/audio`)
      .set('Authorization', lectora)
      .expect(409);
    expect(again.body.code).toBe('AUDIO_ALREADY_EXISTS');
  });

  it('otra voz del mismo capítulo es otro audio, con su propio archivo', async () => {
    const book = await uploadBook(await sampleEpub());
    const chapter = book.chapters[1]!;
    for (const voiceId of ['gonzalo', 'salome']) {
      await t.http
        .post(`/api/v1/chapters/${chapter.id}/audio`)
        .set('Authorization', lectora)
        .send({ voiceId })
        .expect(202);
    }
    const [gonzalo, salome] = await Promise.all([
      waitForAudio(t, lectora, chapter.id, 'gonzalo'),
      waitForAudio(t, lectora, chapter.id, 'salome'),
    ]);
    expect(gonzalo.status).toBe('ready');
    expect(salome.status).toBe('ready');
    expect(gonzalo.audioUrl).not.toBe(salome.audioUrl);
    const detail = await t.http.get(`/api/v1/books/${book.id}`).set('Authorization', lectora);
    expect(detail.body.chapters[1].audio).toEqual([
      { voiceId: 'gonzalo', status: 'ready' },
      { voiceId: 'salome', status: 'ready' },
    ]);
  });

  it('un fallo de síntesis deja el audio en error y libera la reserva; se puede volver a pedir', async () => {
    const book = await uploadBook(await failingEpub());
    const chapter = book.chapters.find((c) => c.characterCount > 0)!;
    await t.http
      .post(`/api/v1/chapters/${chapter.id}/audio`)
      .set('Authorization', lectora)
      .expect(202);

    const state = await waitForAudio(t, lectora, chapter.id);
    expect(state).toMatchObject({ status: 'error', audioUrl: null });
    const usage = await t.http.get('/api/v1/users/me/usage').set('Authorization', lectora);
    expect(usage.body).toMatchObject({ consumed: 0, reserved: 0, remaining: 300_000 });
    expect(await t.prisma.ttsUsageLog.count()).toBe(0);

    const retry = await t.http
      .post(`/api/v1/chapters/${chapter.id}/audio`)
      .set('Authorization', lectora)
      .expect(202);
    expect(retry.body.status).toBe('pending');
    expect((await waitForAudio(t, lectora, chapter.id)).status).toBe('error');
  });

  it('URL firmadas: alteradas o de otro archivo no sirven', async () => {
    const book = await uploadBook(await sampleEpub());
    const chapter = book.chapters[0]!;
    await t.http
      .post(`/api/v1/chapters/${chapter.id}/audio`)
      .set('Authorization', lectora)
      .expect(202);
    const state = await waitForAudio(t, lectora, chapter.id);

    const url = new URL(state.audioUrl as string, 'http://x');
    const tampered = new URLSearchParams(url.search);
    tampered.set('key', `books/${book.id}/source.epub`);
    expect((await media(`/api/v1/media?${tampered}`).expect(403)).body.code).toBe(
      'MEDIA_URL_INVALID',
    );
    const expired = new URLSearchParams(url.search);
    expired.set('exp', '1000');
    expect((await media(`/api/v1/media?${expired}`).expect(403)).body.code).toBe(
      'MEDIA_URL_INVALID',
    );
    await media('/api/v1/media').expect(403);
  });

  it('las muestras de voz las genera el worker al arrancar', async () => {
    const deadline = Date.now() + 15_000;
    let response;
    do {
      response = await t.http.get('/api/v1/voices/salome-grave/sample').buffer(true);
      if (response.status === 200) break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    } while (Date.now() < deadline);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('audio/mpeg');
    expect(response.body.length).toBeGreaterThan(144);
  });
});
