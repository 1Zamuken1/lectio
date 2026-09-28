import { Inject, Injectable } from '@nestjs/common';
import type { TtsProvider, VoiceKind } from '@lectio/epub-pipeline';
import { EdgeTtsProvider, SilentTtsProvider, type Prosody } from '@lectio/tts';
import { APP_CONFIG } from '../../../../config/config.module.js';
import type { AppConfig } from '../../../../config/env.js';

export type ClosableTtsProvider = TtsProvider & { close(): void };

/**
 * Crea el proveedor de TTS de cada capítulo, con la prosodia de su perfil de voz. Con
 * TTS_PROVIDER=silent no hay red: los tests usan la palabra LECTIOFALLATTS en un capítulo
 * para provocar un fallo de síntesis.
 */
@Injectable()
export class TtsProviderFactory {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  create(prosody: Record<VoiceKind, Prosody>): ClosableTtsProvider {
    if (this.config.TTS_PROVIDER === 'silent') {
      return new SilentTtsProvider({ failWhen: /LECTIOFALLATTS/ });
    }
    return new EdgeTtsProvider({ prosody, trimSilence: true });
  }
}
