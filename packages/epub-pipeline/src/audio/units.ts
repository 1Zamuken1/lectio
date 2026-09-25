import type { VoiceKind } from '../narration/dialogue.js';
import type { Sentence } from '../narration/narrate.js';
import { splitLong } from './chunks.js';
import type { Alignment } from './tts.js';

/** Qué silencio va después de una unidad. */
export type PauseKind = 'phrase' | 'sentence' | 'paragraph' | 'none';

/**
 * Unidad de voz: lo que se envía en una sola solicitud al TTS. Una oración, o un tramo de
 * narración o de diálogo dentro de ella.
 */
export interface VoiceUnit {
  sentence: number;
  kind: VoiceKind;
  text: string;
  pauseAfter: PauseKind;
}

/**
 * Etapa 10, por unidades de voz (docs/lectio-decision-tts.md §7). Frente a `buildChunks`
 * (varias oraciones por solicitud), cada oración va aparte: el montaje decide la pausa
 * tras cada una en vez de dejarla al motor, y cada tramo de diálogo puede sonar distinto
 * a la narración. Cuesta más solicitudes, no más caracteres.
 *
 * Pausas: `phrase` entre tramos de una misma oración, `sentence` entre oraciones de un
 * mismo párrafo, `paragraph` al cambiar de bloque y `none` al final del capítulo.
 */
export function buildVoiceUnits(sentences: Sentence[], maxChars: number): VoiceUnit[] {
  const narrated = sentences.filter((s) => s.narration);
  const units: VoiceUnit[] = [];
  narrated.forEach((sentence, i) => {
    const next = narrated[i + 1];
    const parts = sentence.voices ?? [{ kind: 'narration' as const, text: sentence.narration }];
    const pieces = parts.flatMap((part) =>
      splitLong(part.text, maxChars).map((text) => ({ kind: part.kind, text })),
    );
    const last: PauseKind = !next
      ? 'none'
      : next.blockIndex === sentence.blockIndex
        ? 'sentence'
        : 'paragraph';
    pieces.forEach((piece, p) => {
      units.push({
        sentence: sentence.index,
        kind: piece.kind,
        text: piece.text,
        pauseAfter: p === pieces.length - 1 ? last : 'phrase',
      });
    });
  });
  return units;
}

/**
 * Etapa 11 para unidades de voz: cada unidad es una solicitud, así que sus tiempos se
 * conocen exactos. `durationsMs[i]` es lo que ocupa la unidad `i` en el audio del
 * capítulo, incluida la pausa que la sigue. Una oración va desde el inicio de su primera
 * unidad hasta el inicio de la oración siguiente.
 */
export function alignVoiceUnits(units: VoiceUnit[], durationsMs: number[]): Alignment {
  const starts = new Map<number, number>();
  let offset = 0;
  units.forEach((unit, i) => {
    if (!starts.has(unit.sentence)) starts.set(unit.sentence, offset);
    offset += durationsMs[i]!;
  });
  const ordered = [...starts].sort(([a], [b]) => a - b);
  return {
    version: 1,
    durationMs: Math.round(offset),
    approximate: false,
    sentences: ordered.map(([index, startMs], i) => ({
      index,
      startMs: Math.round(startMs),
      endMs: Math.round(ordered[i + 1]?.[1] ?? offset),
    })),
  };
}
