import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers/test-app.js';

// Orígenes de este archivo (corre en su propio proceso).
process.env.CORS_ORIGINS = 'http://localhost:5173';

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
});

afterAll(async () => {
  await t.close();
});

describe('CORS (arquitectura §1.10)', () => {
  it('un origen permitido recibe permiso con credenciales (para la cookie de sesión)', async () => {
    const response = await t.http
      .options('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('un origen desconocido no recibe permiso (nunca "*")', async () => {
    const response = await t.http
      .options('/api/v1/auth/refresh')
      .set('Origin', 'https://sitio-ajeno.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
