// Lectio · las piezas SVG del Solarpunk (docs/lectio-temas.md §7.8). Las escenas van en
// lienzo (solarpunk-scenes.js); aquí, lo chico que vive en la interfaz: Pol, el taller del
// jardín vertical, la cuadrilla de Cúpulas, el cortocircuito, las descargas a la cápsula,
// los libros de luz de la estantería holográfica y sus portadas. Se dibujan con el mismo
// motor que las escenas (máscaras con contorno de color) y se pasan a SVG.

import { Pixel } from './pixel';
import { Pix, clump, fillMask, hex, palette, rect, rr } from './solarpunk-scenes';

const { canvas } = Pixel;

const C = Object.fromEntries(
  Object.entries({
    line: '#3d5a78',
    lineD: '#2a4060',
    white: '#ffffff',
    whiteM: '#e6eef5',
    whiteD: '#bccfe0',
    metal: '#9fb2c4',
    metalD: '#6f8297',
    screen: '#16304c',
    screenL: '#24486c',
    eye: '#5ff0ff',
    eyeL: '#d4fbff',
    yellow: '#ffc83a',
    yellowD: '#e0961a',
    yellowL: '#ffe58a',
    leaf: '#5aa64a',
    leafL: '#86c957',
    leafD: '#2b5a3a',
    cyan: '#36c2e6',
    cyanL: '#a6ecfa',
    tread: '#4a5a6e',
    treadL: '#6f8297',
    blush: '#ff9a8a',
    rotor: '#c9e4f2',
    cell: '#3c6ea8',
    cellL: '#6b9dd2',
    gray: '#8a94a0',
    grayD: '#5a6470',
    smoke: '#c8d0d8',
    spark: '#fff3a0',
    ink: '#14324a',
  }).map(([k, v]) => [k, hex(v)]),
);

const tone = (h) => {
  if (typeof h !== 'string') return h;
  const c = hex(h);
  const mix = (t, k) => c.map((v, i) => Math.round(v * (1 - k) + t[i] * k));
  return { mid: c, light: mix([255, 255, 255], 0.4), dark: mix([20, 30, 60], 0.35) };
};

const disc = (cx, cy, r) => (x, y) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < r;
const ell = (cx, cy, rx, ry) => (x, y) =>
  Math.pow((x + 0.5 - cx) / rx, 2) + Math.pow((y + 0.5 - cy) / ry, 2) < 1;

// ------------------------------------------------------------ los robots del taller

/** Tuerca: orugas, cuerpo de caja con la placa del color de la voz y ojos de binocular. */
function tuerca(voice, frame = 0) {
  const v = tone(voice);
  const p = new Pix(22, 24);
  const b = frame % 2;
  // orugas
  fillMask(
    p,
    rr(2, 17, 19, 22, 2),
    [1, 16, 20, 23],
    (x, y) => (y === 18 ? C.treadL : C.tread),
    C.lineD,
  );
  for (let x = 4 + b; x < 18; x += 3) p.set(x, 20, C.treadL);
  // cuerpo
  fillMask(
    p,
    rr(4, 9, 17, 17, 1),
    [3, 8, 18, 18],
    (x) => (x < 7 ? C.white : x > 14 ? C.whiteD : C.whiteM),
    C.line,
  );
  rect(p, C.cell, 5, 8, 12, 1);
  rect(p, C.cellL, 6, 8, 2, 1);
  fillMask(p, rr(7, 11, 14, 15, 1), [6, 10, 15, 16], (x, y) => (y < 13 ? v.light : v.mid), v.dark);
  p.set(8, 12, C.white);
  // brazos
  rect(p, C.metalD, 2, 12, 2, 1);
  rect(p, C.metalD, 18, 12 - b, 2, 1);
  p.set(19, 11 - b, C.metalD);
  // cuello y ojos
  rect(p, C.metalD, 10, 5, 2, 4);
  for (const ex of [5, 11]) {
    fillMask(p, rr(ex, 1, ex + 5, 6, 2), [ex - 1, 0, ex + 6, 7], () => C.metal, C.line);
    p.set(ex + 2, 3, C.screen);
    p.set(ex + 3, 3, C.screen);
    p.set(ex + 2, 4, C.screen);
    p.set(ex + 3, 4, b && ex === 11 ? C.screen : C.eye);
    p.set(ex + 2, 3, C.eyeL);
  }
  return p;
}

/** Domo: cilindro con cúpula, un ojo grande y dos patas con ruedas (de la familia R2). */
function domo(voice, frame = 0) {
  const v = tone(voice);
  const p = new Pix(22, 24);
  const b = frame % 2;
  // patas
  for (const lx of [2, 17]) {
    fillMask(p, rr(lx, 10, lx + 3, 21, 1), [lx - 1, 9, lx + 4, 22], () => C.whiteM, C.line);
    rect(p, v.mid, lx + 1, 13, 2, 2);
    rect(p, C.tread, lx - 1, 21, 6, 2);
  }
  // cuerpo
  fillMask(
    p,
    (x, y) => x >= 5 && x <= 16 && y >= 9 && y <= 20,
    [4, 8, 17, 21],
    (x) => (x < 8 ? C.white : x > 14 ? C.whiteD : C.whiteM),
    C.line,
  );
  rect(p, v.mid, 6, 12, 10, 2);
  rect(p, v.light, 6, 12, 3, 1);
  rect(p, v.dark, 8, 16, 6, 1);
  rect(p, C.cyan, 13, 18, 2, 1);
  // cúpula
  fillMask(
    p,
    (x, y) => y <= 9 && ell(10.5, 9.5, 6.5, 7)(x, y),
    [3, 1, 18, 10],
    (x, y) => (x < 8 && y < 6 ? C.white : y > 7 ? C.metal : C.whiteM),
    C.line,
  );
  rect(p, v.mid, 6, 7, 10, 1);
  // ojo
  fillMask(p, disc(10.5 + (b ? 1 : 0), 5, 2.4), [6, 1, 15, 9], () => C.screen, C.lineD);
  p.set(10 + (b ? 1 : 0), 4, C.eyeL);
  p.set(11 + (b ? 1 : 0), 5, C.eye);
  p.set(14, 3, C.yellow);
  return p;
}

/** Gota: un huevo que flota, cara de pantalla y bracitos sueltos; su cinturón es la voz. */
function gota(voice, frame = 0) {
  const v = tone(voice);
  const p = new Pix(22, 24);
  const up = frame % 2 ? 0 : 1;
  // sombra en el piso
  for (let x = 6; x < 16; x++) p.set(x, 22, C.whiteD);
  for (let x = 8; x < 14; x++) p.set(x, 23, C.whiteD);
  fillMask(
    p,
    (x, y) => ell(11, 10 + up, 7, 9)(x, y),
    [3, 0, 19, 20],
    (x) => (x < 8 ? C.white : x > 15 ? C.whiteD : C.whiteM),
    C.line,
  );
  rect(p, v.mid, 5, 14 + up, 12, 2);
  rect(p, v.light, 6, 14 + up, 3, 1);
  fillMask(p, rr(6, 5 + up, 15, 11 + up, 3), [5, 4 + up, 16, 12 + up], () => C.screen, C.lineD);
  // ojos felices en arco
  for (const ex of [8, 12]) {
    p.set(ex, 8 + up, C.eye);
    p.set(ex + 1, 7 + up, C.eye);
    p.set(ex + 2, 8 + up, C.eye);
  }
  // bracitos
  fillMask(p, ell(2.5, 12 + up * 2, 1.6, 3), [0, 8, 5, 17], () => C.whiteM, C.line);
  fillMask(p, ell(19.5, 11, 1.6, 3), [17, 7, 22, 15], () => C.whiteM, C.line);
  p.set(11, 0 + up, C.cyan);
  return p;
}

function polEyes(p, cx, cy, gap, mood) {
  for (const ex of [cx - gap, cx + gap]) {
    if (mood === 'happy') {
      p.set(ex - 1, cy, C.eye);
      p.set(ex, cy - 1, C.eye);
      p.set(ex + 1, cy, C.eye);
    } else if (mood === 'tangled') {
      p.set(ex - 1, cy - 1, C.eye);
      p.set(ex + 1, cy + 1, C.eye);
      p.set(ex, cy, C.eye);
      p.set(ex + 1, cy - 1, C.eye);
      p.set(ex - 1, cy + 1, C.eye);
    } else {
      rect(p, C.eye, ex - 1, cy - 1, 2, 3);
      p.set(ex - 1, cy - 1, C.eyeL);
    }
  }
}

/** El brazo-regadera colgando debajo; enredado si algo falló, con gotas si está contento. */
function polCan(p, x, y, mood, frame) {
  if (mood === 'tangled') {
    for (const [dx, dy] of [
      [0, 0],
      [1, 1],
      [0, 2],
      [-1, 1],
      [-2, 2],
      [-1, 3],
      [1, 3],
      [2, 2],
    ])
      p.set(x + dx, y + dy, C.metalD);
    return;
  }
  rect(p, C.metalD, x, y, 1, 2);
  fillMask(
    p,
    rr(x - 3, y + 2, x + 2, y + 5, 1),
    [x - 4, y + 1, x + 3, y + 6],
    (X, Y) => (Y < y + 4 ? C.cyanL : C.cyan),
    C.lineD,
  );
  p.set(x + 3, y + 3, C.lineD);
  p.set(x + 4, y + 2, C.lineD);
  p.set(x + 5, y + 2, C.cyan);
  if (mood === 'happy' && frame % 2) {
    p.set(x + 6, y + 4, C.cyanL);
    p.set(x + 7, y + 6, C.cyanL);
  }
}

function leafSprout(p, x, y, frame) {
  const s = frame % 4 === 1 ? 1 : frame % 4 === 3 ? -1 : 0;
  p.set(x, y, C.leafD);
  p.set(x, y - 1, C.leafD);
  p.set(x - 1 + s, y - 2, C.leaf);
  p.set(x - 2 + s, y - 2, C.leafL);
  p.set(x + 1 + s, y - 3, C.leaf);
  p.set(x + 2 + s, y - 3, C.leafL);
  p.set(x + 2 + s, y - 4, C.leaf);
}

/** Pol peluche: una bolita amarilla con franjas blancas, visera con ojos grandes y alitas. */
function polPlush(frame = 0, mood = 'idle') {
  const p = new Pix(26, 28);
  const up = frame % 2;
  // alitas
  for (const [wx, dir] of [
    [6, -1],
    [19, 1],
  ])
    fillMask(
      p,
      ell(wx + dir * up, 6 - up, 4, 2.6 + up * 0.6),
      [wx - 6, 1, wx + 6, 10],
      () => C.rotor,
      C.metal,
    );
  const body = disc(13, 14, 9);
  fillMask(
    p,
    (x, y) =>
      body(x, y) ||
      ((x === 7 || x === 11 || x === 16) && y === 5) ||
      ((x === 9 || x === 18) && y === 6),
    [2, 3, 24, 24],
    (x, y) => {
      if (y === 18 || y === 19) return C.white;
      if (y === 7 || y === 8) return C.white;
      return x < 10 && y < 13 ? C.yellowL : y > 19 ? C.yellowD : C.yellow;
    },
    C.yellowD,
  );
  fillMask(
    p,
    rr(7, 10, 19, 16, 3),
    [6, 9, 20, 17],
    (x, y) => (y < 12 ? C.screenL : C.screen),
    C.lineD,
  );
  polEyes(p, 13, 13, 3, mood);
  p.set(6, 17, C.blush);
  p.set(20, 17, C.blush);
  leafSprout(p, 13, 4, frame);
  polCan(p, 13, 22, mood, frame);
  return p;
}

/** Pol cúpula: un platillo blanco con una cúpula de cristal y un brote adentro; dos hélices. */
function polDome(frame = 0, mood = 'idle', accent = null) {
  const A = accent ? tone(accent) : { mid: C.yellow, light: C.yellowL, dark: C.yellowD };
  const p = new Pix(30, 28);
  const w = frame % 2 ? 5 : 3;
  for (const hx of [4, 25]) {
    for (let k = -w; k <= w; k++) p.set(hx + k, 12, Math.abs(k) === w ? C.metal : C.rotor);
    rect(p, C.metalD, hx, 13, 1, 3);
  }
  rect(p, C.metalD, 4, 16, 6, 1);
  rect(p, C.metalD, 20, 16, 6, 1);
  // la cúpula
  fillMask(
    p,
    (x, y) => y <= 14 && ell(15, 14.5, 7.5, 9)(x, y),
    [6, 4, 24, 15],
    (x, y) => (x < 11 && y < 10 ? C.white : C.cyanL),
    C.line,
  );
  p.set(11, 8, C.white);
  p.set(10, 9, C.white);
  // el brote adentro
  for (let y = 9; y <= 14; y++) p.set(15, y, C.leafD);
  const s = frame % 4 === 1 ? 1 : 0;
  for (const [x, y, c] of [
    [13 + s, 9, C.leaf],
    [12 + s, 8, C.leafL],
    [13 + s, 8, C.leaf],
    [17 + s, 10, C.leaf],
    [18 + s, 9, C.leafL],
    [17 + s, 9, C.leaf],
  ])
    p.set(x, y, c);
  // el platillo con la cara
  fillMask(
    p,
    ell(15, 18, 11, 5),
    [3, 12, 27, 24],
    (x, y) => (y < 16 ? C.white : y > 20 ? C.whiteD : C.whiteM),
    C.line,
  );
  rect(p, A.mid, 6, 21, 18, 1);
  if (accent) rect(p, A.light, 7, 20, 16, 1);
  fillMask(p, rr(9, 15, 21, 20, 2), [8, 14, 22, 21], () => C.screen, C.lineD);
  polEyes(p, 15, 17, 3, mood);
  polCan(p, 15, 23, mood, frame);
  return p;
}

/** Pol gota alada: una gota blanca con punta de hoja, cara de pantalla y alas de hoja. */
function polDrop(frame = 0, mood = 'idle', accent = null) {
  const A = accent ? tone(accent) : { mid: C.yellow, light: C.yellowL, dark: C.yellowD };
  const p = new Pix(28, 30);
  const flap = frame % 2;
  // alas de hoja
  for (const [wx, dir] of [
    [5, -1],
    [22, 1],
  ]) {
    const wy = 13 - flap * 2;
    fillMask(
      p,
      (x, y) => {
        const u = (x + 0.5 - wx) * dir;
        const v = y + 0.5 - wy + u * 0.35 * (flap ? 1 : -0.2);
        return u > -4 && u < 4 && Math.abs(v) < 2.6 * Math.cos((u / 4) * 1.4);
      },
      [wx - 5, wy - 5, wx + 5, wy + 5],
      (x, y) => (y < wy ? C.leafL : C.leaf),
      C.leafD,
    );
  }
  const body = (x, y) => {
    if (y >= 13) return ell(14, 17, 8, 9)(x, y);
    return y >= 3 && Math.abs(x + 0.5 - 14) < (y - 2) * 0.75 + 0.3;
  };
  fillMask(
    p,
    body,
    [4, 2, 24, 27],
    (x, y) => (x < 11 && y < 18 ? C.white : y > 22 ? C.whiteD : C.whiteM),
    C.line,
  );
  p.set(14, 2, C.leaf);
  p.set(14, 1, C.leafL);
  p.set(15, 0, C.leafL);
  rect(p, A.mid, 7, 22, 15, 1);
  if (accent) rect(p, A.light, 7, 21, 15, 1);
  fillMask(
    p,
    rr(9, 12, 19, 18, 3),
    [8, 11, 20, 19],
    (x, y) => (y < 14 ? C.screenL : C.screen),
    C.lineD,
  );
  polEyes(p, 14, 15, 3, mood);
  p.set(8, 19, C.blush);
  p.set(20, 19, C.blush);
  polCan(p, 14, 26, mood, frame);
  return p;
}

/** Brote: una maceta con patas y cara; la planta de la cabeza se mece. */
function brote(color, frame = 0) {
  const v = tone(color);
  const p = new Pix(22, 24);
  const b = frame % 2;
  rect(p, C.tread, 7, 22, 3, 2);
  rect(p, C.tread, 12, 22, 3, 2);
  fillMask(
    p,
    (x, y) => y >= 10 && y <= 21 && Math.abs(x + 0.5 - 11) < 6.5 - (y - 10) * 0.18,
    [3, 9, 19, 22],
    (x, y) => (y < 12 ? C.white : x < 8 ? v.light : x > 14 ? v.dark : v.mid),
    C.line,
  );
  rect(p, C.line, 4, 12, 15, 1);
  fillMask(p, rr(7, 14, 15, 17, 1), [6, 13, 16, 18], () => C.screen, C.lineD);
  p.set(9, 15, C.eye);
  p.set(9, 16, C.eye);
  p.set(13, 15, C.eye);
  p.set(13, 16, C.eye);
  rect(p, C.metalD, 2, 15 - b, 2, 1);
  rect(p, C.metalD, 18, 15 + b - 1, 2, 1);
  // la planta
  const s = b ? 1 : 0;
  for (let y = 4; y <= 9; y++) p.set(11, y, C.leafD);
  fillMask(p, ell(8 + s, 5, 3, 1.8), [4, 2, 12, 8], () => C.leaf, C.leafD);
  fillMask(p, ell(14 + s, 3, 3, 1.8), [10, 0, 18, 6], () => C.leafL, C.leafD);
  p.set(11, 3, C.yellow);
  return p;
}

// ------------------------------------------------------------ libros de luz y portadas

const EMBLEMS = {
  dot: [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  diamond: [
    [0, -1],
    [-1, 0],
    [1, 0],
    [0, 1],
    [0, 0],
  ],
  star: [
    [0, -2],
    [0, -1],
    [-2, 0],
    [-1, 0],
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 1],
    [0, 2],
  ],
  leaf: [
    [1, -2],
    [0, -1],
    [1, -1],
    [-1, 0],
    [0, 0],
    [-1, 1],
  ],
  sun: [
    [0, -2],
    [-2, 0],
    [2, 0],
    [0, 2],
    [0, 0],
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ],
};
const EMBLEM_NAMES = Object.keys(EMBLEMS);

/**
 * Un libro de luz (la ranura de la estantería holográfica): un cartucho de cristal del
 * color del libro, con tapa metálica, dos bandas, un emblema y un brillo a la izquierda.
 * `lit` lo dibuja encendido (al pasar el cursor).
 */
function lightBook(color, emblem = 'dot', lit = false) {
  const p = new Pix(12, 18);
  const v = tone(color);
  fillMask(
    p,
    rr(1, 1, 10, 17, 2),
    [0, 0, 11, 18],
    (x, y) => {
      if (y <= 3) return y === 1 ? C.white : lit ? C.yellowL : C.metal;
      if (x <= 2) return lit ? C.white : v.light;
      if (x === 3 && lit) return v.light;
      if (x >= 9) return v.dark;
      return v.mid;
    },
    lit ? C.yellowD : v.dark,
  );
  rect(p, C.metalD, 2, 4, 8, 1);
  for (const by of [6, 14]) {
    rect(p, lit ? C.yellowL : C.yellow, 3, by, 6, 1);
  }
  for (const [dx, dy] of EMBLEMS[emblem]) p.set(6 + dx, 10 + dy, lit ? C.yellowL : C.white);
  if (lit) {
    p.set(3, 8, C.white);
    p.set(3, 12, C.white);
  }
  return p;
}

/** Las portadas prediseñadas: cada una un motivo sobre el color del libro. */
const COVERS = {
  amanecer(p, v, W0, H0) {
    for (let y = 6; y < H0 - 4; y++)
      for (let x = 3; x < W0 - 3; x++) p.set(x, y, y < 14 ? C.yellowL : y < 26 ? v.light : v.mid);
    for (let y = -8; y <= 0; y++)
      for (let x = -8; x <= 8; x++) if (x * x + y * y < 56) p.set(16 + x, 26 + y, C.yellow);
    for (let a = 0; a < 7; a++) {
      const ang = Math.PI + (a * Math.PI) / 6;
      for (let r = 10; r < 13; r++)
        p.set(16 + Math.round(Math.cos(ang) * r), 26 + Math.round(Math.sin(ang) * r), C.yellowL);
    }
    for (const y of [29, 32, 35])
      for (let x = 5 + (y - 29); x < W0 - 5 - (y - 29); x += 2) p.set(x, y, v.light);
  },
  ola(p, v, W0, H0) {
    for (let y = 6; y < H0 - 4; y++)
      for (let x = 3; x < W0 - 3; x++) {
        const w = Math.sin(x / 3 + Math.floor(y / 6)) * 1.5;
        const band = Math.floor((y + w) / 5) % 3;
        p.set(x, y, band === 0 ? v.light : band === 1 ? v.mid : C.cyanL);
      }
    for (let y = 8; y < 14; y++)
      for (let x = 20; x < 26; x++) if ((x - 23) ** 2 + (y - 11) ** 2 < 9) p.set(x, y, C.white);
  },
  luna(p, v, W0, H0) {
    for (let y = 6; y < H0 - 4; y++) for (let x = 3; x < W0 - 3; x++) p.set(x, y, v.dark);
    for (let y = -7; y <= 7; y++)
      for (let x = -7; x <= 7; x++)
        if (x * x + y * y < 49 && (x - 3) ** 2 + (y + 2) ** 2 >= 30)
          p.set(15 + x, 20 + y, C.yellowL);
    for (const [x, y] of [
      [6, 9],
      [24, 11],
      [9, 30],
      [26, 26],
      [20, 34],
      [7, 20],
      [27, 17],
    ]) {
      p.set(x, y, C.white);
      if ((x + y) % 3 === 0) {
        p.set(x + 1, y, C.eyeL);
        p.set(x - 1, y, C.eyeL);
        p.set(x, y + 1, C.eyeL);
        p.set(x, y - 1, C.eyeL);
      }
    }
  },
  arbol(p, v, W0, H0) {
    for (let y = 6; y < H0 - 4; y++)
      for (let x = 3; x < W0 - 3; x++) p.set(x, y, y > 34 ? v.dark : v.light);
    for (let y = 22; y < 35; y++) {
      p.set(15, y, C.leafD);
      p.set(16, y, C.leafD);
    }
    for (let y = -9; y <= 9; y++)
      for (let x = -11; x <= 11; x++) {
        const d = (x / 11) ** 2 + (y / 9) ** 2;
        if (d < 1) p.set(16 + x, 17 + y, d > 0.8 ? C.leafD : (x + y) % 5 === 0 ? C.leafL : C.leaf);
      }
    for (const [x, y] of [
      [11, 14],
      [20, 12],
      [17, 20],
      [9, 19],
      [23, 18],
    ])
      p.set(x, y, C.yellow);
  },
  flor(p, v, W0, H0) {
    for (let y = 6; y < H0 - 4; y++)
      for (let x = 3; x < W0 - 3; x++) p.set(x, y, (x + y) % 6 === 0 ? v.mid : v.light);
    for (let y = 22; y < H0 - 6; y++) p.set(16, y, C.leafD);
    for (const [x, y] of [
      [13, 30],
      [12, 29],
      [19, 27],
      [20, 26],
    ])
      p.set(x, y, C.leaf);
    for (let a = 0; a < 8; a++) {
      const ang = (a * Math.PI) / 4;
      for (let r = 3; r <= 7; r++) {
        const x = 16 + Math.round(Math.cos(ang) * r);
        const y = 17 + Math.round(Math.sin(ang) * r);
        p.set(x, y, r > 6 ? v.dark : C.white);
        p.set(x + 1, y, r > 6 ? v.dark : C.white);
      }
    }
    for (let y = -2; y <= 2; y++)
      for (let x = -2; x <= 2; x++) if (x * x + y * y < 6) p.set(16 + x, 17 + y, C.yellow);
  },
  rombos(p, v, W0, H0) {
    for (let y = 6; y < H0 - 4; y++)
      for (let x = 3; x < W0 - 3; x++) {
        const d = Math.abs(((x + 2) % 8) - 4) + Math.abs(((y - 6) % 8) - 4);
        p.set(x, y, d < 2 ? C.yellow : d < 4 ? v.light : v.mid);
      }
  },
  pluma(p, v, W0, H0) {
    for (let y = 6; y < H0 - 4; y++) for (let x = 3; x < W0 - 3; x++) p.set(x, y, v.light);
    for (let k = 0; k < 26; k++) {
      const x = 8 + Math.round(k * 0.62);
      const y = 34 - k;
      p.set(x, y, v.dark);
      const w = Math.round(Math.sin((k / 26) * Math.PI) * 4);
      for (let j = 1; j <= w; j++) {
        p.set(x + j, y - Math.round(j * 0.4), C.white);
        p.set(x - j, y + Math.round(j * 0.4), j === w ? v.dark : C.whiteM);
      }
    }
    for (let x = 6; x < 12; x++) p.set(x, 36, v.dark);
  },
  montanas(p, v, W0, H0) {
    for (let y = 6; y < H0 - 4; y++)
      for (let x = 3; x < W0 - 3; x++) p.set(x, y, y < 20 ? C.cyanL : v.light);
    const peak = (cx, top, w) => {
      for (let y = top; y < H0 - 4; y++)
        for (let x = cx - (y - top) * w; x <= cx + (y - top) * w; x++)
          if (x >= 3 && x < W0 - 3)
            p.set(Math.round(x), y, y < top + 4 ? C.white : x < cx ? v.mid : v.dark);
    };
    peak(11, 16, 0.9);
    peak(22, 12, 0.8);
    for (let y = 7; y < 12; y++)
      for (let x = 6; x < 11; x++) if ((x - 8) ** 2 + (y - 9) ** 2 < 6) p.set(x, y, C.yellow);
  },
  velero(p, v, W0, H0) {
    for (let y = 6; y < H0 - 4; y++)
      for (let x = 3; x < W0 - 3; x++)
        p.set(x, y, y > 30 ? (y % 3 === 0 ? C.cyanL : C.cyan) : v.light);
    for (let y = 10; y < 30; y++) p.set(16, y, v.dark);
    for (let y = 11; y < 28; y++)
      for (let x = 17; x < 17 + (y - 10) * 0.55; x++) p.set(x, y, C.white);
    for (let y = 15; y < 28; y++)
      for (let x = 15 - (y - 14) * 0.4; x < 16; x++) p.set(Math.round(x), y, C.yellowL);
    for (let x = 9; x < 24; x++) p.set(x, 30, v.dark);
    for (let x = 10; x < 23; x++) p.set(x, 31, v.dark);
  },
  estrella(p, v, W0, H0) {
    for (let y = 6; y < H0 - 4; y++) for (let x = 3; x < W0 - 3; x++) p.set(x, y, v.mid);
    for (let a = 0; a < 16; a++) {
      const ang = (a * Math.PI) / 8;
      const len = a % 2 ? 6 : 11;
      for (let r = 0; r <= len; r++)
        p.set(
          16 + Math.round(Math.cos(ang) * r),
          21 + Math.round(Math.sin(ang) * r),
          r > len - 2 ? C.yellowD : C.yellow,
        );
    }
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) p.set(16 + x, 21 + y, C.yellowL);
  },
};
const COVER_NAMES = Object.keys(COVERS);

/** Una portada (32×44): marco, lomo a la izquierda, el motivo y una placa para el título. */
function cover(design, color) {
  const W0 = 32;
  const H0 = 44;
  const p = new Pix(W0, H0);
  const v = tone(color);
  fillMask(p, rr(0, 0, W0 - 1, H0 - 1, 2), [0, 0, W0, H0], () => v.mid, v.dark);
  COVERS[design](p, v, W0, H0);
  // marco fino y placa del título
  for (let x = 2; x < W0 - 2; x++) {
    p.set(x, 2, C.yellow);
    p.set(x, H0 - 3, C.yellow);
  }
  for (let y = 2; y < H0 - 2; y++) {
    p.set(2, y, C.yellow);
    p.set(W0 - 3, y, C.yellow);
  }
  rect(p, v.dark, 0, 0, 2, H0);
  rect(p, v.light, 1, 1, 1, H0 - 2);
  return p;
}

// ------------------------------------------------------------ de píxeles a SVG

/**
 * Colores "de mentira" que en el SVG se vuelven variables de CSS: el color de cada libro
 * (lo pone la estantería) y el de la voz (lo pone data-voice). Así un mismo SVG sirve para
 * todos los libros y todas las voces.
 */
const BOOK = { mid: [1, 2, 3], light: [4, 5, 6], dark: [7, 8, 9] };
const VOICE = { mid: [10, 11, 12], light: [13, 14, 15], dark: [16, 17, 18] };
const TOKENS = new Map([
  ['1,2,3', 'book'],
  ['4,5,6', 'book-l'],
  ['7,8,9', 'book-d'],
  ['10,11,12', 'voice'],
  ['13,14,15', 'voice-l'],
  ['16,17,18', 'voice-d'],
]);

/**
 * Un Pix como SVG: un <path> por color, con corridas horizontales. Los colores de `tokens`
 * (clave "r,g,b") salen como `var(--px-…)`; los demás, tal cual.
 */
function svgOf(pix, ox = 0, oy = 0, tokens = TOKENS) {
  const byColor = new Map();
  const add = (key, x, y, w) => {
    if (!byColor.has(key)) byColor.set(key, []);
    byColor.get(key).push(`M${x + ox} ${y + oy}h${w}v1h-${w}z`);
  };
  for (let y = 0; y < pix.h; y++) {
    let run = null;
    for (let x = 0; x <= pix.w; x++) {
      const i = (y * pix.w + x) * 4;
      const key = x < pix.w && pix.d[i + 3] ? `${pix.d[i]},${pix.d[i + 1]},${pix.d[i + 2]}` : null;
      if (run && key !== run.key) {
        add(run.key, run.start, y, x - run.start);
        run = null;
      }
      if (key && !run) run = { key, start: x };
    }
  }
  return [...byColor]
    .map(([key, parts]) => {
      const token = tokens.get(key);
      return `<path d="${parts.join('')}" ${token ? `style="fill:var(--px-${token})"` : `fill="rgb(${key})"`}/>`;
    })
    .join('');
}

const svg = (className, w, h, body, attrs = '') =>
  `<svg class="${className}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" aria-hidden="true" focusable="false"${attrs}>${body}</svg>`;

/** Copia un sprite dentro de otro Pix (sin los píxeles transparentes). */
function blit(dst, src, x0, y0) {
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      if (src.d[i + 3]) dst.set(x0 + x, y0 + y, [src.d[i], src.d[i + 1], src.d[i + 2]]);
    }
}

/** Colores de cuerpo para el sorteo de los robots (el color de la voz va en las flores). */
const BODY_COLORS = [
  '#f0785a',
  '#4fb6dc',
  '#5ac48a',
  '#9a7ae0',
  '#ffb020',
  '#e86a9a',
  '#7ac943',
  '#2fbfb0',
];

/** `n` colores al azar sin repetir: cada vez que aparece el taller, otro reparto. */
function drawColors(n) {
  const pool = [...BODY_COLORS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

// ------------------------------------------------------------ piezas de la interfaz

/** Pol en miniatura: la perilla del riel de luz (9 × 8). */
const MINI_POL = [
  '.c.....c.',
  'ccc.l.ccc',
  '.yyyyyyy.',
  'ywwwwwwwy',
  'ysesssesy',
  'ysssssssy',
  '.yyyyyyy.',
  '..ddddd..',
];

function progressThumb() {
  const c = canvas();
  c.sprite(
    MINI_POL,
    {
      c: 'pol-wing',
      l: 'pol-leaf',
      y: 'pol',
      w: 'pol-l',
      s: 'pol-screen',
      e: 'pol-eye',
      d: 'pol-d',
    },
    0,
    0,
  );
  return svg('px-pol-thumb', 9, 8, c.svg());
}

/**
 * El pie del atril: un pedestal blanco de líneas suaves con su franja de luz, sobre una
 * base redonda (96 × 38, como los de los otros mundos). Blanco cerámico con tokens para la noche.
 */
function lecternStand() {
  const c = canvas();
  c.rect('sp-line', 0, 0, 96, 6);
  c.rect('sp-white', 1, 1, 94, 3);
  c.rect('sp-white-l', 1, 1, 94, 1);
  c.rect('sp-cyan', 2, 4, 92, 1);
  c.rect('sp-line', 41, 6, 14, 26);
  c.rect('sp-white', 42, 6, 12, 26);
  c.rect('sp-white-l', 42, 6, 3, 26);
  c.rect('sp-white-d', 51, 6, 3, 26);
  c.rect('sp-cyan', 47, 9, 2, 20);
  c.rect('sp-sun', 42, 30, 12, 1);
  c.rect('sp-line', 18, 32, 60, 6);
  c.rect('sp-white', 19, 33, 58, 4);
  c.rect('sp-white-l', 19, 33, 58, 1);
  c.rect('sp-cyan', 22, 36, 52, 1);
  return svg('px-lectern', 96, 38, c.svg());
}

/**
 * Pol, el dron jardinero (el compañero): la bolita amarilla con franjas blancas, visera de
 * ojos grandes, alitas de abeja, el brote y la regadera. Dos cuadros (aletea) y su cara de
 * enredado (ante un error): los alterna el CSS.
 */
function pol() {
  return svg(
    'px-badge px-pol',
    26,
    28,
    `<g class="pol-f0">${svgOf(polPlush(0, 'idle'))}</g><g class="pol-f1">${svgOf(polPlush(1, 'idle'))}</g><g class="pol-sad">${svgOf(polPlush(0, 'tangled'))}</g>`,
  );
}

// ------------------------------------------------------------ el taller del jardín vertical
//
// Mientras se genera una voz, los robots plantan un muro verde: las macetas se llenan fila
// a fila, de abajo hacia arriba, con el avance real, y cada una florece del color de la voz.
// Tuerca trae plantines, Cúpula siembra desde el aire, Alada riega desde arriba, Gota poda,
// Domo riega abajo y Brote duerme cargándose; Pol supervisa. Al terminar, dos Cúpulas se
// llevan una jardinera en flor a la terraza y suena el carillón. Las mismas clases y tiempos
// que los otros talleres (.ws-*); los colores de los robots salen al azar en cada aparición.

const GW = 200;
const GH = 48;
const GROUND = 46;
const WALL = { x0: 46, x1: 154, y0: 2, y1: 44 };
const POT_COLS = 9;
const POT_ROWS = 3;
const potX = (i) => 50 + i * 11.6;
const potY = (j) => 4 + j * 14;

/** Un actor con sus poses (a, b y el festejo): las alterna el CSS del taller. */
function actor(frames, x, y, { className = '', style = '' } = {}) {
  const [a, b, cheer] = frames;
  return `<g class="ws-actor ${className}" style="${style}"><g class="ws-a">${svgOf(a, x, y)}</g><g class="ws-b">${svgOf(b ?? a, x, y)}</g><g class="ws-cheer">${svgOf(cheer ?? a, x, y - 2)}</g></g>`;
}

function gardenWorkshop(voice) {
  const id = `sg${++gardenCount}`;
  const pal = palette('day');
  const [cTuerca, cDomo, cGota, cBrote, cCupula, cAlada, cCarry] = drawColors(7);
  // El bastidor del muro con sus macetas vacías, y el piso.
  const set = new Pix(GW, GH);
  rect(set, C.lineD, 0, GROUND, GW, 2);
  rect(set, C.whiteD, 0, GROUND, GW, 1);
  fillMask(
    set,
    rr(WALL.x0, WALL.y0, WALL.x1, WALL.y1, 3),
    [WALL.x0 - 1, WALL.y0 - 1, WALL.x1 + 1, WALL.y1 + 1],
    () => C.whiteM,
    C.line,
  );
  rect(set, C.cyan, WALL.x0 + 2, WALL.y1 - 2, WALL.x1 - WALL.x0 - 3, 1);
  for (let j = 0; j < POT_ROWS; j++)
    for (let i = 0; i < POT_COLS; i++) {
      const x = Math.round(potX(i));
      const y = potY(j);
      rect(set, C.line, x, y + 9, 10, 4);
      rect(set, C.yellow, x + 1, y + 10, 8, 1);
    }
  // El carillón colgado, a la derecha.
  const bell = new Pix(GW, GH);
  rect(bell, C.metalD, 194, 0, 1, 4);
  for (const [dx, h] of [
    [-2, 6],
    [0, 8],
    [2, 5],
  ])
    rect(bell, C.cyanL, 194 + dx, 4, 1, h);
  rect(bell, C.metal, 191, 3, 7, 1);
  // Las plantas, cada una con su flor del color de la voz; la página las descubre por filas.
  const plants = new Pix(GW, GH);
  const clips = [];
  for (let j = 0; j < POT_ROWS; j++) {
    for (let i = 0; i < POT_COLS; i++) {
      const x = potX(i);
      const y = potY(j);
      clump(plants, pal.leaf, x + 5, y + 5, 4.6, { detail: 0 });
      const idx = (POT_ROWS - 1 - j) * POT_COLS + i;
      const fx = Math.round(x) + 3 + ((idx * 3) % 4);
      const fy = y + 2 + ((idx * 5) % 3);
      for (const [dx, dy] of [
        [2, 0],
        [-2, 0],
        [0, 2],
        [0, -2],
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ])
        plants.set(fx + dx, fy + dy, C.white);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        plants.set(fx + dx, fy + dy, VOICE.mid);
      plants.set(fx, fy, C.yellow);
    }
  }
  // Las filas se descubren de abajo hacia arriba (Workshop.tsx ajusta su ancho).
  for (let k = 0; k < POT_ROWS; k++) {
    const j = POT_ROWS - 1 - k;
    clips.push(
      `<rect class="ws-row" data-from="${WALL.x0}" data-to="${WALL.x1}" x="${WALL.x0}" y="${potY(j) - 2}" width="0" height="13"/>`,
    );
  }
  // Tuerca trae un plantín, de ida y vuelta.
  const seedling = (p) => {
    clump(p, pal.leaf, 19, 6, 3, { detail: 0 });
    return p;
  };
  const tuercaA = seedling(tuerca(cTuerca, 0));
  const tuercaB = seedling(tuerca(cTuerca, 1));
  const cupA = polDome(0, 'idle', cCupula);
  const cupB = polDome(1, 'idle', cCupula);
  const alaA = polDrop(0, 'idle', cAlada);
  const alaB = polDrop(1, 'idle', cAlada);
  const crew = [
    `<g class="ws-walker" style="--dist:16px;--dur:6s">${actor([tuercaA, tuercaB], 6, GROUND - 24, { className: 'ws-toggle ws-jump', style: '--dur:0.4s' })}</g>`,
    actor([cupA, cupB], 30, -4, { className: 'ws-toggle ws-jump', style: '--dur:0.3s' }),
    actor([alaA, alaB], 82, -6, {
      className: 'ws-toggle ws-jump',
      style: '--dur:0.35s;animation-delay:-0.1s',
    }),
    actor([gota(cGota, 0), gota(cGota, 1)], 122, 6, {
      className: 'ws-toggle ws-jump',
      style: '--dur:0.6s',
    }),
    actor([domo(cDomo, 0), domo(cDomo, 1)], 154, GROUND - 24, {
      className: 'ws-toggle ws-jump',
      style: '--dur:0.5s',
    }),
    actor([brote(cBrote, 0), brote(cBrote, 0), brote(cBrote, 1)], 176, GROUND - 24, {
      className: 'ws-sleeper',
    }),
    actor([polPlush(0, 'idle'), polPlush(1, 'idle'), polPlush(1, 'happy')], 2, -6, {
      className: 'ws-toggle ws-master',
      style: '--dur:0.3s',
    }),
  ];
  const zzz = `<g class="ws-zzz" style="fill:var(--px-sp-line)"><path d="M193 22h2v1h-2zM194 21h1v1h-1z"/><path d="M196 18h2v1h-2zM197 17h1v1h-1z"/></g>`;
  // Al terminar: dos Cúpulas se llevan una jardinera en flor.
  const planter = new Pix(40, 34);
  blit(planter, polDome(0, 'happy', cCarry), 0, 0);
  blit(planter, polDome(1, 'happy', cCupula), 14, 0);
  for (let y = 24; y < 28; y++) {
    planter.set(15, y, C.metalD);
    planter.set(29, y, C.metalD);
  }
  fillMask(
    planter,
    rr(10, 28, 34, 33, 1),
    [9, 27, 35, 34],
    (x, y) => (y < 30 ? C.white : C.whiteM),
    C.line,
  );
  rect(planter, C.yellow, 11, 31, 23, 1);
  for (let x = 12; x < 33; x += 4) clump(planter, pal.leaf, x, 26, 3, { detail: 0 });
  for (let x = 13; x < 33; x += 5) {
    planter.set(x, 24, VOICE.mid);
    planter.set(x + 1, 24, C.yellow);
  }
  return svg(
    'px-workshop px-garden',
    GW,
    GH,
    `<defs><clipPath id="${id}-grow">${clips.join('')}</clipPath></defs>
    ${svgOf(set)}<g class="ws-bell">${svgOf(bell)}</g>
    <g class="ws-sheet" clip-path="url(#${id}-grow)">${svgOf(plants)}</g>
    ${crew.join('')}${zzz}
    <g class="ws-carrier" style="--to:120px"><g class="ws-a">${svgOf(planter, 70, 10)}</g></g>`,
    ` data-voice="${voice}"`,
  );
}
let gardenCount = 0;

// ------------------------------------------------------------ la cuadrilla y el libro en cortocircuito
//
// Al subir un libro, dos Cúpulas en miniatura lo traen volando, colgado de dos cables, hasta
// su hueco (el segundo se bambolea: .crew-tripper). Las mismas medidas que la cuadrilla del
// Scriptorium (48 × 24) para que BookCrew.tsx la lleve igual. Al fallar, el lomo hace
// cortocircuito: chispas (los cuadros .px-fire-*, como las llamas), humito y se reinicia.

/** Una Cúpula en miniatura (14 × 10): platillo, cúpula con brote y dos hélices. */
function miniCupula(color, frame) {
  const v = tone(color);
  const p = new Pix(14, 10);
  const w = frame % 2 ? 2 : 1;
  for (const hx of [1, 12]) for (let k = -w; k <= w; k++) p.set(hx + k, 3, C.rotor);
  fillMask(
    p,
    (x, y) => y <= 4 && ell(7, 4.6, 3.6, 4)(x, y),
    [3, 0, 11, 5],
    () => C.cyanL,
    C.line,
  );
  p.set(7, 2, C.leaf);
  p.set(6, 3, C.leafL);
  p.set(8, 3, C.leaf);
  fillMask(p, ell(7, 6, 6.4, 2.6), [0, 3, 14, 9], (x, y) => (y < 6 ? C.white : C.whiteM), C.line);
  rect(p, C.screen, 4, 5, 6, 2);
  p.set(5, 5, C.eye);
  p.set(8, 5, C.eye);
  rect(p, v.mid, 2, 8, 10, 1);
  return p;
}

function bookCrew() {
  const [c1, c2] = drawColors(2);
  const book = new Pix(48, 24);
  fillMask(
    book,
    rr(11, 14, 47, 21, 1),
    [10, 13, 48, 22],
    (x, y) => (y < 16 ? hex('#86c957') : hex('#5aa64a')),
    C.leafD,
  );
  rect(book, C.white, 12, 20, 35, 1);
  rect(book, C.yellow, 13, 15, 1, 5);
  rect(book, C.yellow, 44, 15, 1, 5);
  for (let y = -2; y <= 2; y++)
    for (let x = -2; x <= 2; x++) if (x * x + y * y <= 5) book.set(29 + x, 17 + y, C.yellow);
  const cable = new Pix(48, 24);
  for (let y = 9; y < 14; y++) {
    cable.set(16, y, C.metalD);
    cable.set(42, y, C.metalD);
  }
  const first = actor([miniCupula(c1, 0), miniCupula(c1, 1)], 9, 0, {
    className: 'ws-toggle',
    style: '--dur:0.3s',
  });
  const second = actor([miniCupula(c2, 0), miniCupula(c2, 1)], 35, 0, {
    className: 'ws-toggle',
    style: '--dur:0.3s;animation-delay:-0.15s',
  });
  return svg(
    'px-workshop px-crew',
    48,
    24,
    `<g class="crew-load"><g class="crew-book">${svgOf(book)}${svgOf(cable)}</g>${first}<g class="crew-tripper">${second}</g></g>`,
    ' data-voice="gonzalo"',
  );
}

/** El cortocircuito: chispas amarillas y celestes en tres cuadros (como las llamas). */
function shortCircuit() {
  const FRAMES = [
    ['..y....c..', '.yw...cw..', 'y..c.y...c', '.c..yw.c..', '..y...c.y.', 'g.g.g.g.g.'],
    ['.c...y....', 'cw..yw..c.', '..y....c.y', 'y...c.yw..', '.c.y....c.', '.g.g.g.g.g'],
    ['....c...y.', '...cw.yw..', '.y..c....c', '..cw..y..y', 'y....c.y..', 'g.g.g.g.g.'],
  ];
  const frames = FRAMES.map((rows, i) => {
    const c = canvas();
    c.sprite(rows, { y: 'spark', c: 'spark-c', w: 'spark-w', g: 'smoke' }, 0, 0);
    return `<g class="px-fire px-fire-${i}">${c.svg()}</g>`;
  });
  return `<svg class="px-flames px-short" viewBox="0 0 10 6" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${frames.join('')}</svg>`;
}

// ------------------------------------------------------------ las descargas en escena
//
// Un robot por capítulo lleva su cartucho de luz hasta la cápsula al pie del atril
// (DownloadCrew.tsx); la cápsula se abre, lo guarda y se cierra con un "fsss". El robot
// lleva la placa del color de la voz (data-voice). Las mismas clases que el arcón.

/** Un robotito con orugas y su cartucho de luz (12 × 15), de pie, andando y festejando. */
function cartRobot(frame, cheer = false) {
  const p = new Pix(12, 15);
  const up = cheer ? 1 : 0;
  rect(p, C.tread, 1, 12, 8, 3);
  for (let x = 2 + (frame % 2); x < 9; x += 2) p.set(x, 13, C.treadL);
  fillMask(
    p,
    rr(1, 5 - up, 8, 12 - up, 1),
    [0, 4 - up, 9, 13 - up],
    (x) => (x < 3 ? C.white : C.whiteM),
    C.line,
  );
  rect(p, VOICE.mid, 3, 8 - up, 4, 2);
  rect(p, C.metalD, 4, 2 - up, 1, 3);
  fillMask(p, rr(2, 0, 7, 3, 1), [1, -1, 8, 4], () => C.metal, C.line);
  p.set(3, 1, C.eye);
  p.set(6, 1, C.eye);
  // el cartucho en alto (o en el festejo, los brazos arriba)
  if (cheer) {
    p.set(0, 3, C.metalD);
    p.set(9, 3, C.metalD);
  } else {
    fillMask(p, rr(9, 4, 11, 9, 0), [8, 3, 12, 10], (x, y) => (y < 6 ? C.cyanL : C.cyan), C.lineD);
    p.set(8, 7, C.metalD);
  }
  return p;
}

function cartCarrier(voice = '') {
  return svg(
    'px-workshop px-dl-carrier',
    12,
    15,
    `<g class="dl-walker"><g class="ws-actor ws-toggle" style="--dur:0.3s"><g class="ws-a">${svgOf(cartRobot(0))}</g><g class="ws-b">${svgOf(cartRobot(1))}</g></g></g><g class="dl-cheer">${svgOf(cartRobot(0, true))}</g>`,
    ` data-voice="${voice}"`,
  );
}

/** La cápsula de almacenamiento (20 × 16): cerrada, la ventana de vidrio; abierta, los cartuchos. */
function capsuleChest() {
  const body = new Pix(20, 16);
  fillMask(
    body,
    rr(2, 1, 17, 14, 6),
    [1, 0, 18, 15],
    (x) => (x < 5 ? C.white : x > 14 ? C.whiteD : C.whiteM),
    C.line,
  );
  rect(body, C.metalD, 4, 14, 3, 2);
  rect(body, C.metalD, 13, 14, 3, 2);
  rect(body, C.cyan, 4, 12, 12, 1);
  body.set(9, 2, C.yellow);
  body.set(10, 2, C.yellow);
  const closed = new Pix(20, 16);
  fillMask(
    closed,
    rr(6, 4, 13, 10, 3),
    [5, 3, 14, 11],
    (x) => (x < 8 ? C.white : C.cyanL),
    C.lineD,
  );
  rect(closed, C.cyan, 9, 5, 2, 5);
  const open = new Pix(20, 16);
  fillMask(open, rr(6, 4, 13, 10, 3), [5, 3, 14, 11], () => C.screen, C.lineD);
  for (let i = 0; i < 3; i++) rect(open, C.cyan, 7 + i * 2, 6, 1, 4);
  return svg(
    'px-dl-chest',
    20,
    16,
    `${svgOf(body)}<g class="dl-lid-closed">${svgOf(closed)}</g><g class="dl-lid-open">${svgOf(open)}</g>`,
  );
}

// ------------------------------------------------------------ la estantería holográfica

/** El libro de luz de la ranura, con el color del libro como variable (--px-book*). */
function lightBookSvg(emblem) {
  return svg('px-light-book', 12, 18, svgOf(lightBook(BOOK, emblem)));
}

/** Una de las portadas prediseñadas, con el color del libro como variable. */
function coverSvg(design) {
  return svg('px-cover', 32, 44, svgOf(cover(design, BOOK)));
}

export const Solarpunk = {
  progressThumb,
  lecternStand,
  pol,
  workshop: gardenWorkshop,
  bookCrew,
  shortCircuit,
  cartCarrier,
  capsuleChest,
  lightBook: lightBookSvg,
  cover: coverSvg,
  EMBLEMS: EMBLEM_NAMES,
  COVERS: COVER_NAMES,
};
