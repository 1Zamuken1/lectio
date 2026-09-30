import 'reflect-metadata';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { openApiConfig } from './app.js';

/**
 * Escribe el documento OpenAPI sin levantar la API: en modo preview Nest arma el grafo de
 * módulos y controladores sin instanciar proveedores (no conecta a Postgres ni a Redis).
 * De este archivo salen los tipos de apps/web (pnpm --filter @lectio/web api:types).
 *
 *   node … src/openapi.ts <salida.json>
 */
/** El documento OpenAPI de la API, tal como lo sirve /api/docs. */
export async function buildOpenApi(): Promise<string> {
  const app = await NestFactory.create(AppModule, { preview: true, logger: false });
  app.setGlobalPrefix('api/v1');
  const document = SwaggerModule.createDocument(app, openApiConfig());
  await app.close();
  return `${JSON.stringify(document, null, 2)}
`;
}

// Ejecutado como script (no importado desde el test).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = process.argv[2];
  if (!out) throw new Error('Uso: openapi.ts <salida.json>');
  await writeFile(out, await buildOpenApi());
}
