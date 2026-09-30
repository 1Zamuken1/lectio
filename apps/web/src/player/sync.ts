/**
 * Conversiones entre el audio y el texto (frontend §6.2): funciones puras sobre el
 * `alignment.json` del worker. Las oraciones que no se narran no tienen entrada, así que
 * hay huecos en los índices.
 */

export interface Alignment {
  version: 1;
  durationMs: number;
  /** true si el proveedor no dio marcas de palabra y los tiempos se estimaron. */
  approximate: boolean;
  sentences: Array<{ index: number; startMs: number; endMs: number }>;
}

/** Inicio de la primera oración narrada en o después de `sentenceIndex`; null si no hay. */
export function sentenceToTime(alignment: Alignment, sentenceIndex: number): number | null {
  const entry = alignment.sentences.find((s) => s.index >= sentenceIndex);
  return entry ? entry.startMs : null;
}

/** Oración que suena en `timeMs`: la última cuyo inicio ya pasó (búsqueda binaria); -1 antes de la primera. */
export function timeToSentence(alignment: Alignment, timeMs: number): number {
  const list = alignment.sentences;
  let low = 0;
  let high = list.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (list[mid]!.startMs <= timeMs) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found === -1 ? -1 : list[found]!.index;
}

/** "4:05" o "1:02:09". */
export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}

/** Caracteres por segundo al generar (medido: ~25.000 caracteres en ~110 s). */
const CHARS_PER_SECOND = 230;

/** Cuánto tarda en generarse un capítulo: "≈ 40 s", "≈ 3 min". */
export function generationEta(characters: number): string {
  const seconds = Math.max(5, Math.round(characters / CHARS_PER_SECOND / 5) * 5);
  return seconds < 90 ? `${seconds} s` : `${Math.round(seconds / 60)} min`;
}

/** Sobre esta fracción de la cuota del mes, generar un capítulo se confirma antes. */
export const CONFIRM_SHARE = 0.05;

/** ¿Este capítulo cuesta lo bastante como para preguntar antes de generarlo? */
export function needsConfirmation(characters: number, quota: number): boolean {
  return characters > quota * CONFIRM_SHARE;
}
