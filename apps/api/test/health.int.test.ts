import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
});

afterAll(async () => {
  await t.close();
});

describe('GET /api/v1/health', () => {
  it('responde ok con la base y Redis arriba', async () => {
    const response = await t.http.get('/api/v1/health').expect(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      database: { status: 'up' },
      redis: { status: 'up' },
    });
  });

  it('usa la base de tests, no la de desarrollo', async () => {
    const [row] = await t.prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`;
    expect(row?.db).toBe('lectio_test');
  });
});

describe('errores', () => {
  it('una ruta inexistente responde con el formato común', async () => {
    const response = await t.http.get('/api/v1/no-existe').expect(404);
    expect(response.body).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Cannot GET /api/v1/no-existe',
      error: 'Not Found',
    });
  });
});

describe('OpenAPI', () => {
  it('publica el documento con la ruta de salud', async () => {
    const response = await t.http.get('/api/docs-json').expect(200);
    expect(response.body.info.title).toBe('Lectio API');
    expect(Object.keys(response.body.paths)).toContain('/api/v1/health');
  });
});
