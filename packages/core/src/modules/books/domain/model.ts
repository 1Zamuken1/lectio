import type { ProcessedBook } from '@lectio/epub-pipeline';

export type BookStatus = 'pending' | 'processing' | 'ready' | 'error';

/** Lo mínimo para decidir acceso y estado. */
export interface BookRecord {
  id: string;
  ownerId: string | null;
  isPublic: boolean;
  status: BookStatus;
  sourceKey: string;
  coverKey: string | null;
}

export interface BookSummary {
  id: string;
  title: string | null;
  author: string | null;
  language: string | null;
  status: BookStatus;
  errorCode: string | null;
  hasCover: boolean;
  isPublic: boolean;
  /** Solo libros públicos: /libros/:slug. */
  slug: string | null;
  createdAt: Date;
  /** Dónde va el usuario (solo en su biblioteca); null si no lo abrió todavía. */
  progress?: {
    /** orderIndex del capítulo actual (para abrir el lector en él). */
    chapterOrder: number;
    /** Su número entre los capítulos narrativos (0 si aún está en los preliminares). */
    chapterNumber: number;
    /** Capítulos narrativos del libro. */
    totalChapters: number;
    mode: 'reading' | 'listening';
  } | null;
}

export interface ChapterSummary {
  id: string;
  orderIndex: number;
  title: string;
  ancestors: string[];
  kind: 'narrative' | 'front_matter' | 'back_matter' | 'notes';
  characterCount: number;
  sentenceCount: number;
  /** Audio de este capítulo por voz (uno por voz que se pidió). */
  audio: Array<{ voiceId: string; status: 'pending' | 'processing' | 'ready' | 'error' }>;
}

export interface BookDetail extends BookSummary {
  ownerId: string | null;
  pipelineVersion: number | null;
  chapters: ChapterSummary[];
}

/** Lo que el worker guarda al terminar el pipeline, en una sola transacción. */
export interface ProcessedBookData {
  book: ProcessedBook;
  coverKey: string | null;
}
