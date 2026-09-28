/**
 * Montaje de MP3 por tramas, sin decodificar: el audio de Edge es MPEG-2 capa III de
 * bitrate constante, así que se puede cortar y unir tramo a tramo (24 ms cada uno).
 * Sirve para quitar el silencio que el motor pone al inicio y al final de cada unidad e
 * insertar pausas propias (docs/lectio-decision-tts.md §7).
 */

export interface Frame {
  start: number;
  length: number;
  durationMs: number;
}

const BITRATES_KBPS: Record<number, number[]> = {
  // MPEG-1 capa III
  3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  // MPEG-2 y 2.5 capa III
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  0: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const SAMPLE_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000],
  2: [22050, 24000, 16000],
  0: [11025, 12000, 8000],
};

/** Tramas de un MP3 de capa III. Lo que no es una cabecera válida (ID3, basura) se salta. */
export function mp3Frames(mp3: Buffer): Frame[] {
  const frames: Frame[] = [];
  let i = 0;
  while (i + 4 <= mp3.length) {
    const header = frameHeader(mp3, i);
    if (!header || i + header.length > mp3.length) {
      i++;
      continue;
    }
    frames.push({ start: i, ...header });
    i += header.length;
  }
  return frames;
}

function frameHeader(mp3: Buffer, i: number): { length: number; durationMs: number } | null {
  if (mp3[i] !== 0xff || (mp3[i + 1]! & 0xe0) !== 0xe0) return null;
  const version = (mp3[i + 1]! >> 3) & 3;
  const layer = (mp3[i + 1]! >> 1) & 3;
  const bitrate = BITRATES_KBPS[version]?.[(mp3[i + 2]! >> 4) & 15];
  const sampleRate = SAMPLE_RATES[version]?.[(mp3[i + 2]! >> 2) & 3];
  if (layer !== 1 || !bitrate || !sampleRate) return null;
  const padding = (mp3[i + 2]! >> 1) & 1;
  const samples = version === 3 ? 1152 : 576;
  const length = Math.floor(((samples / 8) * bitrate * 1000) / sampleRate) + padding;
  return { length, durationMs: (samples / sampleRate) * 1000 };
}

/**
 * Solo las tramas que cubren [fromMs, toMs). `startMs`: dónde empezaba, en el audio
 * original, la primera trama conservada (para desplazar las marcas de palabra).
 */
export function trimMp3(
  mp3: Buffer,
  fromMs: number,
  toMs: number,
): { audio: Buffer; startMs: number } {
  const kept: Buffer[] = [];
  let startMs: number | null = null;
  let at = 0;
  for (const frame of mp3Frames(mp3)) {
    if (at + frame.durationMs > fromMs && at < toMs) {
      startMs ??= at;
      kept.push(mp3.subarray(frame.start, frame.start + frame.length));
    }
    at += frame.durationMs;
  }
  return { audio: Buffer.concat(kept), startMs: startMs ?? 0 };
}

export function mp3DurationMs(mp3: Buffer): number {
  return mp3Frames(mp3).reduce((ms, f) => ms + f.durationMs, 0);
}

/**
 * Silencio digital con el formato de `sample`: tramas con la misma cabecera (sin CRC ni
 * relleno) y todo lo demás en cero. Con la información lateral en cero, la trama no tiene
 * coeficientes y el decodificador produce silencio exacto.
 */
export function mp3Silence(sample: Buffer, ms: number): { audio: Buffer; durationMs: number } {
  const [first] = mp3Frames(sample);
  if (!first || ms <= 0) return { audio: Buffer.alloc(0), durationMs: 0 };
  const header = Buffer.from(sample.subarray(first.start, first.start + 4));
  header[1] = header[1]! | 0x01; // sin CRC
  header[2] = header[2]! & 0xfd; // sin relleno
  const { length } = frameHeader(header, 0)!;
  const frame = Buffer.alloc(length);
  header.copy(frame, 0);
  const count = Math.round(ms / first.durationMs);
  return {
    audio: Buffer.concat(Array.from({ length: count }, () => frame)),
    durationMs: count * first.durationMs,
  };
}
