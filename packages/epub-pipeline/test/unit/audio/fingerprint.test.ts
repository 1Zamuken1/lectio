import { describe, expect, it } from 'vitest';
import { narrationFingerprint, type Sentence } from '../../../src/index.js';

const sentence = (index: number, narration: string, extra: Partial<Sentence> = {}): Sentence => ({
  index,
  blockIndex: 0,
  start: 0,
  end: narration.length,
  text: narration,
  narration,
  ...extra,
});

const chapter = [sentence(0, 'Capítulo primero.'), sentence(1, 'El viajero siguió.')];

describe('narrationFingerprint', () => {
  it('es estable y corta', () => {
    expect(narrationFingerprint(chapter)).toBe(narrationFingerprint(structuredClone(chapter)));
    expect(narrationFingerprint(chapter)).toMatch(/^[0-9a-f]{16}$/);
  });

  it('cambia si cambia lo que se narra: el texto, el bloque o los tramos de voz', () => {
    const base = narrationFingerprint(chapter);
    // Como la regla de la tilde: "ó" suelta pasa a "o" en la narración, no en el texto.
    const accent = [chapter[0]!, sentence(1, 'Uno ó dos.', { narration: 'Uno o dos.' })];
    const old = [chapter[0]!, sentence(1, 'Uno ó dos.')];
    expect(narrationFingerprint(accent)).not.toBe(narrationFingerprint(old));
    expect(
      narrationFingerprint([chapter[0]!, sentence(1, 'El viajero siguió.', { blockIndex: 1 })]),
    ).not.toBe(base);
    expect(
      narrationFingerprint([
        chapter[0]!,
        sentence(1, 'El viajero siguió.', {
          voices: [{ kind: 'dialogue', text: 'El viajero siguió.' }],
        }),
      ]),
    ).not.toBe(base);
  });

  it('no cambia por el texto de lectura, los offsets ni las oraciones que no se narran', () => {
    const base = narrationFingerprint(chapter);
    const reworded = chapter.map((s) => ({ ...s, text: `${s.text} `, start: 3, end: 40 }));
    expect(narrationFingerprint(reworded)).toBe(base);
    expect(narrationFingerprint([...chapter, sentence(2, '')])).toBe(base);
  });
});
