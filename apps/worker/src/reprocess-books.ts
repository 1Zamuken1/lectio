import 'reflect-metadata';
import { parseArgs } from 'node:util';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  BookReprocessingModule,
  ConfigModule,
  PrismaModule,
  QueuesModule,
  RedisModule,
  ReprocessBookService,
  StorageModule,
  type ReprocessOutcome,
} from '@lectio/core';
import { PIPELINE_VERSION } from '@lectio/epub-pipeline';

/**
 * Reprocesa con la versión actual del pipeline los libros listos que se procesaron con una
 * anterior (Book.pipeline_version). Por defecto los encola para el worker; con --inline los
 * procesa aquí mismo (no hace falta el worker, salvo para el audio público que se encola).
 * Se puede correr de nuevo: los que ya están al día se saltan.
 *
 *   pnpm reprocess:books --dry-run           qué libros se reprocesarían
 *   pnpm reprocess:books                     encolarlos todos
 *   pnpm reprocess:books --books <id>,<id> --inline
 *
 * Los libros siguen listos mientras tanto. Nada se cobra: el audio cuya narración cambió
 * queda obsoleto y el usuario lo regenera gratis; el de los libros públicos se encola solo.
 */

const USAGE = `Uso: pnpm reprocess:books [--books id1,id2] [--dry-run] [--inline]`;

const { values } = parseArgs({
  options: {
    books: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    inline: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h' },
  },
});
if (values.help) {
  console.log(USAGE);
  process.exit(0);
}
const ids = values.books
  ?.split(',')
  .map((id) => id.trim())
  .filter(Boolean);
const invalid = ids?.filter((id) => !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id));
if (invalid?.length) {
  console.error(`--books espera ids de libro (uuid): ${invalid.join(', ')}\n${USAGE}`);
  process.exit(1);
}

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    QueuesModule,
    StorageModule,
    BookReprocessingModule,
  ],
})
class ReprocessModule {}

const app = await NestFactory.createApplicationContext(ReprocessModule, {
  logger: ['error', 'warn'],
});
const reprocess = app.get(ReprocessBookService);
let failures = 0;

try {
  const stale = await reprocess.listStale(ids);
  const missing = ids?.filter((id) => !stale.some((book) => book.id === id)) ?? [];
  for (const id of missing)
    console.log(`- ${id}: no existe, no está listo o ya está en v${PIPELINE_VERSION}`);
  if (stale.length === 0)
    console.log(`No hay libros por reprocesar (versión actual: v${PIPELINE_VERSION}).`);

  for (const book of stale) {
    const label = `${book.id} (${book.title ?? 'sin título'}${book.isPublic ? ', público' : ''}, v${book.pipelineVersion ?? 0})`;
    if (values['dry-run']) {
      console.log(`· ${label}`);
    } else if (!values.inline) {
      await reprocess.enqueue(book.id);
      console.log(`+ ${label}: en cola`);
    } else {
      const outcome = await reprocess.reprocess(book.id);
      if (outcome.status === 'failed') failures++;
      console.log(
        `${outcome.status === 'reprocessed' ? '+' : outcome.status === 'failed' ? 'x' : '-'} ${label}: ${describe(outcome)}`,
      );
    }
  }
  if (stale.length > 0 && values['dry-run']) {
    console.log(`\n${stale.length} libro(s) por reprocesar a v${PIPELINE_VERSION}.`);
  } else if (stale.length > 0 && !values.inline) {
    console.log('\nEl worker los reprocesa en segundo plano (pnpm dev).');
  }
} finally {
  await app.close();
}
process.exitCode = failures ? 1 : 0;

function describe(outcome: ReprocessOutcome): string {
  switch (outcome.status) {
    case 'reprocessed': {
      let line = `v${outcome.to}; ${outcome.kept} capítulo(s) conservados`;
      if (outcome.created) line += `, ${outcome.created} nuevo(s)`;
      if (outcome.removed) line += `, ${outcome.removed} quitado(s)`;
      if (outcome.progressMoved) line += `, ${outcome.progressMoved} progreso(s) movidos`;
      if (outcome.publicAudioEnqueued)
        line += ` · ${outcome.publicAudioEnqueued} audio(s) públicos en cola`;
      return line;
    }
    case 'skipped':
      return `se salta (${outcome.reason})`;
    case 'deferred':
      return 'postergado: tiene audio generándose; correrlo de nuevo más tarde';
    case 'failed':
      return `sigue con su versión (${outcome.code}: ${outcome.message})`;
  }
}
