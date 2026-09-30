export type AudioStatus = 'pending' | 'processing' | 'ready' | 'error';

/** El capítulo con lo necesario para decidir acceso, voz y cuota. */
export interface ChapterContext {
  id: string;
  bookId: string;
  characterCount: number;
  /** Huella de la narración vigente; null si el capítulo es de antes de que existiera. */
  narrationHash: string | null;
  book: { ownerId: string | null; isPublic: boolean; language: string | null };
}

/** El audio de un capítulo con una voz (AudioSegment). */
export interface AudioSegmentRecord {
  id: string;
  chapterId: string;
  voiceId: string;
  requestedById: string | null;
  status: AudioStatus;
  provider: string | null;
  prosodyKey: string | null;
  /** Huella de la narración con que se generó (null: audio de antes de que existiera). */
  narrationHash: string | null;
  /** false = regeneración gratis por un cambio de narración: al terminar no se cobra. */
  billable: boolean;
  audioKey: string | null;
  alignmentKey: string | null;
  durationMs: number | null;
  reservedCharacters: number;
  unitsDone: number;
  unitsTotal: number;
}

/** Lo que el worker necesita para sintetizar un capítulo. */
export interface GenerationInput {
  segment: AudioSegmentRecord;
  bookId: string;
  language: string;
  characterCount: number;
  /** Chapter.sentences tal como las guardó el pipeline. */
  sentences: unknown;
}

/** Consumo del periodo: lo ya cobrado y lo reservado por lo que se está generando. */
export interface UsageSnapshot {
  quota: number;
  consumed: number;
  reserved: number;
  active: number;
  totalCharactersProcessed: number;
}

export interface GeneratedAudio {
  provider: string;
  prosodyKey: string;
  /** Huella de las oraciones que se sintetizaron (las que leyó el worker al empezar). */
  narrationHash: string;
  audioKey: string;
  alignmentKey: string;
  durationMs: number;
}
