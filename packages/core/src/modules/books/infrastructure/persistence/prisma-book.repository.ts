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
  isPublic: true,
  slug: true,
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

  async createPublic(data: { id: string; slug: string; sourceKey: string; sourceHash: string }) {
    // Regla del modelo de datos: un libro público no tiene dueño y siempre tiene slug.
    await this.prisma.book.create({ data: { ...data, ownerId: null, isPublic: true } });
  }

  findPublicByHash(sourceHash: string) {
    return this.prisma.book.findFirst({
      where: { isPublic: true, sourceHash },
      select: { id: true, slug: true, status: true },
    });
  }

  async slugTaken(slug: string): Promise<boolean> {
    return (await this.prisma.book.count({ where: { slug } })) > 0;
  }

  findOwnedByHash(ownerId: string, sourceHash: string) {
    return this.prisma.book.findFirst({ where: { ownerId, sourceHash }, select: { id: true } });
  }

  /**
   * La biblioteca de un usuario: sus libros y los públicos que empezó a leer (con progreso).
   * El progreso siempre es el de ese usuario.
   */
  listLibrary(userId: string): Promise<BookSummary[]> {
    return this.#listWithProgress(
      { OR: [{ ownerId: userId }, { isPublic: true, readingProgress: { some: { userId } } }] },
      userId,
      { createdAt: 'desc' },
    );
  }

  /** El catálogo público (solo los libros listos), con el progreso del usuario si hay sesión. */
  listPublic(userId: string | null): Promise<BookSummary[]> {
    return this.#listWithProgress({ isPublic: true, status: 'ready' }, userId, { title: 'asc' });
  }

  async findPublicIdBySlug(slug: string): Promise<string | null> {
    const row = await this.prisma.book.findFirst({
      where: { slug, isPublic: true },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  async #listWithProgress(
    where: Prisma.BookWhereInput,
    userId: string | null,
    orderBy: Prisma.BookOrderByWithRelationInput,
  ): Promise<BookSummary[]> {
    const rows = await this.prisma.book.findMany({
      where,
      select: {
        ...SUMMARY,
        readingProgress: {
          // Sin sesión no hay progreso que mostrar: un id que no existe no trae filas.
          where: { userId: userId ?? '00000000-0000-0000-0000-000000000000' },
          select: { mode: true, chapter: { select: { orderIndex: true } } },
        },
      },
      orderBy,
    });
    // "Cap. 3 de 12" cuenta solo capítulos narrativos (portada, dedicatoria y notas no son
    // capítulos): se traen sus posiciones, solo de los libros empezados.
    const started = rows.filter((r) => r.readingProgress.length > 0).map((r) => r.id);
    const narrative = new Map<string, number[]>();
    if (started.length > 0) {
      const chapters = await this.prisma.chapter.findMany({
        where: { bookId: { in: started }, kind: 'narrative' },
        select: { bookId: true, orderIndex: true },
      });
      for (const { bookId, orderIndex } of chapters) {
        narrative.set(bookId, [...(narrative.get(bookId) ?? []), orderIndex]);
      }
    }
    return rows.map(({ readingProgress, ...row }) => {
      const [progress] = readingProgress;
      const orders = narrative.get(row.id) ?? [];
      return {
        ...toSummary(row),
        progress: progress
          ? {
              chapterOrder: progress.chapter.orderIndex,
              chapterNumber: orders.filter((o) => o <= progress.chapter.orderIndex).length,
              totalChapters: orders.length,
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
            audio: { select: { voiceId: true, status: true }, orderBy: { voiceId: 'asc' } },
          },
        },
      },
    });
    if (!row) return null;
    const { chapters, ownerId, pipelineVersion, ...summary } = row;
    return { ...toSummary(summary), ownerId, pipelineVersion, chapters };
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
