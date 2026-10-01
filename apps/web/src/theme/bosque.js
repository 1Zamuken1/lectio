// Lectio · las piezas SVG del Bosque élfico (docs/lectio-temas.md §7.5). Las escenas van
// en lienzo (bosque-scenes.js); aquí, lo chico que vive en la interfaz y cambia con la
// paleta de bosque.css: la luciérnaga de la barra de progreso y el pie del atril.

import { Pixel } from './pixel';

const { canvas } = Pixel;

/** La luciérnaga en la punta del hilo de luz (la perilla de la barra de progreso). */
const FIREFLY = ['..yyy..', '.yYYYy.', 'yYwwwYy', 'yYwwwYy', 'yYwwwYy', '.yYYYy.', '..yyy..'];

function firefly() {
  const c = canvas();
  c.sprite(FIREFLY, { y: 'firefly-l', Y: 'firefly', w: 'firefly-core' }, 0, 0);
  return `<svg class="px-firefly-thumb" viewBox="0 0 7 7" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${c.svg()}</svg>`;
}

/**
 * El pie del atril donde se abre la ficha del libro: un pedestal de madera clara sin
 * corteza, con el tablero inclinado, un anillo de oro y raíces que se abren al pie.
 */
function lecternStand() {
  const c = canvas();
  c.rect('wood-o', 0, 0, 96, 6);
  c.rect('wood-l', 1, 1, 94, 2);
  c.rect('wood-m', 1, 3, 94, 1);
  c.rect('gold', 1, 4, 94, 1);
  c.rect('wood-o', 40, 6, 16, 26);
  c.rect('wood-m', 41, 6, 14, 26);
  c.rect('wood-l', 42, 6, 3, 26);
  c.rect('wood-d', 52, 6, 3, 26);
  c.rect('gold', 41, 15, 14, 2);
  c.rect('gold-d', 41, 16, 14, 1);
  c.rect('leaf', 38, 11, 3, 2);
  c.rect('leaf-l', 55, 21, 3, 2);
  c.rect('wood-o', 22, 32, 52, 6);
  c.rect('wood-l', 23, 33, 50, 2);
  c.rect('wood-m', 23, 35, 50, 1);
  for (const [rx, rw] of [
    [14, 9],
    [73, 9],
  ]) {
    c.rect('wood-o', rx, 35, rw, 3);
    c.rect('wood-d', rx + 1, 36, rw - 2, 1);
  }
  return `<svg class="px-lectern" viewBox="0 0 96 38" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${c.svg()}</svg>`;
}

/**
 * Lumen, el espíritu de luz (el compañero del Bosque): una bolita de luz con carita y dos
 * hojitas como alas. Dos juegos de ojos (parpadea) y dos de alas (aletea): los alterna el
 * CSS, como al búho del Scriptorium.
 */
const LUMEN = {
  body: [
    '.....oooo.....',
    '...oolllloo...',
    '..olwwlllllo..',
    '.olwwlllllllo.',
    '.ollllllllllo.',
    null,
    null,
    '.ollllllllllo.',
    '.olcllllllclo.',
    '..ollmllmllo..',
    '...ollmmllo...',
    '....oooooo....',
  ],
  open: ['.ollellllello.', '.ollellllello.'],
  closed: ['.ollllllllllo.', '.olleelleello.'],
  wingsUp: ['gGG............GGg', '.gGG..........GGg.', '..gGg........gGg..', '...gg........gg...'],
  wingsDown: [
    '...gg........gg...',
    '..gGg........gGg..',
    '.gGG..........GGg.',
    'gGG............GGg',
  ],
};

function lumen() {
  const palette = {
    o: 'lumen-o',
    l: 'lumen',
    w: 'lumen-l',
    e: 'lumen-eye',
    c: 'lumen-cheek',
    m: 'lumen-eye',
  };
  const withEyes = (eyes) => LUMEN.body.map((row, i) => row ?? eyes[i - 5]);
  const open = canvas();
  open.sprite(withEyes(LUMEN.open), palette, 2, 1);
  const closed = canvas();
  closed.sprite(withEyes(LUMEN.closed), palette, 2, 1);
  const up = canvas();
  up.sprite(LUMEN.wingsUp, { g: 'leaf-l', G: 'leaf' }, 0, 1);
  const down = canvas();
  down.sprite(LUMEN.wingsDown, { g: 'leaf-l', G: 'leaf' }, 0, 5);
  return `<svg class="px-badge px-lumen" viewBox="0 0 18 13" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><g class="lumen-wings-up">${up.svg()}</g><g class="lumen-wings-down">${down.svg()}</g><g class="lumen-body"><g class="lumen-eyes-open">${open.svg()}</g><g class="lumen-eyes-closed">${closed.svg()}</g></g></svg>`;
}

export const Bosque = { firefly, lecternStand, lumen };
