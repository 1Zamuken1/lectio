/** Oración tal como la guarda el pipeline (Chapter.sentences, jsonb). */
export interface StoredSentence {
  index: number;
  blockIndex: number;
  start: number;
  end: number;
  text: string;
  narration: string;
  voices?: Array<{ kind: 'narration' | 'dialogue'; text: string }>;
}

export interface ChapterForReading {
  id: string;
  bookId: string;
  orderIndex: number;
  title: string;
  ancestors: string[];
  kind: string;
  contentHtml: string;
  sentences: StoredSentence[];
  notes: unknown;
  book: { ownerId: string | null; isPublic: boolean; pipelineVersion: number | null };
}

/** Lo necesario para validar una posición de lectura. */
export interface ChapterMeta {
  id: string;
  bookId: string;
  orderIndex: number;
  sentenceCount: number;
}
