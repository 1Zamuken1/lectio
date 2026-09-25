import { describe, expect, it } from 'vitest';
import { buildAlignment, buildChunks, type Sentence, type TtsResult } from '../../../src/index.js';

const sentence = (index: number, blockIndex: number, narration: string): Sentence => ({
  index,
  blockIndex,
  start: 0,
  end: narration.length,
  text: narration,
  narration,
});

/** TTS simulado: 10 ms por carácter y una marca por palabra, como Edge. */
function fakeTts(text: string, withBoundaries = true): TtsResult {
  const boundaries = [...text.matchAll(/\p{L}+/gu)].map((m) => ({
    textOffset: m.index,
    textLength: m[0].length,
    audioOffsetMs: m.index * 10,
  }));
  return {
    audio: Buffer.from(text),
    durationMs: text.length * 10,
    boundaries: withBoundaries ? boundaries : [],
  };
}

describe('buildChunks', () => {
  it('agrupa oraciones sin superar el máximo y sin cortarlas', () => {
    const chunks = buildChunks(
      [
        sentence(0, 0, 'Uno dos.'),
        sentence(1, 0, 'Tres cuatro.'),
        sentence(2, 1, 'Cinco seis siete.'),
      ],
      22,
    );

    expect(chunks.map((c) => c.text)).toEqual(['Uno dos. Tres cuatro.', 'Cinco seis siete.']);
    expect(chunks[0]!.pieces).toEqual([
      { sentence: 0, start: 0, end: 8 },
      { sentence: 1, start: 9, end: 21 },
    ]);
  });

  it('omite las oraciones sin narración', () => {
    const chunks = buildChunks(
      [
        sentence(0, 0, 'Hola.'),
        { ...sentence(1, 0, ''), text: 'doi:10.1/x' },
        sentence(2, 0, 'Chao.'),
      ],
      100,
    );

    expect(chunks.map((c) => c.pieces.map((p) => p.sentence))).toEqual([[0, 2]]);
  });

  it('prefiere cortar en un cambio de párrafo cuando el fragmento ya está lleno', () => {
    const chunks = buildChunks(
      [sentence(0, 0, 'a'.repeat(75) + '.'), sentence(1, 1, 'Nuevo párrafo.')],
      100,
    );

    expect(chunks).toHaveLength(2);
  });

  it('divide una oración más larga que el máximo, preferentemente en comas', () => {
    // La coma queda dentro de los primeros 60 caracteres: ahí debe cortar.
    const long = `${'palabra '.repeat(4)}primera parte, ${'otra '.repeat(8)}final.`;
    const chunks = buildChunks([sentence(0, 0, long)], 60);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.text.length <= 60)).toBe(true);
    expect(chunks[0]!.text.endsWith(',')).toBe(true);
    expect(chunks.flatMap((c) => c.pieces.map((p) => p.sentence))).toEqual(chunks.map(() => 0));
  });
});

describe('buildAlignment', () => {
  it('calcula tiempos por oración con las marcas de palabra, acumulando fragmentos', () => {
    const chunks = buildChunks(
      [
        sentence(0, 0, 'Uno dos.'),
        sentence(1, 0, 'Tres cuatro.'),
        sentence(2, 1, 'Cinco seis siete.'),
      ],
      22,
    );
    const alignment = buildAlignment(
      chunks,
      chunks.map((c) => fakeTts(c.text)),
    );

    expect(alignment).toEqual({
      version: 1,
      durationMs: 210 + 170,
      approximate: false,
      sentences: [
        { index: 0, startMs: 0, endMs: 90 },
        { index: 1, startMs: 90, endMs: 210 },
        { index: 2, startMs: 210, endMs: 380 },
      ],
    });
  });

  it('una oración partida en varios fragmentos va del primero al último', () => {
    const chunks = buildChunks(
      [sentence(0, 0, `${'palabra '.repeat(10)}fin.`), sentence(1, 0, 'Otra.')],
      40,
    );
    const alignment = buildAlignment(
      chunks,
      chunks.map((c) => fakeTts(c.text)),
    );
    const first = alignment.sentences[0]!;
    const second = alignment.sentences[1]!;

    expect(first.startMs).toBe(0);
    expect(first.endMs).toBe(second.startMs);
    expect(second.endMs).toBe(alignment.durationMs);
  });

  it('sin marcas de palabra, estima por longitud y lo indica', () => {
    const chunks = buildChunks([sentence(0, 0, 'Uno dos.'), sentence(1, 0, 'Tres cuatro.')], 100);
    const alignment = buildAlignment(
      chunks,
      chunks.map((c) => fakeTts(c.text, false)),
    );

    expect(alignment.approximate).toBe(true);
    expect(alignment.sentences).toEqual([
      { index: 0, startMs: 0, endMs: 90 },
      { index: 1, startMs: 90, endMs: 210 },
    ]);
  });
});
