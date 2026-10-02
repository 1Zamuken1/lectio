import { describe, expect, it } from 'vitest';
import { companionLine } from '../src/library/companion-voice';
import { NOT_AN_EPUB } from '../src/library/book-messages';

describe('la voz del compañero', () => {
  it('el Scriptorium y el Clásico dicen el aviso tal cual', () => {
    for (const world of ['scriptorium', 'clasico'] as const) {
      expect(companionLine(world, '«Niebla». Buena elección.')).toEqual({
        text: '«Niebla». Buena elección.',
        mood: 'happy',
      });
    }
  });

  it('Lumen lo dice a su manera y conserva el título', () => {
    expect(companionLine('bosque', '«Niebla». Buena elección.').text).toBe(
      '¡Uy, «Niebla»! Tiene buena pinta. ¿Lo abrimos?',
    );
    expect(companionLine('bosque', '«Niebla». Cap. 3 de 12 · leyendo').text).toBe(
      '«Niebla»: cap. 3 de 12 · leyendo. ¡Sigamos!',
    );
  });

  it('los errores lo encogen y, sin frase propia, empiezan con "Ay…"', () => {
    expect(companionLine('bosque', NOT_AN_EPUB)).toEqual({
      text: 'Ay… eso no es un EPUB. Lectio guarda libros EPUB sin DRM.',
      mood: 'error',
    });
    expect(companionLine('scriptorium', NOT_AN_EPUB).mood).toBe('error');
  });

  it('Pol lo dice con datos y conserva el título', () => {
    expect(companionLine('solarpunk', '«Niebla». Buena elección.').text).toBe(
      'Analizando «Niebla»… resultado: excelente elección.',
    );
    expect(companionLine('solarpunk', '«Niebla». Cap. 3 de 12 · leyendo').text).toBe(
      '«Niebla» — dato: cap. 3 de 12 · leyendo. Sigamos.',
    );
  });

  it('los errores de Pol, sin frase propia, empiezan con "Error:"', () => {
    expect(companionLine('solarpunk', NOT_AN_EPUB)).toEqual({
      text: 'Error: eso no es un EPUB. Lectio guarda libros EPUB sin DRM.',
      mood: 'error',
    });
  });

  it('un aviso que no conoce pasa igual', () => {
    expect(companionLine('bosque', 'Algo nuevo.').text).toBe('Algo nuevo.');
  });
});
