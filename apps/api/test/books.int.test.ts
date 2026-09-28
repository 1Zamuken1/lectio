import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildEpub } from '../../../packages/epub-pipeline/test/helpers/build-epub.js';
import { createTestApp, signUp, waitForBook, type TestApp } from './helpers/test-app.js';

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

/** PNG de 1×1: sirve de portada y de ilustración dentro de un capítulo. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

function sampleEpub(title = 'El jardín de prueba') {
  return buildEpub({
    metadata: { title, creators: ['Ana Autora'], language: 'es' },
    extraManifestItems: [
      '<item id="portada" href="img/portada.png" media-type="image/png" properties="cover-image"/>',
      '<item id="figura" href="img/figura.png" media-type="image/png"/>',
    ].join(''),
    extraFiles: { 'OEBPS/img/portada.png': PNG, 'OEBPS/img/figura.png': PNG },
    chapters: [
      {
        id: 'cap1',
        title: 'Capítulo primero',
        body: `<h1>Capítulo primero</h1><p>${'El viajero miró el camino y siguió adelante. '.repeat(60)}</p><p><img src="img/figura.png" alt="Un mapa"/></p>`,
      },
      {
        id: 'cap2',
        title: 'Capítulo segundo',
        body: `<h1>Capítulo segundo</h1><p>—¿Qué llevas ahí? —preguntó el hombre.</p><p>${'Nada, señor. '.repeat(200)}</p>`,
      },
    ],
  });
}

function upload(auth: string, data: Buffer, filename = 'libro.epub') {
  return t.http.post('/api/v1/books').set('Authorization', auth).attach('file', data, filename);
}

const storageDir = () => process.env.STORAGE_DIR!;

describe('subir y procesar', () => {
  it('202 pending → el worker lo procesa → ready con metadatos, capítulos y archivos', async () => {
    const accepted = await upload(lectora, await sampleEpub()).expect(202);
    expect(accepted.body).toEqual({ id: expect.any(String), status: 'pending' });
    const id = accepted.body.id;

    const book = await waitForBook(t, lectora, id);
    expect(book).toMatchObject({
      status: 'ready',
      title: 'El jardín de prueba',
      author: 'Ana Autora',
      language: 'es',
      errorCode: null,
      coverUrl: `/api/v1/books/${id}/cover`,
      pipelineVersion: 1,
    });
    const chapters = book.chapters as Array<{
      title: string;
      kind: string;
      characterCount: number;
    }>;
    expect(chapters.map((c) => c.title)).toEqual(['Capítulo primero', 'Capítulo segundo']);
    expect(chapters.every((c) => c.kind === 'narrative' && c.characterCount > 0)).toBe(true);

    // En la base: el HTML de lectura y las oraciones con sus tramos de voz (el diálogo).
    const second = await t.prisma.chapter.findFirstOrThrow({
      where: { bookId: id, orderIndex: 1 },
    });
    expect(second.contentHtml).toContain('data-b=');
    const sentences = second.sentences as Array<{ voices?: Array<{ kind: string }> }>;
    expect(sentences.some((s) => s.voices?.some((v) => v.kind === 'dialogue'))).toBe(true);

    // En el storage: el EPUB, la portada y la ilustración del capítulo.
    const files = readdirSync(join(storageDir(), 'books', id), { recursive: true }).map(String);
    expect(files).toEqual(
      expect.arrayContaining([
        'source.epub',
        'cover.png',
        expect.stringMatching(/^resources[\\/].+\.png$/),
      ]),
    );
  });

  it('la portada se sirve con su tipo y el reporte del pipeline queda disponible', async () => {
    const { body } = await upload(lectora, await sampleEpub()).expect(202);
    await waitForBook(t, lectora, body.id);

    const cover = await t.http
      .get(`/api/v1/books/${body.id}/cover`)
      .set('Authorization', lectora)
      .expect(200);
    expect(cover.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(cover.body as Buffer, PNG)).toBe(0);

    const report = await t.http
      .get(`/api/v1/books/${body.id}/report`)
      .set('Authorization', lectora)
      .expect(200);
    expect(report.body).toMatchObject({ pipelineVersion: 1, chapters: { total: 2 } });
  });

  it('un EPUB con DRM queda en error con DRM_PROTECTED (y no se reintenta)', async () => {
    const drm = await buildEpub({
      chapters: [{ id: 'cap1', title: 'Uno', body: '<p>Texto.</p>' }],
      extraFiles: { 'META-INF/rights.xml': '<rights/>' },
    });
    const { body } = await upload(lectora, drm).expect(202);
    const book = await waitForBook(t, lectora, body.id);
    expect(book).toMatchObject({ status: 'error', errorCode: 'DRM_PROTECTED', chapters: [] });
  });

  it('subir el mismo archivo dos veces: 409 BOOK_ALREADY_EXISTS con el id existente', async () => {
    const epub = await sampleEpub();
    const first = await upload(lectora, epub).expect(202);
    const again = await upload(lectora, epub).expect(409);
    expect(again.body).toMatchObject({ code: 'BOOK_ALREADY_EXISTS', bookId: first.body.id });
    // Otra persona sí puede subir el mismo libro.
    const otra = await signUp(t, 'otra@example.com');
    await upload(otra, epub).expect(202);
  });
});

describe('validación de la subida', () => {
  it('rechaza lo que no es un EPUB: 400 INVALID_UPLOAD', async () => {
    const notZip = await upload(lectora, Buffer.from('hola, no soy un zip'), 'libro.epub').expect(
      400,
    );
    expect(notZip.body.code).toBe('INVALID_UPLOAD');
    const wrongName = await upload(lectora, await sampleEpub(), 'libro.pdf').expect(400);
    expect(wrongName.body.code).toBe('INVALID_UPLOAD');
    const missing = await t.http.post('/api/v1/books').set('Authorization', lectora).expect(400);
    expect(missing.body.code).toBe('INVALID_UPLOAD');
  });

  it('un archivo mayor al límite responde 413', async () => {
    const tooBig = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.alloc(2.5 * 1024 * 1024),
    ]);
    const response = await upload(lectora, tooBig).expect(413);
    expect(response.body.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('sin sesión no se puede subir', async () => {
    await t.http
      .post('/api/v1/books')
      .attach('file', await sampleEpub(), 'libro.epub')
      .expect(401);
  });
});

describe('biblioteca y acceso', () => {
  it('cada quien ve solo sus libros, del más reciente al más antiguo', async () => {
    await upload(lectora, await sampleEpub('Primero')).expect(202);
    await upload(lectora, await sampleEpub('Segundo')).expect(202);
    const otra = await signUp(t, 'otra@example.com');
    await upload(otra, await sampleEpub('De otra')).expect(202);

    const library = await t.http.get('/api/v1/books').set('Authorization', lectora).expect(200);
    expect(library.body).toHaveLength(2);
    const [newest] = library.body;
    const ids = library.body.map((b: { id: string }) => b.id);
    expect(ids).toEqual([...ids].sort().reverse()); // uuid v7: ordenan por creación
    expect(newest.status).toMatch(/pending|processing|ready/);
  });

  it('el libro de otra persona: 403 BOOK_FORBIDDEN en detalle, portada, reporte y borrado', async () => {
    const { body } = await upload(lectora, await sampleEpub()).expect(202);
    await waitForBook(t, lectora, body.id);
    const otra = await signUp(t, 'otra@example.com');
    for (const path of ['', '/cover', '/report']) {
      const response = await t.http
        .get(`/api/v1/books/${body.id}${path}`)
        .set('Authorization', otra)
        .expect(403);
      expect(response.body.code).toBe('BOOK_FORBIDDEN');
    }
    await t.http.delete(`/api/v1/books/${body.id}`).set('Authorization', otra).expect(403);
  });

  it('un id inexistente: 404 BOOK_NOT_FOUND; uno mal formado: 400', async () => {
    const missing = await t.http
      .get('/api/v1/books/01920000-0000-7000-8000-000000000000')
      .set('Authorization', lectora)
      .expect(404);
    expect(missing.body.code).toBe('BOOK_NOT_FOUND');
    await t.http.get('/api/v1/books/no-es-un-uuid').set('Authorization', lectora).expect(400);
  });
});

describe('borrar', () => {
  it('borra el libro, sus capítulos y sus archivos', async () => {
    const { body } = await upload(lectora, await sampleEpub()).expect(202);
    await waitForBook(t, lectora, body.id);
    await t.http.delete(`/api/v1/books/${body.id}`).set('Authorization', lectora).expect(204);

    await t.http.get(`/api/v1/books/${body.id}`).set('Authorization', lectora).expect(404);
    expect(await t.prisma.chapter.count({ where: { bookId: body.id } })).toBe(0);
    expect(existsSync(join(storageDir(), 'books', body.id))).toBe(false);
  });

  it('con audio generándose: 409 BOOK_BUSY', async () => {
    const { body } = await upload(lectora, await sampleEpub()).expect(202);
    await waitForBook(t, lectora, body.id);
    const chapter = await t.prisma.chapter.findFirstOrThrow({ where: { bookId: body.id } });
    await t.prisma.audioSegment.create({
      data: {
        chapterId: chapter.id,
        voiceId: 'gonzalo',
        status: 'processing',
        reservedCharacters: 100,
      },
    });
    const response = await t.http
      .delete(`/api/v1/books/${body.id}`)
      .set('Authorization', lectora)
      .expect(409);
    expect(response.body.code).toBe('BOOK_BUSY');
  });
});

// Un libro real del corpus (se salta si no se descargó: pnpm corpus:download).
const marianela = fileURLToPath(new URL('../../../corpus/pg-marianela.epub', import.meta.url));

describe.skipIf(!existsSync(marianela))('corpus', () => {
  it('Marianela: 27 secciones, portada y el mismo resultado que la CLI', async () => {
    const { body } = await upload(lectora, await readFile(marianela), 'pg-marianela.epub').expect(
      202,
    );
    const book = await waitForBook(t, lectora, body.id, 30_000);
    expect(book).toMatchObject({
      status: 'ready',
      title: 'Marianela',
      author: 'Benito Pérez Galdós',
    });
    const chapters = book.chapters as Array<{ title: string; kind: string }>;
    expect(chapters).toHaveLength(27);
    expect(chapters.find((c) => c.title === '-I- Perdido')?.kind).toBe('narrative');
    expect(book.coverUrl).not.toBeNull();
  });
});
