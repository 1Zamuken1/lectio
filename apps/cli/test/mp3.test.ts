import { describe, expect, it } from 'vitest';
import { mp3DurationMs, mp3Frames, mp3Silence, trimMp3 } from '../src/tts/mp3.js';

/** MP3 sintético como el de Edge: MPEG-2 capa III, 48 kbps, 24 kHz, mono (144 bytes, 24 ms). */
function fakeMp3(frames: number, junk = 0): Buffer {
  const frame = Buffer.alloc(144, 0x55);
  frame.set([0xff, 0xf3, 0x64, 0xc4]);
  return Buffer.concat([
    Buffer.alloc(junk, 0x00),
    ...Array.from({ length: frames }, (_, i) => {
      const copy = Buffer.from(frame);
      copy[4] = i; // marca para reconocer cada trama
      return copy;
    }),
  ]);
}

describe('mp3', () => {
  it('reconoce las tramas y su duración, saltando lo que no es cabecera', () => {
    const frames = mp3Frames(fakeMp3(10, 7));
    expect(frames).toHaveLength(10);
    expect(frames[0]).toEqual({ start: 7, length: 144, durationMs: 24 });
    expect(mp3DurationMs(fakeMp3(10))).toBe(240);
  });

  it('recorta a las tramas que cubren el rango e informa dónde empieza', () => {
    const { audio, startMs } = trimMp3(fakeMp3(10), 50, 130);
    // Tramas 2 (48–72 ms) a 5 (120–144 ms).
    expect(startMs).toBe(48);
    expect(mp3Frames(audio).map((f) => audio[f.start + 4])).toEqual([2, 3, 4, 5]);
  });

  it('el silencio tiene la cabecera de la muestra, sin CRC, y el resto en cero', () => {
    const { audio, durationMs } = mp3Silence(fakeMp3(1), 300);
    expect(durationMs).toBe(312); // 13 tramas de 24 ms
    const frames = mp3Frames(audio);
    expect(frames).toHaveLength(13);
    expect([...audio.subarray(0, 4)]).toEqual([0xff, 0xf3, 0x64, 0xc4]);
    expect(audio.subarray(4, 144).every((b) => b === 0)).toBe(true);
    expect(mp3Silence(fakeMp3(1), 0).audio).toHaveLength(0);
  });
});
