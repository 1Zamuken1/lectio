import { createHash } from 'node:crypto';
import type { Sentence } from '../narration/narrate.js';

/**
 * Huella de lo que se narra en un capítulo: exactamente lo que `buildVoiceUnits` usa para
 * armar el audio (oraciones narradas, su bloque, su narración y sus tramos de voz). Si
 * dos versiones del pipeline dan la misma huella, el audio generado con una sirve para la
 * otra; si cambia, ese audio quedó obsoleto. El texto de lectura y sus offsets no entran:
 * corregir el HTML no obliga a regenerar la voz.
 */
export function narrationFingerprint(sentences: readonly Sentence[]): string {
  const narrated = sentences
    .filter((s) => s.narration)
    .map((s) => [s.index, s.blockIndex, s.narration, s.voices ?? null]);
  return createHash('sha256').update(JSON.stringify(narrated)).digest('hex').slice(0, 16);
}
