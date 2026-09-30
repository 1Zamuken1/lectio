import { Injectable } from '@nestjs/common';
import { narrationFingerprint, type ProcessedBook } from '@lectio/epub-pipeline';
import type { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service.js';
import type {
  BookDetail,
  BookRecord,
  BookSummary,
  ProcessedBookData,
  ReprocessData,
  ReprocessResult,
  ReprocessTarget,
  StaleBook,
} from '../../domain/model.js';
import type { BookRepository } from '../../domain/ports.js';
import { relocatedOrder } from '../../domain/reprocess.js';

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

/** Las columnas de un capítulo que salen del pipeline (sin el libro ni la posición). */
function chapterContent(chapter: ProcessedBook['chapters'][number]) {
  return {
    title: chapter.title,
    ancestors: chapter.ancestors,
    kind: chapter.kind,
    classification: json(chapter.classification),
    contentHtml: chapter.contentHtml,
    sentences: json(chapter.sentences),
    notes: json(chapter.notes),
    characterCount: chapter.characterCount,
    sentenceCount: chapter.sentences.length,
    narrationHash: narrationFingerprint(chapter.sentences),
  };
}

/** Lo que el pipeline actualiza en el libro (al procesarlo y al reprocesarlo). */
function bookContent({ book, coverKey }: ProcessedBookData) {
  return {
    status: 'ready' as const,
    title: book.metadata.title,
    author: book.metadata.authors.join(', ') || null,
    language: book.metadata.language,
    coverKey,
    navSource: book.navSource,
    pipelineVersion: book.pipelineVersion,
    processingReport: json(book.report),
    errorCode: null,
    errorMessage: null,
  };
}

const ACTIVE_AUDIO = ['pending', 'processing'] as const;

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
        _count: { select: { chapters: true } },
        readingProgress: {
          // Sin sesión no hay progreso que mostrar: un id que no existe no trae filas.
          where: { userId: userId ?? '00000000-0000-0000-0000-000000000000' },
          select: { mode: true, chapter: { select: { orderIndex: true } } },
        },
      },
      orderBy,
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

  async saveProcessed(id: string, data: ProcessedBookData): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.chapter.deleteMany({ where: { bookId: id } }),
      this.prisma.chapter.createMany({
        data: data.book.chapters.map((chapter) => ({
          bookId: id,
          orderIndex: chapter.orderIndex,
          ...chapterContent(chapter),
        })),
      }),
      this.prisma.book.update({ where: { id }, data: bookContent(data) }),
    ]);
  }

  listStale(version: number, ids?: string[]): Promise<StaleBook[]> {
    return this.prisma.book.findMany({
      where: {
        status: 'ready',
        OR: [{ pipelineVersion: null }, { pipelineVersion: { lt: version } }],
        ...(ids ? { id: { in: ids } } : {}),
      },
      select: { id: true, title: true, isPublic: true, pipelineVersion: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  findReprocessTarget(id: string): Promise<ReprocessTarget | null> {
    return this.prisma.book.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        isPublic: true,
        sourceKey: true,
        pipelineVersion: true,
        chapters: {
          orderBy: { orderIndex: 'asc' },
          select: { id: true, orderIndex: true, title: true, narrationHash: true, sentences: true },
        },
      },
    });
  }

  /**
   * Una transacción con el libro bloqueado (FOR UPDATE): nadie lo reprocesa ni lo borra a la
   * vez, y quien lee sigue viendo la versión anterior hasta el final. Los capítulos que se
   * conservan se actualizan en su lugar (mismo id: su progreso y su audio siguen ahí).
   */
  applyReprocess(id: string, data: ReprocessData): Promise<ReprocessResult> {
    const { book, plan, legacyHashes, expectedVersion } = data;
    return this.prisma.$transaction(
      async (tx): Promise<ReprocessResult> => {
        const [locked] = await tx.$queryRaw<
          Array<{ status: string; pipeline_version: number | null }>
        >`SELECT status, pipeline_version FROM books WHERE id = ${id}::uuid FOR UPDATE`;
        if (locked?.status !== 'ready' || locked.pipeline_version !== expectedVersion) {
          return { status: 'stale' };
        }
        const removed = plan.removed;
        if (removed.length > 0) {
          const active = await tx.audioSegment.count({
            where: { chapterId: { in: removed }, status: { in: [...ACTIVE_AUDIO] } },
          });
          if (active > 0) return { status: 'busy' };
        }

        // El audio generado antes de que existieran las huellas se generó con la narración
        // guardada: se le asigna su huella, así la comparación con la nueva es justa.
        for (const [chapterId, hash] of legacyHashes) {
          await tx.audioSegment.updateMany({
            where: { chapterId, narrationHash: null },
            data: { narrationHash: hash },
          });
        }

        // Posiciones fuera de rango mientras se reordena: (book_id, order_index) es único.
        const stored = await tx.chapter.findMany({
          where: { bookId: id },
          select: { id: true, orderIndex: true },
        });
        const previousOrder = new Map(stored.map((c) => [c.id, c.orderIndex]));
        await tx.$executeRaw`UPDATE chapters SET order_index = -order_index - 1 WHERE book_id = ${id}::uuid`;

        const fresh: Prisma.ChapterCreateManyInput[] = [];
        for (const [i, chapter] of book.chapters.entries()) {
          const keptId = plan.keep[i];
          if (keptId) {
            await tx.chapter.update({
              where: { id: keptId },
              data: { orderIndex: chapter.orderIndex, ...chapterContent(chapter) },
            });
          } else {
            fresh.push({ bookId: id, orderIndex: chapter.orderIndex, ...chapterContent(chapter) });
          }
        }
        const created =
          fresh.length > 0
            ? await tx.chapter.createManyAndReturn({
                data: fresh,
                select: { id: true, orderIndex: true },
              })
            : [];
        const createdByOrder = new Map(created.map((c) => [c.orderIndex, c.id]));
        const finalIds = book.chapters.map(
          (chapter, i) => plan.keep[i] ?? createdByOrder.get(chapter.orderIndex)!,
        );

        let progressMoved = 0;
        const orphanedKeys: string[] = [];
        if (removed.length > 0) {
          const segments = await tx.audioSegment.findMany({
            where: { chapterId: { in: removed } },
            select: { audioKey: true, alignmentKey: true },
          });
          for (const { audioKey, alignmentKey } of segments) {
            if (audioKey) orphanedKeys.push(audioKey);
            if (alignmentKey) orphanedKeys.push(alignmentKey);
          }
          // El progreso en un capítulo quitado pasa al que ahora ocupa esa posición.
          const stranded = await tx.readingProgress.findMany({
            where: { chapterId: { in: removed } },
            select: { id: true, chapterId: true },
          });
          for (const progress of stranded) {
            if (finalIds.length === 0) break; // sin capítulos, el progreso se va en cascada
            const order = relocatedOrder(previousOrder.get(progress.chapterId)!, finalIds.length);
            await tx.readingProgress.update({
              where: { id: progress.id },
              data: { chapterId: finalIds[order]!, sentenceIndex: 0 },
            });
            progressMoved++;
          }
          // Su audio se va en cascada; el log de consumo queda (chapter_id pasa a null).
          await tx.chapter.deleteMany({ where: { id: { in: removed } } });
        }

        // Un capítulo conservado puede tener ahora menos oraciones.
        await tx.$executeRaw`
          UPDATE reading_progress rp
          SET sentence_index = GREATEST(c.sentence_count - 1, 0)
          FROM chapters c
          WHERE rp.chapter_id = c.id AND c.book_id = ${id}::uuid
            AND rp.sentence_index > GREATEST(c.sentence_count - 1, 0)`;

        await tx.book.update({ where: { id }, data: bookContent(data) });
        return {
          status: 'saved',
          kept: plan.keep.filter(Boolean).length,
          created: created.length,
          removed: removed.length,
          progressMoved,
          orphanedKeys,
        };
      },
      // Un libro largo son cientos de capítulos que actualizar uno por uno.
      { timeout: 60_000 },
    );
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
