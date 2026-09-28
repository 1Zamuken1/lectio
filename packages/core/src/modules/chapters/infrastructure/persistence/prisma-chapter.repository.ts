import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service.js';
import type { ChapterForReading, ChapterMeta, StoredSentence } from '../../domain/model.js';
import type { ChapterRepository } from '../../domain/ports.js';

@Injectable()
export class PrismaChapterRepository implements ChapterRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findForReading(id: string): Promise<ChapterForReading | null> {
    const row = await this.prisma.chapter.findUnique({
      where: { id },
      select: {
        id: true,
        bookId: true,
        orderIndex: true,
        title: true,
        ancestors: true,
        kind: true,
        contentHtml: true,
        sentences: true,
        notes: true,
        book: { select: { ownerId: true, isPublic: true, pipelineVersion: true } },
      },
    });
    return row ? { ...row, sentences: row.sentences as unknown as StoredSentence[] } : null;
  }

  findMeta(id: string): Promise<ChapterMeta | null> {
    return this.prisma.chapter.findUnique({
      where: { id },
      select: { id: true, bookId: true, orderIndex: true, sentenceCount: true },
    });
  }
}
