import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../../../../generated/prisma/client.js';
import { APP_CONFIG } from '../../../../config/config.module.js';
import type { AppConfig } from '../../../../config/env.js';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service.js';
import type {
  AudioSegmentRecord,
  ChapterContext,
  GeneratedAudio,
  GenerationInput,
  UsageSnapshot,
} from '../../domain/model.js';
import { narrationChanged } from '../../domain/freshness.js';
import type { AudioRepository, LockedAudioScope } from '../../domain/ports.js';

const SEGMENT = {
  id: true,
  chapterId: true,
  voiceId: true,
  requestedById: true,
  status: true,
  provider: true,
  prosodyKey: true,
  narrationHash: true,
  billable: true,
  audioKey: true,
  alignmentKey: true,
  durationMs: true,
  reservedCharacters: true,
  unitsDone: true,
  unitsTotal: true,
} as const;

const ACTIVE = ['pending', 'processing'] as const;

type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class PrismaAudioRepository implements AudioRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  findChapter(chapterId: string): Promise<ChapterContext | null> {
    return this.prisma.chapter.findUnique({
      where: { id: chapterId },
      select: {
        id: true,
        bookId: true,
        characterCount: true,
        narrationHash: true,
        book: { select: { ownerId: true, isPublic: true, language: true } },
      },
    });
  }

  findSegment(chapterId: string, voiceId: string): Promise<AudioSegmentRecord | null> {
    return findSegment(this.prisma, chapterId, voiceId);
  }

  withUserLock<T>(userId: string, work: (scope: LockedAudioScope) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      // Solicitudes del mismo usuario en fila; las de otros usuarios no se esperan.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      return work({
        usage: (periodStart) => this.#usage(tx, userId, periodStart),
        findSegment: (chapterId, voiceId) => findSegment(tx, chapterId, voiceId),
        reserve: ({ chapterId, voiceId, userId: requestedById, characters, billable }) => {
          const fresh = {
            requestedById,
            status: 'pending' as const,
            billable,
            reservedCharacters: billable ? characters : 0,
            unitsDone: 0,
            unitsTotal: 0,
            errorMessage: null,
          };
          return tx.audioSegment.upsert({
            where: { chapterId_voiceId: { chapterId, voiceId } },
            create: { chapterId, voiceId, ...fresh },
            // Uno en error (o ready con un perfil viejo) se vuelve a generar sobre la misma fila.
            update: { ...fresh, retryCount: { increment: 1 } },
            select: SEGMENT,
          });
        },
      });
    });
  }

  narrativeChapters(bookId: string): Promise<Array<{ id: string; orderIndex: number }>> {
    return this.prisma.chapter.findMany({
      where: { bookId, kind: 'narrative', characterCount: { gt: 0 } },
      select: { id: true, orderIndex: true },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async reserveSystem(
    chapterId: string,
    voiceId: string,
    prosodyKey: string,
  ): Promise<AudioSegmentRecord | null> {
    const [existing, chapter] = await Promise.all([
      findSegment(this.prisma, chapterId, voiceId),
      this.prisma.chapter.findUnique({ where: { id: chapterId }, select: { narrationHash: true } }),
    ]);
    if (existing && (ACTIVE as readonly string[]).includes(existing.status)) return null;
    if (
      existing?.status === 'ready' &&
      existing.prosodyKey === prosodyKey &&
      !narrationChanged(existing.narrationHash, chapter?.narrationHash ?? null)
    ) {
      return null;
    }
    const fresh = {
      requestedById: null,
      status: 'pending' as const,
      billable: true,
      reservedCharacters: 0,
      unitsDone: 0,
      unitsTotal: 0,
      errorMessage: null,
    };
    return this.prisma.audioSegment.upsert({
      where: { chapterId_voiceId: { chapterId, voiceId } },
      create: { chapterId, voiceId, ...fresh },
      update: { ...fresh, retryCount: { increment: 1 } },
      select: SEGMENT,
    });
  }

  async outdatedSystemAudio(
    bookId: string,
  ): Promise<Array<{ chapterId: string; voiceId: string }>> {
    const rows = await this.prisma.audioSegment.findMany({
      where: { requestedById: null, status: 'ready', chapter: { bookId } },
      select: {
        chapterId: true,
        voiceId: true,
        narrationHash: true,
        chapter: { select: { narrationHash: true } },
      },
      orderBy: [{ chapter: { orderIndex: 'asc' } }, { voiceId: 'asc' }],
    });
    return rows
      .filter((row) => narrationChanged(row.narrationHash, row.chapter.narrationHash))
      .map(({ chapterId, voiceId }) => ({ chapterId, voiceId }));
  }

  usage(userId: string, periodStart: Date): Promise<UsageSnapshot> {
    return this.#usage(this.prisma, userId, periodStart);
  }

  async #usage(db: Db, userId: string, periodStart: Date): Promise<UsageSnapshot> {
    const [user, consumed, reserved] = await Promise.all([
      db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { ttsMonthlyQuota: true, totalCharactersProcessed: true },
      }),
      db.ttsUsageLog.aggregate({
        where: { userId, createdAt: { gte: periodStart } },
        _sum: { charactersProcessed: true },
      }),
      db.audioSegment.aggregate({
        where: { requestedById: userId, status: { in: [...ACTIVE] } },
        _sum: { reservedCharacters: true },
        _count: true,
      }),
    ]);
    return {
      quota: user.ttsMonthlyQuota ?? this.config.TTS_MONTHLY_QUOTA,
      consumed: consumed._sum.charactersProcessed ?? 0,
      reserved: reserved._sum.reservedCharacters ?? 0,
      active: reserved._count,
      totalCharactersProcessed: user.totalCharactersProcessed,
    };
  }

  async startGeneration(segmentId: string): Promise<GenerationInput | null> {
    // "processing" también: si un worker murió a mitad de camino, BullMQ reintenta el job.
    const { count } = await this.prisma.audioSegment.updateMany({
      where: { id: segmentId, status: { in: [...ACTIVE] } },
      data: { status: 'processing', unitsDone: 0 },
    });
    if (count === 0) return null;
    const row = await this.prisma.audioSegment.findUnique({
      where: { id: segmentId },
      select: {
        ...SEGMENT,
        chapter: {
          select: {
            bookId: true,
            characterCount: true,
            sentences: true,
            book: { select: { language: true } },
          },
        },
      },
    });
    if (!row) return null;
    const { chapter, ...segment } = row;
    return {
      segment,
      bookId: chapter.bookId,
      language: chapter.book.language ?? 'es',
      characterCount: chapter.characterCount,
      sentences: chapter.sentences,
    };
  }

  async updateProgress(segmentId: string, done: number, total: number): Promise<void> {
    await this.prisma.audioSegment.updateMany({
      where: { id: segmentId, status: 'processing' },
      data: { unitsDone: done, unitsTotal: total },
    });
  }

  async complete(segmentId: string, audio: GeneratedAudio, characters: number): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const segment = await tx.audioSegment.findUnique({
        where: { id: segmentId },
        select: {
          status: true,
          requestedById: true,
          billable: true,
          chapterId: true,
          voiceId: true,
        },
      });
      if (segment?.status !== 'processing') return false;
      await tx.audioSegment.update({
        where: { id: segmentId },
        data: {
          ...audio,
          status: 'ready',
          reservedCharacters: 0,
          errorMessage: null,
        },
      });
      // El audio del sistema (libros públicos) no tiene a quién cobrarle, y la regeneración
      // por un cambio de narración (reprocesamiento) no se cobra.
      if (segment.requestedById && segment.billable) {
        await tx.ttsUsageLog.create({
          data: {
            userId: segment.requestedById,
            chapterId: segment.chapterId,
            provider: audio.provider,
            voiceId: segment.voiceId,
            charactersProcessed: characters,
          },
        });
        await tx.user.update({
          where: { id: segment.requestedById },
          data: { totalCharactersProcessed: { increment: characters } },
        });
      }
      return true;
    });
  }

  async fail(segmentId: string, message: string): Promise<void> {
    const errorMessage = message.slice(0, 500);
    // Una regeneración que falla no se lleva la grabación que ya había: vuelve a estar lista
    // (con su huella vieja, así que sigue desactualizada).
    await this.prisma.audioSegment.updateMany({
      where: {
        id: segmentId,
        status: { in: [...ACTIVE] },
        audioKey: { not: null },
        alignmentKey: { not: null },
      },
      data: { status: 'ready', reservedCharacters: 0, errorMessage },
    });
    await this.prisma.audioSegment.updateMany({
      where: { id: segmentId, status: { in: [...ACTIVE] } },
      data: { status: 'error', reservedCharacters: 0, errorMessage },
    });
  }

  async delete(segmentId: string): Promise<void> {
    await this.prisma.audioSegment.deleteMany({ where: { id: segmentId, status: 'pending' } });
  }
}

function findSegment(
  db: Db,
  chapterId: string,
  voiceId: string,
): Promise<AudioSegmentRecord | null> {
  return db.audioSegment.findUnique({
    where: { chapterId_voiceId: { chapterId, voiceId } },
    select: SEGMENT,
  });
}
