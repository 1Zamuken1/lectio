import { Module } from '@nestjs/common';
import { SystemAudioService } from '../audio/application/system-audio.service.js';
import { AUDIO_GENERATION_QUEUE, AUDIO_REPOSITORY } from '../audio/domain/ports.js';
import { PrismaAudioRepository } from '../audio/infrastructure/persistence/prisma-audio.repository.js';
import { BullAudioGenerationQueue } from '../audio/infrastructure/queue/audio-generation.queue.js';
import { ReprocessBookService } from './application/reprocess-book.service.js';
import { BOOK_PROCESSING_QUEUE, BOOK_REPOSITORY } from './domain/ports.js';
import { PrismaBookRepository } from './infrastructure/persistence/prisma-book.repository.js';
import { BullBookProcessingQueue } from './infrastructure/queue/book-processing.queue.js';

/**
 * Reprocesar libros con la versión actual del pipeline. Lo usan el worker (el job
 * `reprocess` de book-processing) y el script interno pnpm reprocess:books, que encola o
 * reprocesa en el mismo proceso. Encola el audio del sistema de los libros públicos.
 */
@Module({
  providers: [
    ReprocessBookService,
    SystemAudioService,
    { provide: BOOK_REPOSITORY, useClass: PrismaBookRepository },
    { provide: BOOK_PROCESSING_QUEUE, useClass: BullBookProcessingQueue },
    { provide: AUDIO_REPOSITORY, useClass: PrismaAudioRepository },
    { provide: AUDIO_GENERATION_QUEUE, useClass: BullAudioGenerationQueue },
  ],
  exports: [ReprocessBookService],
})
export class BookReprocessingModule {}
