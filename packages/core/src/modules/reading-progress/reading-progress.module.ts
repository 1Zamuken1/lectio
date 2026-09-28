import { Module } from '@nestjs/common';
import { BooksModule } from '../books/books.module.js';
import { ChaptersModule } from '../chapters/chapters.module.js';
import { ReadingProgressService } from './application/reading-progress.service.js';
import { PROGRESS_REPOSITORY } from './domain/ports.js';
import { ReadingProgressController } from './infrastructure/http/reading-progress.controller.js';
import { PrismaProgressRepository } from './infrastructure/persistence/prisma-progress.repository.js';

@Module({
  imports: [BooksModule, ChaptersModule],
  controllers: [ReadingProgressController],
  providers: [
    ReadingProgressService,
    { provide: PROGRESS_REPOSITORY, useClass: PrismaProgressRepository },
  ],
})
export class ReadingProgressModule {}
