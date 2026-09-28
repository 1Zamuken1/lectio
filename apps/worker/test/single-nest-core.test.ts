import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

/**
 * NestJS necesita una sola copia de @nestjs/core: con dos, la inyección falla al arrancar
 * ("Nest can't resolve dependencies of the DiscoveryService"). pnpm crea una copia por cada
 * combinación de dependencias peer, así que el worker declara las mismas que packages/core
 * (incluida @nestjs/platform-express, aunque no la use).
 */
describe('dependencias', () => {
  it('el worker, la API y el núcleo usan la misma copia de @nestjs/core', () => {
    const resolve = (pkg: string) =>
      realpathSync(
        createRequire(new URL(`../../../${pkg}/package.json`, import.meta.url)).resolve(
          '@nestjs/core',
        ),
      );
    const worker = resolve('apps/worker');
    expect(resolve('packages/core')).toBe(worker);
    expect(resolve('apps/api')).toBe(worker);
  });
});
