import { Injectable } from '@nestjs/common';
import { uuidv7 } from '../../../../common/ids/uuid.js';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service.js';
import type { Position, SaveResult } from '../../domain/model.js';
import type { ProgressRepository } from '../../domain/ports.js';

@Injectable()
export class PrismaProgressRepository implements ProgressRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Un solo INSERT … ON CONFLICT … WHERE: la comparación de fechas y la escritura son
   * atómicas, así dos dispositivos que guardan a la vez no se pisan (gana el más reciente).
   */
  async saveIfNewer(userId: string, bookId: string, position: Position): Promise<SaveResult> {
    const written = await this.prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO reading_progress
        (id, user_id, book_id, chapter_id, sentence_index, mode, client_updated_at, updated_at)
      VALUES (
        ${uuidv7()}::uuid, ${userId}::uuid, ${bookId}::uuid, ${position.chapterId}::uuid,
        ${position.sentenceIndex}, ${position.mode}::reading_mode, ${position.clientUpdatedAt}, now()
      )
      ON CONFLICT (user_id, book_id) DO UPDATE SET
        chapter_id = EXCLUDED.chapter_id,
        sentence_index = EXCLUDED.sentence_index,
        mode = EXCLUDED.mode,
        client_updated_at = EXCLUDED.client_updated_at,
        updated_at = now()
      WHERE reading_progress.client_updated_at < EXCLUDED.client_updated_at
      RETURNING id`;
    if (written.length > 0) return { applied: true };
    const current = await this.find(userId, bookId);
    return current ? { applied: false, current } : { applied: true };
  }

  async find(userId: string, bookId: string): Promise<Position | null> {
    const row = await this.prisma.readingProgress.findUnique({
      where: { userId_bookId: { userId, bookId } },
      select: { chapterId: true, sentenceIndex: true, mode: true, clientUpdatedAt: true },
    });
    return row;
  }
}
