import { Inject, Injectable } from '@nestjs/common';
import { assertCanRead } from '../../books/domain/access.js';
import { ChapterNotFoundError } from '../domain/errors.js';
import type { ChapterForReading } from '../domain/model.js';
import { CHAPTER_REPOSITORY, type ChapterRepository } from '../domain/ports.js';

export interface ChapterView {
  id: string;
  bookId: string;
  orderIndex: number;
  title: string;
  ancestors: string[];
  kind: string;
  contentHtml: string;
  /** Sin el texto de narración: es un detalle interno del TTS (arquitectura §2.3). */
  sentences: Array<{
    index: number;
    blockIndex: number;
    start: number;
    end: number;
    narrated: boolean;
  }>;
  notes: unknown;
}

/**
 * Lectura de un capítulo. El contenido solo cambia si el libro se reprocesa, así que la
 * versión (capítulo + versión del pipeline) sirve de ETag (arquitectura §1.11).
 */
@Injectable()
export class ChaptersService {
  constructor(@Inject(CHAPTER_REPOSITORY) private readonly chapters: ChapterRepository) {}

  async read(
    userId: string | null,
    chapterId: string,
  ): Promise<{ etag: string; chapter: () => ChapterView }> {
    const chapter = await this.chapters.findForReading(chapterId);
    if (!chapter) throw new ChapterNotFoundError();
    assertCanRead(userId, chapter.book);
    // El cuerpo se arma solo si hace falta: con un 304 no se serializa nada.
    return { etag: etagOf(chapter), chapter: () => toView(chapter) };
  }
}

export function etagOf(chapter: { id: string; book: { pipelineVersion: number | null } }): string {
  return `"${chapter.id}.p${chapter.book.pipelineVersion ?? 0}"`;
}

/** ¿El ETag del cliente (If-None-Match, quizá una lista o débil) coincide con el actual? */
export function matchesEtag(ifNoneMatch: string | undefined, etag: string): boolean {
  if (!ifNoneMatch) return false;
  return ifNoneMatch
    .split(',')
    .map((tag) => tag.trim().replace(/^W\//, ''))
    .some((tag) => tag === etag || tag === '*');
}

function toView(chapter: ChapterForReading): ChapterView {
  return {
    id: chapter.id,
    bookId: chapter.bookId,
    orderIndex: chapter.orderIndex,
    title: chapter.title,
    ancestors: chapter.ancestors,
    kind: chapter.kind,
    contentHtml: chapter.contentHtml,
    sentences: chapter.sentences.map((s) => ({
      index: s.index,
      blockIndex: s.blockIndex,
      start: s.start,
      end: s.end,
      narrated: s.narration !== '',
    })),
    notes: chapter.notes,
  };
}
