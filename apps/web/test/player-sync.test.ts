import { describe, expect, it } from 'vitest';
import {
  formatTime,
  generationEta,
  needsConfirmation,
  sentenceToTime,
  timeToSentence,
  type Alignment,
} from '../src/player/sync';

// La oración 2 no se narra (un DOI): no tiene entrada.
const alignment: Alignment = {
  version: 1,
  durationMs: 10_000,
  approximate: false,
  sentences: [
    { index: 0, startMs: 0, endMs: 2000 },
    { index: 1, startMs: 2400, endMs: 5000 },
    { index: 3, startMs: 5600, endMs: 9800 },
  ],
};

describe('sincronización audio ↔ texto', () => {
  it('lleva una oración a su tiempo, saltando las que no se narran', () => {
    expect(sentenceToTime(alignment, 1)).toBe(2400);
    expect(sentenceToTime(alignment, 2)).toBe(5600);
    expect(sentenceToTime(alignment, 9)).toBeNull();
  });

  it('encuentra la oración que suena con búsqueda binaria', () => {
    expect(timeToSentence(alignment, 0)).toBe(0);
    expect(timeToSentence(alignment, 2399)).toBe(0);
    expect(timeToSentence(alignment, 2400)).toBe(1);
    expect(timeToSentence(alignment, 9999)).toBe(3);
    expect(timeToSentence({ ...alignment, sentences: [] }, 100)).toBe(-1);
  });

  it('formatea tiempos y estimaciones', () => {
    expect(formatTime(65_000)).toBe('1:05');
    expect(formatTime(3_729_000)).toBe('1:02:09');
    expect(generationEta(1000)).toBe('5 s');
    expect(generationEta(60_000)).toBe('4 min');
  });

  it('confirma solo si el capítulo pasa del 5 % de la cuota', () => {
    expect(needsConfirmation(15_000, 300_000)).toBe(false);
    expect(needsConfirmation(15_001, 300_000)).toBe(true);
  });
});
