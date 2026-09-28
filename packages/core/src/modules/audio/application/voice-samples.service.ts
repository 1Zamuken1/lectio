import { Inject, Injectable, Logger } from '@nestjs/common';
import type { VoiceUnit } from '@lectio/epub-pipeline';
import { renderUnits, resolveVoice, type ResolvedVoice } from '@lectio/tts';
import { FILE_STORAGE, storageKeys, type FileStorage } from '../../storage/file-storage.js';
import { availableVoices, voiceVersion } from '../domain/voices.js';
import { TtsProviderFactory } from '../infrastructure/tts/tts-provider.factory.js';

/** Frase con narración, diálogo y una pregunta: lo que distingue a cada perfil. */
const SAMPLES: Record<string, VoiceUnit[]> = {
  es: [
    { sentence: 0, kind: 'dialogue', text: 'Oye, chico,', pauseAfter: 'phrase' },
    { sentence: 0, kind: 'narration', text: 'preguntó el viajero,', pauseAfter: 'phrase' },
    { sentence: 0, kind: 'dialogue', text: '¿qué llevas ahí?', pauseAfter: 'paragraph' },
    {
      sentence: 1,
      kind: 'dialogue',
      text: 'Nada, señor. Solo unas piedras para mi madre.',
      pauseAfter: 'none',
    },
  ],
  en: [
    { sentence: 0, kind: 'dialogue', text: 'Hey, boy,', pauseAfter: 'phrase' },
    { sentence: 0, kind: 'narration', text: 'asked the traveler,', pauseAfter: 'phrase' },
    { sentence: 0, kind: 'dialogue', text: 'what are you carrying?', pauseAfter: 'paragraph' },
    {
      sentence: 1,
      kind: 'dialogue',
      text: 'Nothing, sir. Just some stones for my mother.',
      pauseAfter: 'none',
    },
  ],
};

/** Dónde vive la muestra de una voz: cambia si cambia su prosodia. */
export function sampleKey(voice: ResolvedVoice): string {
  return storageKeys.voiceSample(voice.id, voiceVersion(voice));
}

/**
 * Muestras de unos segundos de cada voz, para elegir antes de gastar cuota. Las genera el
 * worker al arrancar (la API nunca llama a TTS) y quedan en el storage; si un perfil cambia,
 * su clave cambia y se genera de nuevo.
 */
@Injectable()
export class VoiceSamplesService {
  private readonly logger = new Logger('VoiceSamples');

  constructor(
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    private readonly providers: TtsProviderFactory,
  ) {}

  async ensureAll(): Promise<void> {
    for (const { id, language } of availableVoices()) {
      const voice = resolveVoice(id, language);
      const key = sampleKey(voice);
      if ((await this.storage.size(key)) !== null) continue;
      const provider = this.providers.create(voice.prosody);
      try {
        const { audio } = await renderUnits(SAMPLES[language] ?? SAMPLES.es!, {
          provider,
          voice: voice.voice,
          language,
          concurrency: 2,
        });
        await this.storage.put(key, audio);
        this.logger.log(`Muestra de ${voice.label} lista`);
      } catch (error) {
        // Sin muestra la voz se puede usar igual; se reintenta en el próximo arranque.
        this.logger.warn(`Muestra de ${voice.label} sin generar: ${String(error)}`);
      } finally {
        provider.close();
      }
    }
  }
}
