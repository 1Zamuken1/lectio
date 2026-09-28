import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers/test-app.js';

// Este archivo corre en su propio proceso: encender el límite aquí no afecta a los demás.
process.env.RATE_LIMIT_ENABLED = 'true';

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
  await t.reset();
});

afterAll(async () => {
  await t.close();
});

describe('límite de solicitudes (arquitectura §1.8)', () => {
  it('el sexto login en un minuto desde la misma IP responde 429', async () => {
    const attempt = () =>
      t.http
        .post('/api/v1/auth/login')
        .send({ email: 'x@example.com', password: 'contraseña mala' });
    for (let i = 0; i < 5; i++) expect((await attempt()).status).toBe(401);
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('TOO_MANY_REQUESTS');
  });

  it('el límite de login no bloquea el resto de la API', async () => {
    await t.http.get('/api/v1/health').expect(200);
  });
});
