import { Module } from '@nestjs/common';
import { ProcessBookService } from './application/process-book.service.js';
import { BookReprocessingModule } from './book-reprocessing.module.js';
import { BOOK_REPOSITORY } from './domain/ports.js';
import { PrismaBookRepository } from './infrastructure/persistence/prisma-book.repository.js';
import { BookProcessingProcessor } from './infrastructure/queue/book-processing.processor.js';

/** Lado worker: consume book-processing y corre el pipeline (al subir y al reprocesar). */
@Module({
  imports: [BookReprocessingModule],
  providers: [
    ProcessBookService,
    BookProcessingProcessor,
    { provide: BOOK_REPOSITORY, useClass: PrismaBookRepository },
  ],
})
export class BookProcessingModule {}
