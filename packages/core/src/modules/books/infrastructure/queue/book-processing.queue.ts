import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { PIPELINE_VERSION } from '@lectio/epub-pipeline';
import type { Queue } from 'bullmq';
import { QUEUES } from '../../../../infrastructure/queues/queues.module.js';
import type { BookProcessingQueue } from '../../domain/ports.js';

export interface BookProcessingJob {
  bookId: string;
}

/** Nombres de los jobs de book-processing: procesar lo subido o reprocesar lo ya listo. */
export const BOOK_JOBS = { process: 'process', reprocess: 'reprocess' } as const;

/**
 * Encola el procesamiento de un libro. El id del job es el del libro: encolar dos veces el
 * mismo libro no lo procesa dos veces. Tres intentos con espera creciente (errores
 * inesperados; los del pipeline no se reintentan).
 */
@Injectable()
export class BullBookProcessingQueue implements BookProcessingQueue {
  constructor(
    @InjectQueue(QUEUES.bookProcessing) private readonly queue: Queue<BookProcessingJob>,
  ) {}

  async enqueue(bookId: string): Promise<void> {
    await this.queue.add(
      BOOK_JOBS.process,
      { bookId },
      {
        jobId: bookId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    );
  }

  /**
   * El id incluye la versión: dos pedidos mientras espera son un solo job. Terminado (o
   * fallido) se quita, así volver a correr el script lo intenta de nuevo (por ejemplo,
   * uno postergado porque tenía audio generándose).
   */
  async enqueueReprocess(bookId: string): Promise<void> {
    await this.queue.add(
      BOOK_JOBS.reprocess,
      { bookId },
      {
        jobId: `reprocess-${bookId}-v${PIPELINE_VERSION}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }
}
