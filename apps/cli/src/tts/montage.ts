import {
  alignVoiceUnits,
  type Alignment,
  type PauseKind,
  type TtsProvider,
  type VoiceUnit,
} from '@lectio/epub-pipeline';
import { mp3Silence } from './mp3.js';

/**
 * Pausas del montaje (docs/lectio-decision-tts.md §7): las decide Lectio, no el motor.
 * Afinadas escuchando: las de Edge tras un punto y aparte, "?" o "!" se sentían largas.
 */
export const PAUSES_MS: Record<PauseKind, number> = {
  phrase: 140,
  sentence: 300,
  paragraph: 480,
  none: 0,
};

/**
 * Sintetiza cada unidad (como máximo `concurrency` a la vez, en orden) y las une con las
 * pausas del montaje. `onProgress` recibe cuántas unidades van listas.
 */
export async function renderUnits(
  units: VoiceUnit[],
  options: {
    provider: TtsProvider;
    voice: string;
    language: string;
    concurrency: number;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<{ audio: Buffer; alignment: Alignment }> {
  let done = 0;
  const results = await mapLimit(units, options.concurrency, async (unit) => {
    const result = await options.provider.synthesize({
      text: unit.text,
      voiceId: options.voice,
      language: options.language,
      kind: unit.kind,
    });
    options.onProgress?.(++done, units.length);
    return result;
  });
  const pieces: Buffer[] = [];
  const durations: number[] = [];
  results.forEach((result, i) => {
    const pause = mp3Silence(result.audio, PAUSES_MS[units[i]!.pauseAfter]);
    pieces.push(result.audio, pause.audio);
    durations.push(result.durationMs + pause.durationMs);
  });
  return { audio: Buffer.concat(pieces), alignment: alignVoiceUnits(units, durations) };
}

/** Ejecuta `task` sobre cada elemento con como máximo `limit` en paralelo, conservando el orden. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
