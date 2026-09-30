import { afterEach, describe, expect, it } from 'vitest';
import { ApiClient } from '../src/api/client';
import { Session, userFromToken, type RememberedUser, type SessionUser } from '../src/api/session';

/** Un JWT sin firma válida: el cliente solo lee sub y email del payload. */
function jwt(sub: string, email: string, n: number): string {
  const payload = btoa(JSON.stringify({ sub, email, n })).replace(/=+$/, '');
  return `h.${payload}.s`;
}

/**
 * La API de auth en miniatura, como la real: el refresh token rota y, si se usa uno ya
 * rotado (dos pestañas con la misma cookie a la vez), revoca toda la familia. La cookie es
 * del navegador, compartida por todas las pestañas.
 */
class FakeAuthServer {
  cookie: string | null = 'r0';
  revoked = false;
  refreshCalls = 0;
  #n = 0;
  #valid = new Set(['r0']);

  fetch: typeof fetch = async (input, init) => {
    const path = String(input);
    const sentCookie = this.cookie; // lo que el navegador manda al salir la petición
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (path === '/api/v1/auth/refresh') {
      this.refreshCalls++;
      if (this.revoked || !sentCookie || !this.#valid.has(sentCookie)) {
        this.revoked = true; // reutilización: la familia entera queda revocada
        return json(401, { code: 'INVALID_REFRESH_TOKEN' });
      }
      this.#valid.delete(sentCookie);
      const next = `r${++this.#n}`;
      this.#valid.add(next);
      this.cookie = next;
      return json(200, { accessToken: jwt('u1', 'ana@example.com', this.#n), expiresIn: 900 });
    }
    if (path === '/api/v1/auth/login') {
      const body = JSON.parse(String(init?.body)) as { email: string };
      this.cookie = 'r-login';
      this.#valid.add('r-login');
      this.revoked = false;
      return json(200, {
        accessToken: jwt('u1', body.email, 100),
        expiresIn: 900,
        user: { id: 'u1', email: body.email },
      });
    }
    if (path === '/api/v1/auth/logout') return new Response(null, { status: 204 });
    const auth = new Headers(init?.headers).get('Authorization');
    return auth ? json(200, { ok: true }) : json(401, { code: 'UNAUTHORIZED' });
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Web Locks en miniatura: un mutex por nombre, compartido por las "pestañas". */
function fakeLocks() {
  const tails = new Map<string, Promise<unknown>>();
  return {
    request<T>(name: string, callback: () => Promise<T>): Promise<T> {
      const previous = tails.get(name) ?? Promise.resolve();
      const run = previous.then(callback, callback);
      tails.set(
        name,
        run.catch(() => undefined),
      );
      return run;
    },
  };
}

/** La cuenta recordada, en memoria (en la app va a localStorage). */
function memory(initial: SessionUser | null): RememberedUser {
  let user = initial;
  return { load: () => user, save: (next) => void (user = next) };
}

const channels: BroadcastChannel[] = [];
function channel(): BroadcastChannel {
  const c = new BroadcastChannel('lectio-test-session');
  channels.push(c);
  return c;
}
afterEach(() => {
  for (const c of channels.splice(0)) c.close();
});

describe('Session', () => {
  it('restore: con la cookie viva se recupera la sesión, con el usuario del JWT', async () => {
    const server = new FakeAuthServer();
    const session = new Session({ fetch: server.fetch });
    expect(await session.restore()).toEqual({
      status: 'authenticated',
      user: { id: 'u1', email: 'ana@example.com' },
    });
  });

  it('sin cookie: anónimo', async () => {
    const server = new FakeAuthServer();
    server.cookie = null;
    const session = new Session({ fetch: server.fetch });
    expect((await session.restore()).status).toBe('anonymous');
    expect(await session.accessToken()).toBeNull();
  });

  it('varias peticiones a la vez con el token vencido: un solo refresh', async () => {
    const server = new FakeAuthServer();
    let now = 0;
    const session = new Session({ fetch: server.fetch, now: () => now });
    await session.restore();
    now = 900_000; // venció
    const tokens = await Promise.all([1, 2, 3, 4].map(() => session.accessToken()));
    expect(new Set(tokens).size).toBe(1);
    expect(server.refreshCalls).toBe(2); // el de restore y uno solo después
    expect(server.revoked).toBe(false);
  });

  it('dos pestañas renovando a la vez: el lock evita que la API revoque la familia', async () => {
    const server = new FakeAuthServer();
    const locks = fakeLocks();
    const a = new Session({ fetch: server.fetch, locks, channel: channel() });
    const b = new Session({ fetch: server.fetch, locks, channel: channel() });
    const [okA, okB] = await Promise.all([a.refresh(), b.refresh()]);
    expect([okA, okB]).toEqual([true, true]);
    expect(server.revoked).toBe(false);
    expect(a.state.status).toBe('authenticated');
    expect(b.state.status).toBe('authenticated');
  });

  it('sin el lock, las mismas dos pestañas cierran la sesión en todas (por eso existe)', async () => {
    const server = new FakeAuthServer();
    const a = new Session({ fetch: server.fetch });
    const b = new Session({ fetch: server.fetch });
    const results = await Promise.all([a.refresh(), b.refresh()]);
    expect(results).toContain(false);
    expect(server.revoked).toBe(true);
  });

  it('si el refresh falla con sesión abierta: expired (se conserva el usuario para el pergamino)', async () => {
    const server = new FakeAuthServer();
    let now = 0;
    const session = new Session({ fetch: server.fetch, now: () => now });
    await session.restore();
    server.revoked = true; // p. ej., se cerró la sesión desde otro dispositivo
    now = 900_000;
    expect(await session.accessToken()).toBeNull();
    expect(session.state).toEqual({
      status: 'expired',
      user: { id: 'u1', email: 'ana@example.com' },
    });
  });

  it('login y logout en una pestaña se reflejan en la otra', async () => {
    const server = new FakeAuthServer();
    server.cookie = null;
    const a = new Session({ fetch: server.fetch, channel: channel() });
    const b = new Session({ fetch: server.fetch, channel: channel() });
    await Promise.all([a.restore(), b.restore()]);
    const seen: string[] = [];
    b.subscribe((state) => seen.push(state.status));

    await a.login('ana@example.com', 'x');
    await until(() => b.state.status === 'authenticated');
    expect(await b.accessToken()).toBe(await a.accessToken());

    await a.logout();
    await until(() => b.state.status === 'anonymous');
    expect(seen).toEqual(['authenticated', 'anonymous']);
  });

  it('sin red al abrir: sigue la cuenta de este navegador y, al volver la red, renueva', async () => {
    const server = new FakeAuthServer();
    const remember = memory({ id: 'u1', email: 'ana@example.com' });
    let online = false;
    const fetcher: typeof fetch = (input, init) =>
      online ? server.fetch(input, init) : Promise.reject(new TypeError('Failed to fetch'));
    const session = new Session({ fetch: fetcher, remember });

    expect(await session.restore()).toEqual({
      status: 'authenticated',
      user: { id: 'u1', email: 'ana@example.com' },
    });
    expect(await session.accessToken()).toBeNull(); // sin red no hay token, pero no se cierra
    expect(session.state.status).toBe('authenticated');

    online = true;
    expect(await session.accessToken()).toMatch(/^h\./);
  });

  it('sin red y sin cuenta recordada: anónimo', async () => {
    const session = new Session({
      fetch: () => Promise.reject(new TypeError('Failed to fetch')),
      remember: memory(null),
    });
    expect((await session.restore()).status).toBe('anonymous');
  });

  it('con red, un refresh rechazado olvida la cuenta: no se abre sin conexión después', async () => {
    const server = new FakeAuthServer();
    server.cookie = null;
    const remember = memory({ id: 'u1', email: 'ana@example.com' });
    const session = new Session({ fetch: server.fetch, remember });
    expect((await session.restore()).status).toBe('anonymous');
    expect(remember.load()).toBeNull();
  });

  it('entrar recuerda la cuenta y salir la olvida', async () => {
    const server = new FakeAuthServer();
    const remember = memory(null);
    const session = new Session({ fetch: server.fetch, remember });
    await session.login('ana@example.com', 'x');
    expect(remember.load()).toEqual({ id: 'u1', email: 'ana@example.com' });
    await session.logout();
    expect(remember.load()).toBeNull();
  });

  it('userFromToken lee correos con tildes', () => {
    const token = `h.${btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify({ sub: 'u', email: 'josé@ejemplo.com' }))))}.s`;
    expect(userFromToken(token)).toEqual({ id: 'u', email: 'josé@ejemplo.com' });
  });
});

describe('ApiClient', () => {
  it('pone el token y, ante un 401, renueva una vez y reintenta', async () => {
    const server = new FakeAuthServer();
    let rejectNext = true;
    const fetcher: typeof fetch = async (input, init) => {
      if (String(input) === '/api/v1/books' && rejectNext) {
        rejectNext = false; // el token venció entre medio
        return json(401, { code: 'UNAUTHORIZED' });
      }
      return server.fetch(input, init);
    };
    const session = new Session({ fetch: fetcher });
    await session.restore();
    const client = new ApiClient(session, fetcher);
    expect(await client.get('/api/v1/books')).toEqual({ ok: true });
    expect(server.refreshCalls).toBe(2);
  });

  it('los errores llegan con el code de la API', async () => {
    const fetcher: typeof fetch = async () =>
      json(429, { code: 'TTS_QUOTA_EXCEEDED', message: 'Sin cuota', remaining: 10 });
    const client = new ApiClient(new Session({ fetch: fetcher }), fetcher);
    await expect(client.post('/api/v1/chapters/x/audio')).rejects.toMatchObject({
      status: 429,
      code: 'TTS_QUOTA_EXCEEDED',
      body: { remaining: 10 },
    });
  });
});

async function until(condition: () => boolean, timeoutMs = 1000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('No se cumplió a tiempo');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
