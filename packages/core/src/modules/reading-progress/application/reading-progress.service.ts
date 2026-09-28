import { Inject, Injectable } from '@nestjs/common';
import { BooksService } from '../../books/application/books.service.js';
import { CHAPTER_REPOSITORY, type ChapterRepository } from '../../chapters/domain/ports.js';
import {
  ChapterNotInBookError,
  ClientTimeInFutureError,
  SentenceOutOfRangeError,
} from '../domain/errors.js';
import type { Position, SaveResult } from '../domain/model.js';
import { PROGRESS_REPOSITORY, type ProgressRepository } from '../domain/ports.js';

/** Tolerancia al reloj del cliente (arquitectura §2.5). */
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * Progreso de lectura entre dispositivos. Gana el `clientUpdatedAt` más reciente: un
 * progreso guardado sin conexión y enviado horas después no pisa lo leído entretanto en
 * otro dispositivo.
 */
@Injectable()
export class ReadingProgressService {
  constructor(
    @Inject(PROGRESS_REPOSITORY) private readonly progress: ProgressRepository,
    @Inject(CHAPTER_REPOSITORY) private readonly chapters: ChapterRepository,
    private readonly books: BooksService,
  ) {}

  async save(userId: string, bookId: string, position: Position): Promise<SaveResult> {
    await this.books.readable(userId, bookId);
    if (position.clientUpdatedAt.getTime() > Date.now() + MAX_CLOCK_SKEW_MS) {
      throw new ClientTimeInFutureError();
    }
    const chapter = await this.chapters.findMeta(position.chapterId);
    if (!chapter || chapter.bookId !== bookId) throw new ChapterNotInBookError();
    if (position.sentenceIndex >= chapter.sentenceCount) {
      throw new SentenceOutOfRangeError(chapter.sentenceCount);
    }

    const result = await this.progress.saveIfNewer(userId, bookId, position);
    // Un reintento de la misma solicitud (misma posición y hora) cuenta como aplicado.
    if (!result.applied && samePosition(result.current, position)) return { applied: true };
    return result;
  }

  async get(userId: string, bookId: string): Promise<Position | null> {
    await this.books.readable(userId, bookId);
    return this.progress.find(userId, bookId);
  }
}

function samePosition(a: Position, b: Position): boolean {
  return (
    a.chapterId === b.chapterId &&
    a.sentenceIndex === b.sentenceIndex &&
    a.mode === b.mode &&
    a.clientUpdatedAt.getTime() === b.clientUpdatedAt.getTime()
  );
}
