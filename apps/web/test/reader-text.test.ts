import { describe, expect, it } from 'vitest';
import {
  estimatedMinutes,
  firstSentenceByBlock,
  formatDuration,
  headingMatchesTitle,
  rangeFor,
  sentenceAtOffset,
  type Sentence,
} from '../src/reader/text';

const s = (index: number, blockIndex: number, start: number, end: number): Sentence => ({
  index,
  blockIndex,
  start,
  end,
  narrated: true,
});

describe('texto del lector', () => {
  it('estima minutos y los escribe en horas cuando pasan de 60', () => {
    expect(estimatedMinutes(100)).toBe(1);
    expect(estimatedMinutes(18_000)).toBe(20);
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(65)).toBe('1 h 5 min');
    expect(formatDuration(120)).toBe('2 h');
  });

  it('encuentra la primera oración de cada bloque, sin los bloques vacíos', () => {
    const map = firstSentenceByBlock([
      s(0, 0, 0, 10),
      s(1, 0, 11, 20),
      s(2, 2, 0, 5),
      s(3, -1, 0, 0),
    ]);
    expect([...map]).toEqual([
      [0, 0],
      [2, 2],
    ]);
  });

  it('elige la oración que contiene el offset, o la primera del bloque', () => {
    const sentences = [s(0, 0, 0, 10), s(1, 0, 11, 20), s(2, 1, 0, 5)];
    expect(sentenceAtOffset(sentences, 0, 15)?.index).toBe(1);
    expect(sentenceAtOffset(sentences, 0, 99)?.index).toBe(0);
    expect(sentenceAtOffset(sentences, 3, 0)).toBeNull();
  });

  it('compara encabezado y título por palabras completas', () => {
    expect(headingMatchesTitle('Capítulo I. El despertar', 'El despertar')).toBe(true);
    expect(headingMatchesTitle('A Vindication', 'I')).toBe(false);
    expect(headingMatchesTitle('', 'Algo')).toBe(false);
  });

  it('arma el rango de una oración que cruza etiquetas inline', () => {
    const block = document.createElement('p');
    block.innerHTML = 'Hola <em>mundo</em> entero. Otra.';
    const range = rangeFor(block, 5, 18);
    expect(range?.toString()).toBe('mundo entero.');
  });
});
