import { Module } from '@nestjs/common';
import { SystemAudioService } from '../audio/application/system-audio.service.js';
import { AUDIO_GENERATION_QUEUE, AUDIO_REPOSITORY } from '../audio/domain/ports.js';
import { PrismaAudioRepository } from '../audio/infrastructure/persistence/prisma-audio.repository.js';
import { BullAudioGenerationQueue } from '../audio/infrastructure/queue/audio-generation.queue.js';
import { ProcessBookService } from './application/process-book.service.js';
import { PublicCatalogService } from './application/public-catalog.service.js';
import { BOOK_REPOSITORY } from './domain/ports.js';
import { PrismaBookRepository } from './infrastructure/persistence/prisma-book.repository.js';

/**
 * Carga del catálogo público (pnpm seed:public): publica libros sin dueño y encola su audio
 * como sistema. No registra controladores ni processors; lo usa un script interno.
 */
@Module({
  providers: [
    PublicCatalogService,
    ProcessBookService,
    SystemAudioService,
    { provide: BOOK_REPOSITORY, useClass: PrismaBookRepository },
    { provide: AUDIO_REPOSITORY, useClass: PrismaAudioRepository },
    { provide: AUDIO_GENERATION_QUEUE, useClass: BullAudioGenerationQueue },
  ],
  exports: [PublicCatalogService, SystemAudioService],
})
export class PublicCatalogModule {}
