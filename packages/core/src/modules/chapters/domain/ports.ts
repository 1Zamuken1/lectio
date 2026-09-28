import type { ChapterForReading, ChapterMeta } from './model.js';

export interface ChapterRepository {
  findForReading(id: string): Promise<ChapterForReading | null>;
  findMeta(id: string): Promise<ChapterMeta | null>;
}

export const CHAPTER_REPOSITORY = Symbol('CHAPTER_REPOSITORY');
