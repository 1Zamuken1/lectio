import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUES } from '../../../../infrastructure/queues/queues.module.js';
import { ProcessBookService, type ProcessOutcome } from '../../application/process-book.service.js';
import {
  ReprocessBookService,
  type ReprocessOutcome,
} from '../../application/reprocess-book.service.js';
import { BOOK_JOBS, type BookProcessingJob } from './book-processing.queue.js';

/**
 * Consume `book-processing` en el worker. Parsear un EPUB es rápido y local, así que se
 * procesan dos a la vez sin afectar a la cola de audio (que tiene su propio límite).
 */
@Processor(QUEUES.bookProcessing, { concurrency: 2 })
export class BookProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger('BookProcessing');

  constructor(
    private readonly processBook: ProcessBookService,
    private readonly reprocessBook: ReprocessBookService,
  ) {
    super();
  }

  async process(job: Job<BookProcessingJob>): Promise<ProcessOutcome | ReprocessOutcome> {
    if (job.name === BOOK_JOBS.reprocess) return this.#reprocess(job.data.bookId);
    const started = performance.now();
    const outcome = await this.processBook.process(job.data.bookId);
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    if (outcome.status === 'ready') {
      this.logger.log(`Libro ${job.data.bookId}: ${outcome.chapters} capítulos en ${seconds} s`);
    }
    return outcome;
  }

  async #reprocess(bookId: string): Promise<ReprocessOutcome> {
    const outcome = await this.reprocessBook.reprocess(bookId);
    if (outcome.status === 'reprocessed') {
      this.logger.log(
        `Libro ${bookId} reprocesado (v${outcome.from ?? 0} → v${outcome.to}): ${outcome.kept} capítulos conservados, ${outcome.created} nuevos, ${outcome.removed} quitados`,
      );
    } else if (outcome.status === 'deferred') {
      this.logger.warn(`Libro ${bookId}: reprocesamiento postergado, tiene audio generándose`);
    }
    return outcome;
  }

  /** Tras el último reintento, el libro queda en error con un código genérico. */
  @OnWorkerEvent('failed')
  async onFailed(job: Job<BookProcessingJob> | undefined, error: Error): Promise<void> {
    if (!job) return;
    if (job.name === BOOK_JOBS.reprocess) {
      // Reprocesar nunca deja un libro en error: sigue listo con la versión que tenía.
      this.logger.error(`Libro ${job.data.bookId}: reprocesar falló (${error.message})`);
      return;
    }
    const final = job.attemptsMade >= (job.opts.attempts ?? 1);
    this.logger.error(
      `Libro ${job.data.bookId}: intento ${job.attemptsMade} falló (${error.message})${final ? ', sin más reintentos' : ''}`,
    );
    if (final) await this.processBook.giveUp(job.data.bookId, error);
  }
}
