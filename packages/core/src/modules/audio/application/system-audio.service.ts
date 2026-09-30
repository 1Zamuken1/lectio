import { Inject, Injectable } from '@nestjs/common';
import {
  AUDIO_GENERATION_QUEUE,
  AUDIO_REPOSITORY,
  type AudioGenerationQueue,
  type AudioRepository,
} from '../domain/ports.js';
import { pickVoice } from '../domain/voices.js';

/**
 * Audio de los libros públicos, generado por el sistema (docs/lectio-arquitectura-api.md
 * §1.7): sin cuota ni TtsUsageLog. Pasa por la misma cola que el de los usuarios, así el
 * límite global hacia el proveedor (RNF-07) vale también para él.
 */
@Injectable()
export class SystemAudioService {
  constructor(
    @Inject(AUDIO_REPOSITORY) private readonly audio: AudioRepository,
    @Inject(AUDIO_GENERATION_QUEUE) private readonly queue: AudioGenerationQueue,
  ) {}

  /**
   * Encola los primeros `limit` capítulos narrativos (todos si es null) con una voz. Los que
   * ya están listos o generándose se saltan: se puede correr de nuevo sin duplicar trabajo.
   */
  async enqueueBook(
    bookId: string,
    options: { language: string | null; voiceId?: string; limit: number | null },
  ): Promise<{ voiceId: string; enqueued: number; skipped: number }> {
    const voice = pickVoice(options.voiceId, options.language);
    const chapters = await this.audio.narrativeChapters(bookId);
    const selected = options.limit === null ? chapters : chapters.slice(0, options.limit);
    let enqueued = 0;
    for (const chapter of selected) {
      const segment = await this.audio.reserveSystem(chapter.id, voice.id, voice.prosodyKey);
      if (!segment) continue;
      await this.queue.enqueue(segment.id);
      enqueued++;
    }
    return { voiceId: voice.id, enqueued, skipped: selected.length - enqueued };
  }

  /**
   * Tras reprocesar un libro público: vuelve a encolar, con la misma voz, el audio que ya
   * existía y quedó obsoleto porque cambió la narración. No agrega capítulos que no tenían
   * audio. Nadie puede pedirlo a mano (el audio público es del sistema), por eso se hace
   * solo; no hay cuota de por medio.
   */
  async regenerateOutdated(bookId: string, language: string | null): Promise<number> {
    let enqueued = 0;
    for (const { chapterId, voiceId } of await this.audio.outdatedSystemAudio(bookId)) {
      const voice = pickVoice(voiceId, language);
      const segment = await this.audio.reserveSystem(chapterId, voice.id, voice.prosodyKey);
      if (!segment) continue;
      await this.queue.enqueue(segment.id);
      enqueued++;
    }
    return enqueued;
  }
}
