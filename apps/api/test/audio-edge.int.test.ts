import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildEpub } from '../../../packages/epub-pipeline/test/helpers/build-epub.js';
import {
  createTestApp,
  signUp,
  waitForAudio,
  waitForBook,
  type TestApp,
} from './helpers/test-app.js';

/**
 * Lento y con red: genera un capítulo corto con Edge TTS de verdad. Solo corre con
 * LECTIO_EDGE_TESTS=1 (pnpm test:integration:edge), para no depender de un servicio externo
 * en cada corrida.
 */
describe.skipIf(!process.env.LECTIO_EDGE_TESTS)('generación con Edge TTS', () => {
  let t: TestApp;

  beforeAll(async () => {
    process.env.TTS_PROVIDER = 'edge';
    t = await createTestApp({ worker: true });
    await t.reset();
  });

  afterAll(async () => {
    await t?.close();
  });

  it('un capítulo corto con narración y diálogo', { timeout: 120_000 }, async () => {
    const auth = await signUp(t, 'edge@example.com');
    const epub = await buildEpub({
      metadata: { title: 'Prueba con Edge', creators: ['Ana Autora'], language: 'es' },
      chapters: [
        {
          id: 'cap1',
          title: 'Uno',
          body: '<h1>Uno</h1><p>El viajero se detuvo junto al camino.</p><p>—¿Qué llevas ahí? —preguntó.</p><p>—Nada, señor.</p>',
        },
      ],
    });
    const { body } = await t.http
      .post('/api/v1/books')
      .set('Authorization', auth)
      .attach('file', epub, 'edge.epub')
      .expect(202);
    const book = (await waitForBook(t, auth, body.id)) as unknown as {
      chapters: Array<{ id: string }>;
    };
    const chapterId = book.chapters[0]!.id;
    await t.http.post(`/api/v1/chapters/${chapterId}/audio`).set('Authorization', auth).expect(202);

    const state = await waitForAudio(t, auth, chapterId, 'gonzalo', 110_000);
    expect(state).toMatchObject({ status: 'ready', provider: 'edge' });
    expect(state.durationMs as number).toBeGreaterThan(2000);
    const alignment = await t.http.get(state.alignmentUrl as string).expect(200);
    expect(alignment.body.sentences.length).toBeGreaterThanOrEqual(3);
  });
});
