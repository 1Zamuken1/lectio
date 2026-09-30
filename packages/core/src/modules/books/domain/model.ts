import type { ProcessedBook } from '@lectio/epub-pipeline';
import type { ChapterPlan, StoredChapter } from './reprocess.js';

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

/** Un libro listo tal como está guardado, para reprocesarlo con una versión nueva. */
export interface ReprocessTarget {
  id: string;
  status: BookStatus;
  isPublic: boolean;
  sourceKey: string;
  pipelineVersion: number | null;
  chapters: Array<StoredChapter & { narrationHash: string | null; sentences: unknown }>;
}

/** Un libro procesado con una versión anterior del pipeline. */
export interface StaleBook {
  id: string;
  title: string | null;
  isPublic: boolean;
  pipelineVersion: number | null;
}

/** Lo que el reprocesamiento guarda, en una sola transacción. */
export interface ReprocessData extends ProcessedBookData {
  /** La versión leída antes de correr el pipeline: si cambió, otro proceso ya lo hizo. */
  expectedVersion: number | null;
  plan: ChapterPlan;
  /**
   * Huella de la narración guardada de los capítulos que no la tenían (procesados antes
   * de que existiera): se le asigna al audio que se generó con ella, para poder comparar.
   */
  legacyHashes: Map<string, string>;
}

export type ReprocessResult =
  | {
      status: 'saved';
      kept: number;
      created: number;
      removed: number;
      /** Progresos que estaban en un capítulo quitado y pasaron a otro. */
      progressMoved: number;
      /** Archivos del audio de los capítulos quitados, para borrarlos del storage. */
      orphanedKeys: string[];
    }
  /** Ya no está listo o ya no tiene la versión esperada: otro proceso se adelantó. */
  | { status: 'stale' }
  /** Hay audio generándose en un capítulo que se quitaría: se intenta más tarde. */
  | { status: 'busy' };
