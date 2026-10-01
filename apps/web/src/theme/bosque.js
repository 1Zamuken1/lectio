// Lectio · pixel art del Bosque élfico (docs/lectio-temas.md §7.5). Usa el mismo motor que
// el Scriptorium (pixel.js: canvas y la paleta en variables --px-*); aquí van solo los
// dibujos de este mundo. Cada pieza es la adaptación de una del Scriptorium.

import { Pixel } from './pixel';

/** Brote de enredadera: la perilla de la barra de progreso (en el Scriptorium, la pluma). */
const SPROUT = [
  '......ooo.',
  '.....olllo',
  '....ollLLo',
  '...ollLLo.',
  '...oLLLo..',
  '..ooLoo...',
  '..s.o..t..',
  '.s....t.t.',
  's......t..',
  's.........',
];

function sprout() {
  const c = Pixel.canvas();
  c.sprite(SPROUT, { o: 'leaf-d', l: 'leaf-l', L: 'leaf', s: 'leaf-d', t: 'leaf-l' }, 0, 0);
  return `<svg class="px-sprout" viewBox="0 0 10 10" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${c.svg()}</svg>`;
}

/**
 * Esquinero de la página (en el Scriptorium, la flor de lis): un filete de oro en escuadra
 * con una ramita de hojas. Está dibujado para la esquina de arriba a la izquierda; el CSS
 * lo refleja en las otras tres.
 */
const CORNER = [
  'ggggggggg',
  'gw.rr....',
  'g.rrlr...',
  'grrll.r..',
  'grl..rlr.',
  'g.r...r..',
  'grr......',
  'g.r......',
  'g........',
];

function corner() {
  const c = Pixel.canvas();
  c.sprite(CORNER, { g: 'gold', w: 'silver-l', r: 'leaf', l: 'leaf-l' }, 0, 0);
  return `<svg class="px-fleuron" viewBox="0 0 9 9" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${c.svg()}</svg>`;
}

export const Bosque = { sprout, corner };
