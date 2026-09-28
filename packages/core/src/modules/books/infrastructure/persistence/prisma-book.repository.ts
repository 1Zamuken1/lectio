import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service.js';
import type { BookDetail, BookRecord, BookSummary, ProcessedBookData } from '../../domain/model.js';
import type { BookRepository } from '../../domain/ports.js';

const SUMMARY = {
  id: true,
  title: true,
  author: true,
  language: true,
  status: true,
  errorCode: true,
  coverKey: true,
  createdAt: true,
} as const;

type SummaryRow = Prisma.BookGetPayload<{ select: typeof SUMMARY }>;

const toSummary = ({ coverKey, ...row }: SummaryRow): BookSummary => ({
  ...row,
  hasCover: coverKey !== null,
});

/** JSON para Prisma: los objetos del pipeline ya son serializables (sin Map ni Buffer). */
const json = (value: unknown) => value as Prisma.InputJsonValue;

@Injectable()
export class PrismaBookRepository implements BookRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { id: string; ownerId: string; sourceKey: string; sourceHash: string }) {
    await this.prisma.book.create({ data });
  }

  findRecord(id: string): Promise<BookRecord | null> {
    return this.prisma.book.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        isPublic: true,
        status: true,
        sourceKey: true,
        coverKey: true,
      },
    });
  }

  findOwnedByHash(ownerId: string, sourceHash: string) {
    return this.prisma.book.findFirst({ where: { ownerId, sourceHash }, select: { id: true } });
  }

  async listByOwner(ownerId: string): Promise<BookSummary[]> {
    const rows = await this.prisma.book.findMany({
      where: { ownerId },
      select: {
        ...SUMMARY,
        _count: { select: { chapters: true } },
        readingProgress: {
          where: { userId: ownerId },
          select: { mode: true, chapter: { select: { orderIndex: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(({ _count, readingProgress, ...row }) => {
      const [progress] = readingProgress;
      return {
        ...toSummary(row),
        progress: progress
          ? {
              chapterOrder: progress.chapter.orderIndex,
              totalChapters: _count.chapters,
              mode: progress.mode,
            }
          : null,
      };
    });
  }

  async findDetail(id: string): Promise<BookDetail | null> {
    const row = await this.prisma.book.findUnique({
      where: { id },
      select: {
        ...SUMMARY,
        ownerId: true,
        isPublic: true,
        pipelineVersion: true,
        chapters: {
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            orderIndex: true,
            title: true,
            ancestors: true,
            kind: true,
            characterCount: true,
            sentenceCount: true,
          },
        },
      },
    });
    if (!row) return null;
    const { chapters, ownerId, isPublic, pipelineVersion, ...summary } = row;
    return { ...toSummary(summary), ownerId, isPublic, pipelineVersion, chapters };
  }

  async findReport(id: string): Promise<unknown> {
    const row = await this.prisma.book.findUnique({
      where: { id },
      select: { processingReport: true },
    });
    return row?.processingReport ?? null;
  }

  async markProcessing(id: string): Promise<boolean> {
    // "processing" también: si un worker murió a mitad de camino, BullMQ reintenta el job.
    const { count } = await this.prisma.book.updateMany({
      where: { id, status: { in: ['pending', 'processing', 'error'] } },
      data: { status: 'processing', errorCode: null, errorMessage: null },
    });
    return count > 0;
  }

  async saveProcessed(id: string, { book, coverKey }: ProcessedBookData): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.chapter.deleteMany({ where: { bookId: id } }),
      this.prisma.chapter.createMany({
        data: book.chapters.map((chapter) => ({
          bookId: id,
          orderIndex: chapter.orderIndex,
          title: chapter.title,
          ancestors: chapter.ancestors,
          kind: chapter.kind,
          classification: json(chapter.classification),
          contentHtml: chapter.contentHtml,
          sentences: json(chapter.sentences),
          notes: json(chapter.notes),
          characterCount: chapter.characterCount,
          sentenceCount: chapter.sentences.length,
        })),
      }),
      this.prisma.book.update({
        where: { id },
        data: {
          status: 'ready',
          title: book.metadata.title,
          author: book.metadata.authors.join(', ') || null,
          language: book.metadata.language,
          coverKey,
          navSource: book.navSource,
          pipelineVersion: book.pipelineVersion,
          processingReport: json(book.report),
          errorCode: null,
          errorMessage: null,
        },
      }),
    ]);
  }

  async markError(id: string, code: string, message: string): Promise<void> {
    await this.prisma.book.updateMany({
      where: { id },
      data: { status: 'error', errorCode: code, errorMessage: message },
    });
  }

  async hasActiveAudio(id: string): Promise<boolean> {
    const active = await this.prisma.audioSegment.count({
      where: { chapter: { bookId: id }, status: { in: ['pending', 'processing'] } },
    });
    return active > 0;
  }

  async delete(id: string): Promise<void> {
    // Capítulos, audio y progreso se van en cascada (ver schema.prisma).
    await this.prisma.book.delete({ where: { id } });
  }
}
