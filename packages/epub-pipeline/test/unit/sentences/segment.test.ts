import { describe, expect, it } from 'vitest';
import { segmentSentences } from '../../../src/sentences/segment.js';

const split = (text: string, language = 'es', noteRanges: Array<[number, number]> = []) =>
  segmentSentences({ text, noteRanges }, language).map(([s, e]) => text.slice(s, e));

describe('segmentación en oraciones', () => {
  it('divide por puntos, respetando signos de apertura del español', () => {
    expect(split('Se puso el sol. ¿Vendrá mañana? ¡Ojalá!')).toEqual([
      'Se puso el sol.',
      '¿Vendrá mañana?',
      '¡Ojalá!',
    ]);
  });

  it('no corta tras abreviaturas', () => {
    expect(split('Llegó el Sr. García con la Dra. López. Ver pág. 12 y cap. 3.')).toEqual([
      'Llegó el Sr. García con la Dra. López.',
      'Ver pág. 12 y cap. 3.',
    ]);
    expect(split('Mr. Holmes met Dr. Watson in St. James. It rained.', 'en')).toEqual([
      'Mr. Holmes met Dr. Watson in St. James.',
      'It rained.',
    ]);
  });

  it('no corta tras iniciales', () => {
    expect(split('Lo escribió J. R. Jiménez. Fin.')).toEqual([
      'Lo escribió J. R. Jiménez.',
      'Fin.',
    ]);
  });

  it('una pregunta o exclamación seguida de minúscula continúa la oración', () => {
    expect(split('¡Qué horror! dijo ella. Nadie respondió.')).toEqual([
      '¡Qué horror! dijo ella.',
      'Nadie respondió.',
    ]);
    expect(split('"Why?" he asked. Silence.', 'en')).toEqual(['"Why?" he asked.', 'Silence.']);
  });

  it('mantiene juntas las acotaciones de diálogo con raya', () => {
    expect(split('—¿Esas tenemos? —dijo el viajero—. Vamos.')).toEqual([
      '—¿Esas tenemos? —dijo el viajero—.',
      'Vamos.',
    ]);
  });

  it('una llamada a nota pegada al punto no impide cortar', () => {
    const text = 'It is a truth.3 To clear my way.';
    const note = text.indexOf('3');

    expect(split(text, 'en', [[note, note + 1]])).toEqual(['It is a truth.', 'To clear my way.']);
  });

  it('los offsets no incluyen espacios en los bordes', () => {
    const text = '  Uno.   Dos.  ';
    const ranges = segmentSentences({ text, noteRanges: [] }, 'es');

    expect(ranges).toEqual([
      [2, 6],
      [9, 13],
    ]);
  });
});
