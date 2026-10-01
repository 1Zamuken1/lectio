import { QueryClient, onlineManager } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError, type ApiClient } from '../src/api/client';
import { memoryQueue, type ProgressQueue } from '../src/pwa/progress-queue';
import { ProgressSync } from '../src/reader/position';

type Outcome = 'ok' | 'offline' | 'down' | 'gone' | 'expired';

/** La API en miniatura: cada PUT responde según `next` y queda anotado si llegó. */
function fakeApi() {
  const sent: Array<{ path: string; body: { chapterId: string; clientUpdatedAt: string } }> = [];
  const state = { next: 'ok' as Outcome };
  const api = {
    async put(path: string, body: { chapterId: string; clientUpdatedAt: string }) {
      switch (state.next) {
        case 'offline':
          throw new TypeError('Failed to fetch');
        case 'down':
          throw new ApiError(503, 'UNAVAILABLE', 'caída', {});
        case 'gone':
          throw new ApiError(404, 'BOOK_NOT_FOUND', 'no está', {});
        case 'expired':
          throw new ApiError(401, 'UNAUTHORIZED', 'venció', {});
        default:
          sent.push({ path, body });
      }
    },
  };
  return { api: api as unknown as ApiClient, sent, state };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('ProgressSync: la cola sin conexión', () => {
  let queue: ProgressQueue;
  let user: string | null;
  let fake: ReturnType<typeof fakeApi>;
  let sync: ProgressSync;

  beforeEach(() => {
    queue = memoryQueue();
    user = 'u1';
    fake = fakeApi();
    sync = new ProgressSync(fake.api, new QueryClient(), () => user, queue);
    onlineManager.setOnline(true);
  });

  afterEach(() => onlineManager.setOnline(true));

  it('sin red no intenta enviar: encola, y al volver manda solo la última de cada libro', async () => {
    onlineManager.setOnline(false);
    sync.record('b1', 'c1', 3);
    sync.flush('b1', false);
    await new Promise((resolve) => setTimeout(resolve, 5));
    sync.record('b1', 'c2', 7);
    sync.flush('b1', false);
    sync.record('b2', 'c9', 1);
    sync.flush('b2', false);
    await tick();
    expect(fake.sent).toHaveLength(0);
    expect((await queue.list('u1')).map((e) => e.position.chapterId).sort()).toEqual(['c2', 'c9']);

    onlineManager.setOnline(true);
    await sync.sync();
    expect(fake.sent.map((s) => s.path).sort()).toEqual([
      '/api/v1/books/b1/progress',
      '/api/v1/books/b2/progress',
    ]);
    expect(fake.sent.find((s) => s.path.includes('b1'))?.body.chapterId).toBe('c2');
    expect(await queue.list('u1')).toHaveLength(0);
  });

  it('si el envío falla por la red o la API caída, la posición espera en la cola', async () => {
    for (const outcome of ['offline', 'down'] as const) {
      fake.state.next = outcome;
      sync.record('b1', `c-${outcome}`, 0);
      sync.flush('b1', false);
      await tick();
    }
    const [entry] = await queue.list('u1');
    expect(entry?.position.chapterId).toBe('c-down');
  });

  it('un 4xx descarta (libro borrado); un 401 o la red caída de nuevo la dejan para después', async () => {
    await queue.put({ userId: 'u1', bookId: 'b1', position: position('c1', 1) });
    fake.state.next = 'offline';
    await sync.sync();
    expect(await queue.list('u1')).toHaveLength(1);
    fake.state.next = 'expired';
    await sync.sync();
    expect(await queue.list('u1')).toHaveLength(1);
    fake.state.next = 'gone';
    await sync.sync();
    expect(await queue.list('u1')).toHaveLength(0);
  });

  it('cada cuenta envía solo lo suyo', async () => {
    await queue.put({ userId: 'u2', bookId: 'b1', position: position('otra', 1) });
    await sync.sync();
    expect(fake.sent).toHaveLength(0);
    user = 'u2';
    await sync.sync();
    expect(fake.sent[0]?.body.chapterId).toBe('otra');
  });

  it('en la cola no se pisa una posición nueva con una vieja', async () => {
    await queue.put({ userId: 'u1', bookId: 'b1', position: position('nueva', 2000) });
    await queue.put({ userId: 'u1', bookId: 'b1', position: position('vieja', 1000) });
    expect((await queue.list('u1'))[0]?.position.chapterId).toBe('nueva');
  });

  it('sin sesión no encola nada (el progreso queda en el navegador)', async () => {
    user = null;
    onlineManager.setOnline(false);
    sync.record('b1', 'c1', 3);
    sync.flush('b1', false);
    await tick();
    expect(await queue.list('u1')).toHaveLength(0);
  });
});

function position(chapterId: string, at: number) {
  return {
    chapterId,
    sentenceIndex: 0,
    mode: 'reading' as const,
    clientUpdatedAt: new Date(at).toISOString(),
  };
}
