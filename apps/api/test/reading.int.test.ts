import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, signUp, waitForBook, type TestApp } from './helpers/test-app.js';
import { PNG, sampleEpub } from './helpers/sample-epub.js';

let t: TestApp;
let lectora: string;
let book: { id: string; chapters: Array<{ id: string; title: string; sentenceCount: number }> };

beforeAll(async () => {
  t = await createTestApp({ worker: true });
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

describe('GET /chapters/:id', () => {
  it('devuelve el HTML, las oraciones sin el texto de narración y las notas', async () => {
    const response = await t.http
      .get(`/api/v1/chapters/${chapter(0).id}`)
      .set('Authorization', lectora)
      .expect(200);
    const body = response.body;
    expect(body).toMatchObject({
      id: chapter(0).id,
      bookId: book.id,
      title: 'Capítulo primero',
      kind: 'narrative',
    });
    expect(body.contentHtml).toContain('data-b=');
    expect(body.contentHtml).toContain('data-lectio-note');
    expect(body.notes).toEqual([
      { id: 'n1', html: expect.stringContaining('El texto de la nota') },
    ]);

    const [first] = body.sentences;
    expect(Object.keys(first).sort()).toEqual(['blockIndex', 'end', 'index', 'narrated', 'start']);
    expect(JSON.stringify(body)).not.toContain('"narration"');
    expect(body.sentences).toHaveLength(chapter(0).sentenceCount);
  });

  it('ETag y 304: el capítulo no se descarga dos veces', async () => {
    const first = await t.http
      .get(`/api/v1/chapters/${chapter(0).id}`)
      .set('Authorization', lectora)
      .expect(200);
    const etag = first.headers.etag as string;
    expect(etag).toMatch(/^".+\.p1"$/);
    expect(first.headers['cache-control']).toBe('private, no-cache');

    const again = await t.http
      .get(`/api/v1/chapters/${chapter(0).id}`)
      .set('Authorization', lectora)
      .set('If-None-Match', etag)
      .expect(304);
    expect(again.text).toBe('');
    // También como validador débil o dentro de una lista.
    await t.http
      .get(`/api/v1/chapters/${chapter(0).id}`)
      .set('Authorization', lectora)
      .set('If-None-Match', `"otro", W/${etag}`)
      .expect(304);
    // Otro capítulo tiene otro ETag.
    await t.http
      .get(`/api/v1/chapters/${chapter(1).id}`)
      .set('Authorization', lectora)
      .set('If-None-Match', etag)
      .expect(200);
  });

  it('acceso: 403 si el libro es de otra persona, 404 si no existe', async () => {
    const otra = await signUp(t, 'otra@example.com');
    const forbidden = await t.http
      .get(`/api/v1/chapters/${chapter(0).id}`)
      .set('Authorization', otra)
      .expect(403);
    expect(forbidden.body.code).toBe('BOOK_FORBIDDEN');
    const missing = await t.http
      .get('/api/v1/chapters/01920000-0000-7000-8000-000000000000')
      .set('Authorization', lectora)
      .expect(404);
    expect(missing.body.code).toBe('CHAPTER_NOT_FOUND');
  });
});

describe('imágenes de los capítulos', () => {
  it('se piden con la ruta que usa el HTML y se sirven aisladas', async () => {
    const { body } = await t.http
      .get(`/api/v1/chapters/${chapter(0).id}`)
      .set('Authorization', lectora);
    const path = /<img[^>]+src="([^"]+)"/.exec(body.contentHtml)?.[1];
    expect(path).toBe('OEBPS/img/figura.png');

    const image = await t.http
      .get(`/api/v1/books/${book.id}/resources`)
      .query({ path })
      .set('Authorization', lectora)
      .expect(200);
    expect(image.headers['content-type']).toBe('image/png');
    expect(image.headers['content-security-policy']).toContain('sandbox');
    expect(Buffer.compare(image.body as Buffer, PNG)).toBe(0);
  });

  it('una ruta que no es del libro: 404; el libro de otra persona: 403', async () => {
    const missing = await t.http
      .get(`/api/v1/books/${book.id}/resources`)
      .query({ path: '../../../.env' })
      .set('Authorization', lectora)
      .expect(404);
    expect(missing.body.code).toBe('RESOURCE_NOT_FOUND');
    const otra = await signUp(t, 'otra@example.com');
    await t.http
      .get(`/api/v1/books/${book.id}/resources`)
      .query({ path: 'OEBPS/img/figura.png' })
      .set('Authorization', otra)
      .expect(403);
  });
});

describe('progreso de lectura', () => {
  const progress = () => `/api/v1/books/${book.id}/progress`;
  const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();

  it('sin progreso: el inicio; después, la posición guardada', async () => {
    const empty = await t.http.get(progress()).set('Authorization', lectora).expect(200);
    expect(empty.body).toEqual({
      chapterId: null,
      sentenceIndex: 0,
      mode: 'reading',
      clientUpdatedAt: null,
    });

    const position = {
      chapterId: chapter(1).id,
      sentenceIndex: 3,
      mode: 'listening',
      clientUpdatedAt: at(1),
    };
    const saved = await t.http
      .put(progress())
      .set('Authorization', lectora)
      .send(position)
      .expect(200);
    expect(saved.body).toEqual({ applied: true, clientUpdatedAt: position.clientUpdatedAt });
    const current = await t.http.get(progress()).set('Authorization', lectora).expect(200);
    expect(current.body).toEqual(position);
  });

  it('gana el más reciente: un progreso viejo que llega tarde no pisa el nuevo', async () => {
    const laptop = {
      chapterId: chapter(1).id,
      sentenceIndex: 10,
      mode: 'reading',
      clientUpdatedAt: at(5),
    };
    const phoneOffline = {
      chapterId: chapter(0).id,
      sentenceIndex: 2,
      mode: 'listening',
      clientUpdatedAt: at(60),
    };
    await t.http.put(progress()).set('Authorization', lectora).send(laptop).expect(200);

    const late = await t.http
      .put(progress())
      .set('Authorization', lectora)
      .send(phoneOffline)
      .expect(200);
    expect(late.body).toEqual({ applied: false, current: laptop });
    // Reenviar exactamente lo mismo (un reintento) sí cuenta como aplicado.
    const retry = await t.http
      .put(progress())
      .set('Authorization', lectora)
      .send(laptop)
      .expect(200);
    expect(retry.body.applied).toBe(true);
  });

  it('dos dispositivos guardando a la vez: queda el más reciente', async () => {
    const saves = Array.from({ length: 6 }, (_, i) => ({
      chapterId: chapter(1).id,
      sentenceIndex: i,
      mode: 'reading',
      clientUpdatedAt: at(10 - i), // el de i = 5 es el más reciente
    }));
    await Promise.all(
      saves.map((s) => t.http.put(progress()).set('Authorization', lectora).send(s)),
    );
    const current = await t.http.get(progress()).set('Authorization', lectora).expect(200);
    expect(current.body.sentenceIndex).toBe(5);
  });

  it('validaciones: fuera de rango, de otro libro, reloj adelantado y datos mal formados', async () => {
    const put = (body: object) => t.http.put(progress()).set('Authorization', lectora).send(body);
    const base = {
      chapterId: chapter(0).id,
      sentenceIndex: 0,
      mode: 'reading',
      clientUpdatedAt: at(1),
    };

    const range = await put({ ...base, sentenceIndex: chapter(0).sentenceCount }).expect(400);
    expect(range.body).toMatchObject({
      code: 'SENTENCE_OUT_OF_RANGE',
      sentenceCount: chapter(0).sentenceCount,
    });

    const { body: other } = await t.http
      .post('/api/v1/books')
      .set('Authorization', lectora)
      .attach('file', await sampleEpub('Otro libro'), 'otro.epub');
    const otherBook = await waitForBook(t, lectora, other.id);
    const foreignChapter = (otherBook.chapters as Array<{ id: string }>)[0]!.id;
    expect((await put({ ...base, chapterId: foreignChapter }).expect(400)).body.code).toBe(
      'CHAPTER_NOT_IN_BOOK',
    );

    const future = new Date(Date.now() + 10 * 60_000).toISOString();
    expect((await put({ ...base, clientUpdatedAt: future }).expect(400)).body.code).toBe(
      'CLIENT_TIME_IN_FUTURE',
    );

    const invalid = await put({ ...base, mode: 'volando', sentenceIndex: -1 }).expect(400);
    expect(invalid.body.code).toBe('VALIDATION_FAILED');
  });

  it('la biblioteca muestra por dónde va cada libro', async () => {
    await t.http
      .put(progress())
      .set('Authorization', lectora)
      .send({
        chapterId: chapter(1).id,
        sentenceIndex: 0,
        mode: 'listening',
        clientUpdatedAt: at(1),
      })
      .expect(200);
    const library = await t.http.get('/api/v1/books').set('Authorization', lectora).expect(200);
    expect(library.body[0].progress).toEqual({
      chapterOrder: 1,
      totalChapters: 2,
      mode: 'listening',
    });
  });

  it('el progreso de otra persona no se ve ni se escribe', async () => {
    const otra = await signUp(t, 'otra@example.com');
    await t.http.get(progress()).set('Authorization', otra).expect(403);
    await t.http
      .put(progress())
      .set('Authorization', otra)
      .send({ chapterId: chapter(0).id, sentenceIndex: 0, mode: 'reading', clientUpdatedAt: at(1) })
      .expect(403);
  });
});
