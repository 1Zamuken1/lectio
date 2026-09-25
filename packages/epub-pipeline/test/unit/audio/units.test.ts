import { describe, expect, it } from 'vitest';
import { alignVoiceUnits, buildVoiceUnits, type Sentence } from '../../../src/index.js';

const sentence = (
  index: number,
  blockIndex: number,
  narration: string,
  voices?: Sentence['voices'],
): Sentence => ({
  index,
  blockIndex,
  start: 0,
  end: narration.length,
  text: narration,
  narration,
  ...(voices ? { voices } : {}),
});

describe('buildVoiceUnits', () => {
  it('una unidad por oración o tramo, con la pausa que corresponde', () => {
    const units = buildVoiceUnits(
      [
        sentence(0, 0, 'Se puso el sol.'),
        sentence(1, 0, 'Vino la noche.'),
        sentence(2, 1, ''),
        sentence(3, 2, 'Vamos dijo el viajero, humanidad tenemos.', [
          { kind: 'dialogue', text: 'Vamos' },
          { kind: 'narration', text: 'dijo el viajero,' },
          { kind: 'dialogue', text: 'humanidad tenemos.' },
        ]),
      ],
      100,
    );
    expect(units.map((u) => [u.sentence, u.kind[0], u.text, u.pauseAfter])).toEqual([
      [0, 'n', 'Se puso el sol.', 'sentence'],
      [1, 'n', 'Vino la noche.', 'paragraph'],
      [3, 'd', 'Vamos', 'phrase'],
      [3, 'n', 'dijo el viajero,', 'phrase'],
      [3, 'd', 'humanidad tenemos.', 'none'],
    ]);
  });

  it('una oración más larga que el máximo se parte en frases', () => {
    const units = buildVoiceUnits([sentence(0, 0, 'uno, dos, tres, cuatro, cinco, seis.')], 16);
    expect(units.map((u) => u.text).join(' ')).toBe('uno, dos, tres, cuatro, cinco, seis.');
    expect(units.every((u) => u.text.length <= 16)).toBe(true);
    expect(units.at(-1)!.pauseAfter).toBe('none');
  });
});

describe('alignVoiceUnits', () => {
  it('cada oración va del inicio de su primera unidad al inicio de la siguiente', () => {
    const units = buildVoiceUnits(
      [
        sentence(0, 0, 'Uno.'),
        sentence(1, 0, 'Dos tres.', [
          { kind: 'dialogue', text: 'Dos' },
          { kind: 'narration', text: 'tres.' },
        ]),
        sentence(2, 1, 'Cuatro.'),
      ],
      100,
    );
    const alignment = alignVoiceUnits(units, [1000, 400, 600, 800]);
    expect(alignment).toEqual({
      version: 1,
      durationMs: 2800,
      approximate: false,
      sentences: [
        { index: 0, startMs: 0, endMs: 1000 },
        { index: 1, startMs: 1000, endMs: 2000 },
        { index: 2, startMs: 2000, endMs: 2800 },
      ],
    });
  });
});
