import type { Sentence } from '../narration/narrate.js';
import type { Alignment, TtsResult } from './tts.js';

/** Fragmento de texto que se envía en una sola solicitud al TTS. */
export interface AudioChunk {
  text: string;
  /** Qué parte del texto corresponde a cada oración. Una oración muy larga puede ocupar varios fragmentos. */
  pieces: Array<{ sentence: number; start: number; end: number }>;
}

/** A partir de este llenado, un cambio de párrafo es buen lugar para cortar. */
const PARAGRAPH_BREAK_RATIO = 0.7;

/**
 * Etapa 10 (docs/lectio-pipeline-limpieza.md §4): agrupa las oraciones narradas en
 * fragmentos de hasta `maxChunkChars`, sin cortar nunca una oración y prefiriendo cortar
 * entre párrafos. Una oración más larga que el máximo (listas o versos sin puntuación)
 * se divide en comas, punto y coma o, en último caso, espacios.
 */
export function buildChunks(sentences: Sentence[], maxChunkChars: number): AudioChunk[] {
  const chunks: AudioChunk[] = [];
  let current: AudioChunk = { text: '', pieces: [] };
  let currentBlock: number | null = null;

  const flush = () => {
    if (current.pieces.length > 0) chunks.push(current);
    current = { text: '', pieces: [] };
  };

  for (const sentence of sentences) {
    if (!sentence.narration) continue;
    for (const piece of splitLong(sentence.narration, maxChunkChars)) {
      const separator = current.text ? ' ' : '';
      const nextLength = current.text.length + separator.length + piece.length;
      const paragraphChange = currentBlock !== null && sentence.blockIndex !== currentBlock;
      if (
        nextLength > maxChunkChars ||
        (paragraphChange && current.text.length >= maxChunkChars * PARAGRAPH_BREAK_RATIO)
      ) {
        flush();
      }
      const start = current.text.length + (current.text ? 1 : 0);
      current.text += (current.text ? ' ' : '') + piece;
      current.pieces.push({ sentence: sentence.index, start, end: start + piece.length });
      currentBlock = sentence.blockIndex;
    }
  }
  flush();
  return chunks;
}

function splitLong(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const pieces: string[] = [];
  let rest = text;
  while (rest.length > max) {
    const window = rest.slice(0, max);
    const cut = Math.max(
      window.lastIndexOf(', '),
      window.lastIndexOf('; '),
      window.lastIndexOf(': '),
    );
    const at = cut > max * 0.3 ? cut + 1 : Math.max(window.lastIndexOf(' '), 1);
    pieces.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) pieces.push(rest);
  return pieces;
}

/**
 * Etapa 11: con las marcas de palabra de cada fragmento se calcula dónde empieza y
 * termina cada oración en el audio del capítulo (los fragmentos se concatenan en orden).
 *
 * Sin marcas (proveedor que no las entrega), los tiempos se reparten en proporción a la
 * longitud del texto y la alineación queda marcada como aproximada: sirve para
 * sincronizar lectura y audio con un margen de un par de segundos.
 */
export function buildAlignment(chunks: AudioChunk[], results: TtsResult[]): Alignment {
  const spans = new Map<number, { startMs: number; endMs: number }>();
  let chunkStartMs = 0;
  let approximate = false;

  chunks.forEach((chunk, i) => {
    const result = results[i]!;
    const starts = chunk.pieces.map((piece) => {
      const boundary = result.boundaries.find(
        (b) => b.textOffset >= piece.start && b.textOffset < piece.end,
      );
      if (!boundary) approximate = true;
      return boundary
        ? boundary.audioOffsetMs
        : (piece.start / Math.max(chunk.text.length, 1)) * result.durationMs;
    });

    chunk.pieces.forEach((piece, p) => {
      const startMs = chunkStartMs + starts[p]!;
      const endMs = chunkStartMs + (starts[p + 1] ?? result.durationMs);
      const existing = spans.get(piece.sentence);
      // Una oración partida en varios fragmentos: empieza en el primero y termina en el último.
      spans.set(piece.sentence, { startMs: existing?.startMs ?? startMs, endMs });
    });
    chunkStartMs += result.durationMs;
  });

  return {
    version: 1,
    durationMs: Math.round(chunkStartMs),
    approximate,
    sentences: [...spans]
      .sort(([a], [b]) => a - b)
      .map(([index, span]) => ({
        index,
        startMs: Math.round(span.startMs),
        endMs: Math.round(span.endMs),
      })),
  };
}
