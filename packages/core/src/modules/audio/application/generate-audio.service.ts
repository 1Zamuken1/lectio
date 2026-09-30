import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  buildVoiceUnits,
  narrationFingerprint,
  type Sentence,
  type VoiceUnit,
} from '@lectio/epub-pipeline';
import { renderUnits, resolveVoice } from '@lectio/tts';
import { APP_CONFIG } from '../../../config/config.module.js';
import type { AppConfig } from '../../../config/env.js';
import { FILE_STORAGE, storageKeys, type FileStorage } from '../../storage/file-storage.js';
import { AUDIO_REPOSITORY, type AudioRepository } from '../domain/ports.js';
import { primaryLanguage, voiceVersion } from '../domain/voices.js';
import { TtsProviderFactory } from '../infrastructure/tts/tts-provider.factory.js';

export type GenerationOutcome =
  { status: 'ready'; durationMs: number; units: number } | { status: 'skipped' };

/** El progreso se guarda como mucho una vez por segundo (y siempre al terminar). */
const PROGRESS_INTERVAL_MS = 1000;

/**
 * Genera el audio de un capítulo en el worker (docs/lectio-arquitectura-api.md §1.5): una
 * solicitud de TTS por unidad de voz, cada una con sus reintentos; el montaje con las
 * pausas de Lectio; el MP3 y la alineación al storage, y al final, en una transacción, el
 * segmento ready, el log de consumo y el contador del usuario.
 */
@Injectable()
export class GenerateAudioService {
  private readonly logger = new Logger('GenerateAudio');

  constructor(
    @Inject(AUDIO_REPOSITORY) private readonly audio: AudioRepository,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly providers: TtsProviderFactory,
  ) {}

  async generate(segmentId: string): Promise<GenerationOutcome> {
    const input = await this.audio.startGeneration(segmentId);
    if (!input) return { status: 'skipped' }; // se borró o ya no está pendiente

    const { segment, bookId } = input;
    const language = primaryLanguage(input.language);
    const voice = resolveVoice(segment.voiceId, language);
    const provider = this.providers.create(voice.prosody);
    try {
      const sentences = input.sentences as Sentence[];
      const units: VoiceUnit[] = buildVoiceUnits(sentences, provider.maxChunkChars);
      await this.audio.updateProgress(segmentId, 0, units.length);
      let savedAt = Date.now();
      const { audio, alignment } = await renderUnits(units, {
        provider,
        voice: voice.voice,
        language,
        concurrency: this.config.TTS_REQUESTS_PER_CHAPTER,
        onProgress: (done, total) => {
          if (done < total && Date.now() - savedAt < PROGRESS_INTERVAL_MS) return;
          savedAt = Date.now();
          this.audio.updateProgress(segmentId, done, total).catch((error: unknown) => {
            this.logger.warn(`Progreso de ${segmentId} sin guardar: ${String(error)}`);
          });
        },
      });

      // De las oraciones leídas al empezar: si el libro se reprocesa mientras tanto, el
      // audio queda marcado obsoleto en vez de pasar por vigente.
      const narrationHash = narrationFingerprint(sentences);
      // Cada grabación tiene su propia clave (la voz y el momento, en hexadecimal: es lo que
      // acepta /media): al regenerar un audio desactualizado, el nuevo no pisa al que puede
      // estar sonando (en Windows, reemplazar un archivo abierto falla) y ninguna caché
      // sirve el viejo con la URL del nuevo.
      const version = `${voiceVersion(voice)}${Date.now().toString(16)}`;
      const audioKey = storageKeys.audio(bookId, segment.chapterId, voice.id, version);
      const alignmentKey = storageKeys.alignment(bookId, segment.chapterId, voice.id, version);
      // Archivos primero y base después: el segmento nunca queda ready sin su audio.
      await this.storage.put(audioKey, audio);
      await this.storage.put(alignmentKey, Buffer.from(`${JSON.stringify(alignment)}\n`));
      const completed = await this.audio.complete(
        segmentId,
        {
          provider: provider.name,
          prosodyKey: voice.prosodyKey,
          narrationHash,
          audioKey,
          alignmentKey,
          durationMs: alignment.durationMs,
        },
        input.characterCount,
      );
      if (completed) await this.#removeReplaced(segment, audioKey, alignmentKey);
      return { status: 'ready', durationMs: alignment.durationMs, units: units.length };
    } finally {
      provider.close();
    }
  }

  /**
   * Los archivos de la grabación anterior, si esta la reemplazó. Si no se pueden borrar
   * (alguien los está escuchando), quedan huérfanos: no rompen nada.
   */
  async #removeReplaced(
    previous: { audioKey: string | null; alignmentKey: string | null },
    audioKey: string,
    alignmentKey: string,
  ): Promise<void> {
    for (const [old, current] of [
      [previous.audioKey, audioKey],
      [previous.alignmentKey, alignmentKey],
    ] as const) {
      if (!old || old === current) continue;
      await this.storage.delete(old).catch((error: unknown) => {
        this.logger.warn(`No se pudo borrar ${old}: ${String(error)}`);
      });
    }
  }

  /**
   * Último intento fallido: su reserva deja de contar. Si era una regeneración, el segmento
   * vuelve a la grabación anterior (sigue desactualizado y se puede reintentar); si no,
   * queda en error.
   */
  async giveUp(segmentId: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    await this.audio.fail(segmentId, message);
  }
}
