import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  ConfigModule,
  PrismaModule,
  PublicCatalogModule,
  PublicCatalogService,
  QueuesModule,
  RedisModule,
  StorageModule,
  SystemAudioService,
} from '@lectio/core';

/**
 * Carga libros del corpus a la biblioteca pública y encola su audio como sistema (sin
 * cuota). Se puede correr de nuevo: lo ya publicado y el audio ya generado se saltan.
 *
 *   pnpm seed:public                              los libros en español del corpus, 3 capítulos con audio
 *   pnpm seed:public --books pg-marianela --audio all
 *   pnpm seed:public --audio none --voice salome
 *
 * El audio lo genera el worker (pnpm dev), respetando el límite global hacia el proveedor.
 */

const USAGE = `Uso: pnpm seed:public [--books id1,id2] [--audio <n|all|none>] [--voice <perfil>]`;

const { values } = parseArgs({
  options: {
    books: { type: 'string' },
    audio: { type: 'string', default: '3' },
    voice: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
});
if (values.help) {
  console.log(USAGE);
  process.exit(0);
}
const audioLimit =
  values.audio === 'all' ? null : values.audio === 'none' ? 0 : Number(values.audio);
if (audioLimit !== null && (!Number.isInteger(audioLimit) || audioLimit < 0)) {
  console.error(`--audio debe ser un número, all o none.\n${USAGE}`);
  process.exit(1);
}

const corpusDir = new URL('../../../corpus/', import.meta.url);
const sources = JSON.parse(await readFile(new URL('sources.json', corpusDir), 'utf8')) as {
  books: Array<{ id: string; title: string; language: string }>;
};
const wanted = values.books?.split(',').map((id) => id.trim());
const selected = sources.books.filter((book) =>
  wanted ? wanted.includes(book.id) : book.language === 'es',
);
const unknown = wanted?.filter((id) => !sources.books.some((b) => b.id === id)) ?? [];
if (unknown.length > 0) {
  console.error(`No están en corpus/sources.json: ${unknown.join(', ')}`);
  process.exit(1);
}

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    QueuesModule,
    StorageModule,
    PublicCatalogModule,
  ],
})
class SeedModule {}

const app = await NestFactory.createApplicationContext(SeedModule, { logger: ['error', 'warn'] });
const catalog = app.get(PublicCatalogService);
const audio = app.get(SystemAudioService);
let failures = 0;

try {
  for (const book of selected) {
    const path = new URL(`${book.id}.epub`, corpusDir);
    if (!existsSync(path)) {
      console.log(`- ${book.id}: no está descargado (pnpm corpus:download), se salta`);
      continue;
    }
    const published = await catalog.publish({ epub: await readFile(path), title: book.title });
    if (published.status === 'error') {
      failures++;
      console.error(`x ${book.id}: ${published.errorCode ?? 'error al procesar'}`);
      continue;
    }
    const verb = published.created ? 'publicado' : 'ya estaba';
    let line = `+ ${book.id}: ${verb} en /libros/${published.slug}`;
    if (audioLimit !== 0) {
      const queued = await audio.enqueueBook(published.id, {
        language: published.language,
        voiceId: values.voice,
        limit: audioLimit,
      });
      line += ` · audio con ${queued.voiceId}: ${queued.enqueued} capítulo(s) en cola`;
      if (queued.skipped > 0) line += `, ${queued.skipped} ya listo(s) o en curso`;
    }
    console.log(line);
  }
} finally {
  await app.close();
}

if (selected.length === 0) console.log('No hay libros que cargar con esa selección.');
else if (audioLimit !== 0) console.log('\nEl worker genera el audio en segundo plano (pnpm dev).');
process.exitCode = failures ? 1 : 0;
