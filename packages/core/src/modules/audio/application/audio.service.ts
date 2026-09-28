import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../../../config/config.module.js';
import type { AppConfig } from '../../../config/env.js';
import { assertCanRead } from '../../books/domain/access.js';
import { BookForbiddenError } from '../../books/domain/errors.js';
import { ChapterNotFoundError } from '../../chapters/domain/errors.js';
import {
  AudioAlreadyExistsError,
  AudioConcurrencyLimitError,
  PublicBookAudioError,
  TtsQuotaExceededError,
} from '../domain/errors.js';
import type { AudioSegmentRecord, AudioStatus, ChapterContext } from '../domain/model.js';
import {
  AUDIO_GENERATION_QUEUE,
  AUDIO_REPOSITORY,
  type AudioGenerationQueue,
  type AudioRepository,
} from '../domain/ports.js';
import { quotaPeriod, remainingQuota } from '../domain/quota.js';
import { pickVoice } from '../domain/voices.js';
import { MediaUrlSigner } from './media-urls.js';

export type AudioRequestResult =
  | { created: true; chapterId: string; voiceId: string; status: 'pending'; remaining: number }
  | { created: false; chapterId: string; voiceId: string; status: 'pending' | 'processing' };

export interface AudioState {
  chapterId: string;
  voiceId: string;
  status: 'none' | AudioStatus;
  /** Unidades de voz listas, mientras se genera. */
  progress: { done: number; total: number } | null;
  audioUrl: string | null;
  alignmentUrl: string | null;
  expiresAt: Date | null;
  durationMs: number | null;
  provider: string | null;
  /** El perfil de voz cambió desde que se generó: se puede volver a pedir. */
  outdated: boolean;
}

export interface Usage {
  periodStart: Date;
  resetsAt: Date;
  quota: number;
  consumed: number;
  reserved: number;
  remaining: number;
  totalCharactersProcessed: number;
}

/**
 * Solicitud y estado del audio de un capítulo (docs/lectio-arquitectura-api.md §1.5, flujo
 * de audio). La cuota y la concurrencia se deciden con la fila del usuario bloqueada, así
 * dos solicitudes simultáneas no pueden gastar dos veces el mismo saldo.
 */
@Injectable()
export class AudioService {
  constructor(
    @Inject(AUDIO_REPOSITORY) private readonly audio: AudioRepository,
    @Inject(AUDIO_GENERATION_QUEUE) private readonly queue: AudioGenerationQueue,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly signer: MediaUrlSigner,
  ) {}

  async request(userId: string, chapterId: string, voiceId?: string): Promise<AudioRequestResult> {
    const chapter = await this.chapter(chapterId);
    if (chapter.book.isPublic) throw new PublicBookAudioError();
    if (chapter.book.ownerId !== userId) throw new BookForbiddenError();
    const voice = pickVoice(voiceId, chapter.book.language);
    const { periodStart, resetsAt } = quotaPeriod(new Date());

    const outcome = await this.audio.withUserLock(userId, async (scope) => {
      const existing = await scope.findSegment(chapter.id, voice.id);
      if (existing?.status === 'pending' || existing?.status === 'processing') {
        return { created: false as const, status: existing.status };
      }
      if (existing?.status === 'ready' && existing.prosodyKey === voice.prosodyKey) {
        throw new AudioAlreadyExistsError();
      }
      const usage = await scope.usage(periodStart);
      if (usage.active >= this.config.AUDIO_MAX_PER_USER) {
        throw new AudioConcurrencyLimitError(this.config.AUDIO_MAX_PER_USER);
      }
      const remaining = remainingQuota(usage);
      if (chapter.characterCount > remaining) {
        throw new TtsQuotaExceededError({
          required: chapter.characterCount,
          remaining,
          resetsAt: resetsAt.toISOString(),
        });
      }
      const segment = await scope.reserve({
        chapterId: chapter.id,
        voiceId: voice.id,
        userId,
        characters: chapter.characterCount,
      });
      return { created: true as const, segment, remaining: remaining - chapter.characterCount };
    });

    if (!outcome.created) {
      return { created: false, chapterId, voiceId: voice.id, status: outcome.status };
    }
    try {
      await this.queue.enqueue(outcome.segment.id);
    } catch (error) {
      // Sin job no hay quien lo genere: se deshace la reserva para no bloquear la cuota.
      await this.audio.delete(outcome.segment.id);
      throw error;
    }
    return {
      created: true,
      chapterId,
      voiceId: voice.id,
      status: 'pending',
      remaining: outcome.remaining,
    };
  }

  async state(userId: string | null, chapterId: string, voiceId?: string): Promise<AudioState> {
    const chapter = await this.chapter(chapterId);
    assertCanRead(userId, chapter.book);
    const voice = pickVoice(voiceId, chapter.book.language);
    const segment = await this.audio.findSegment(chapter.id, voice.id);
    return this.#toState(chapterId, voice.id, voice.prosodyKey, segment);
  }

  async usage(userId: string): Promise<Usage> {
    const { periodStart, resetsAt } = quotaPeriod(new Date());
    const usage = await this.audio.usage(userId, periodStart);
    return {
      periodStart,
      resetsAt,
      quota: usage.quota,
      consumed: usage.consumed,
      reserved: usage.reserved,
      remaining: remainingQuota(usage),
      totalCharactersProcessed: usage.totalCharactersProcessed,
    };
  }

  async chapter(chapterId: string): Promise<ChapterContext> {
    const chapter = await this.audio.findChapter(chapterId);
    if (!chapter) throw new ChapterNotFoundError();
    return chapter;
  }

  #toState(
    chapterId: string,
    voiceId: string,
    prosodyKey: string,
    segment: AudioSegmentRecord | null,
  ): AudioState {
    const base: AudioState = {
      chapterId,
      voiceId,
      status: segment?.status ?? 'none',
      progress: null,
      audioUrl: null,
      alignmentUrl: null,
      expiresAt: null,
      durationMs: null,
      provider: null,
      outdated: false,
    };
    if (!segment) return base;
    if (segment.status === 'pending' || segment.status === 'processing') {
      return { ...base, progress: { done: segment.unitsDone, total: segment.unitsTotal } };
    }
    if (segment.status !== 'ready' || !segment.audioKey || !segment.alignmentKey) return base;
    const audio = this.signer.sign(segment.audioKey);
    return {
      ...base,
      audioUrl: audio.url,
      alignmentUrl: this.signer.sign(segment.alignmentKey).url,
      expiresAt: audio.expiresAt,
      durationMs: segment.durationMs,
      provider: segment.provider,
      outdated: segment.prosodyKey !== prosodyKey,
    };
  }
}
