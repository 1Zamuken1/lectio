import type {
  AudioSegmentRecord,
  ChapterContext,
  GeneratedAudio,
  GenerationInput,
  UsageSnapshot,
} from './model.js';

/**
 * Operaciones dentro de la transacción de una solicitud de audio, con la fila del usuario
 * bloqueada (SELECT … FOR UPDATE): dos solicitudes simultáneas del mismo usuario se
 * atienden una detrás de otra, así la segunda ve la reserva de la primera.
 */
export interface LockedAudioScope {
  usage(periodStart: Date): Promise<UsageSnapshot>;
  findSegment(chapterId: string, voiceId: string): Promise<AudioSegmentRecord | null>;
  /**
   * Crea el segmento en pending con su reserva, o reutiliza uno en error u obsoleto. Con
   * `billable: false` (regeneración por cambio de narración) no reserva ni cobra.
   */
  reserve(input: {
    chapterId: string;
    voiceId: string;
    userId: string;
    characters: number;
    billable: boolean;
  }): Promise<AudioSegmentRecord>;
}

export interface AudioRepository {
  findChapter(chapterId: string): Promise<ChapterContext | null>;
  findSegment(chapterId: string, voiceId: string): Promise<AudioSegmentRecord | null>;
  withUserLock<T>(userId: string, work: (scope: LockedAudioScope) => Promise<T>): Promise<T>;
  usage(userId: string, periodStart: Date): Promise<UsageSnapshot>;
  /** Capítulos narrativos de un libro, en orden (para el audio del sistema). */
  narrativeChapters(bookId: string): Promise<Array<{ id: string; orderIndex: number }>>;
  /**
   * Audio generado por el sistema (libros públicos): sin dueño, sin reserva ni cobro. null
   * si ya está generándose o listo con el perfil y la narración vigentes.
   */
  reserveSystem(
    chapterId: string,
    voiceId: string,
    prosodyKey: string,
  ): Promise<AudioSegmentRecord | null>;

  /**
   * Audio del sistema (libros públicos) listo pero obsoleto porque cambió la narración del
   * capítulo (tras reprocesar el libro): lo que hay que regenerar.
   */
  outdatedSystemAudio(bookId: string): Promise<Array<{ chapterId: string; voiceId: string }>>;

  // Lado worker
  /** pending/processing → processing; null si ya no hay nada que generar. */
  startGeneration(segmentId: string): Promise<GenerationInput | null>;
  updateProgress(segmentId: string, done: number, total: number): Promise<void>;
  /**
   * En una transacción: el segmento ready y, si se cobra (tiene solicitante y es billable),
   * el log de consumo y el contador del usuario.
   */
  complete(segmentId: string, audio: GeneratedAudio, characters: number): Promise<boolean>;
  /** Falla definitiva: sale de pending/processing, así la reserva deja de contar. */
  fail(segmentId: string, message: string): Promise<void>;
  /** Un segmento que quedó pending porque no se pudo encolar. */
  delete(segmentId: string): Promise<void>;
}

export interface AudioGenerationQueue {
  enqueue(segmentId: string): Promise<void>;
}

export const AUDIO_REPOSITORY = Symbol('AUDIO_REPOSITORY');
export const AUDIO_GENERATION_QUEUE = Symbol('AUDIO_GENERATION_QUEUE');
