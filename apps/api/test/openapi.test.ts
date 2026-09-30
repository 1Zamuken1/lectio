import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { buildOpenApi } from '../src/openapi.js';

/**
 * Los tipos de apps/web salen de apps/web/src/api/openapi.json. Si la API cambia y no se
 * regeneran, la app compilaría contra un contrato viejo: este test lo detecta.
 */
describe('OpenAPI para apps/web', () => {
  it('apps/web/src/api/openapi.json está al día (si falla: pnpm --filter @lectio/web api:types)', async () => {
    const committed = await readFile(
      new URL('../../web/src/api/openapi.json', import.meta.url),
      'utf8',
    );
    expect(JSON.parse(committed)).toEqual(JSON.parse(await buildOpenApi()));
  });
});
