import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';

/**
 * Colas de BullMQ (docs/lectio-arquitectura-api.md §1.5), separadas porque tienen perfiles
 * de carga distintos: parsear un EPUB es rápido y local; sintetizar audio depende de un
 * servicio externo y puede reintentar. La API encola; el worker procesa.
 */
export const QUEUES = {
  bookProcessing: 'book-processing',
  audioGeneration: 'audio-generation',
} as const;

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        connection: { url: config.REDIS_URL, maxRetriesPerRequest: null },
        prefix: 'lectio',
      }),
    }),
    BullModule.registerQueue({ name: QUEUES.bookProcessing }, { name: QUEUES.audioGeneration }),
  ],
  exports: [BullModule],
})
export class QueuesModule {}
