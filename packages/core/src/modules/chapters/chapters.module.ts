import { Module } from '@nestjs/common';
import { ChaptersService } from './application/chapters.service.js';
import { CHAPTER_REPOSITORY } from './domain/ports.js';
import { ChaptersController } from './infrastructure/http/chapters.controller.js';
import { PrismaChapterRepository } from './infrastructure/persistence/prisma-chapter.repository.js';

@Module({
  controllers: [ChaptersController],
  providers: [ChaptersService, { provide: CHAPTER_REPOSITORY, useClass: PrismaChapterRepository }],
  exports: [CHAPTER_REPOSITORY],
})
export class ChaptersModule {}
