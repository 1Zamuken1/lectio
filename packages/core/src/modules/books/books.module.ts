import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { BooksService } from './application/books.service.js';
import { BOOK_PROCESSING_QUEUE, BOOK_REPOSITORY } from './domain/ports.js';
import { BooksController } from './infrastructure/http/books.controller.js';
import { PrismaBookRepository } from './infrastructure/persistence/prisma-book.repository.js';
import { BullBookProcessingQueue } from './infrastructure/queue/book-processing.queue.js';

/**
 * Biblioteca personal, lado API: subir, listar, ver y borrar libros. El procesamiento vive
 * en BookProcessingModule, que registra solo el worker.
 */
@Module({
  imports: [
    // El EPUB llega a memoria (no a disco) con un tamaño máximo; se valida antes de guardarlo.
    MulterModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        storage: memoryStorage(),
        limits: { fileSize: Math.round(config.MAX_UPLOAD_MB * 1024 * 1024), files: 1 },
      }),
    }),
  ],
  controllers: [BooksController],
  providers: [
    BooksService,
    { provide: BOOK_REPOSITORY, useClass: PrismaBookRepository },
    { provide: BOOK_PROCESSING_QUEUE, useClass: BullBookProcessingQueue },
  ],
  exports: [BooksService, BOOK_REPOSITORY],
})
export class BooksModule {}
