// Lectio · pixel art del Bosque élfico (docs/lectio-temas.md §7.5). Usa el mismo motor que
// el Scriptorium (pixel.js: canvas, piezas de arquitectura y la paleta en variables --px-*);
// aquí van solo los dibujos de este mundo. Cada pieza es la adaptación de una del
// Scriptorium, con la misma composición: la portada y las salas ponen las estanterías, la
// ventana, la puerta y los muebles donde están en el Scriptorium, así que la estantería de
// la app (HTML) y el encuadre del celular caen en el mismo sitio.

import { Pixel, PixelParts } from './pixel';

const { canvas, random } = Pixel;
const {
  lancetShape,
  fillShape,
  lightBeam,
  lightPool,
  glow,
  motes,
  sky,
  book,
  openBook,
  inkwellWithQuill,
  stainedGlass,
  ladder,
} = PixelParts;

const W = 320;
const H = 180;

// ------------------------------------------------------------ piezas del HUD

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
  const c = canvas();
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
  const c = canvas();
  c.sprite(CORNER, { g: 'gold', w: 'silver-l', r: 'leaf', l: 'leaf-l' }, 0, 0);
  return `<svg class="px-fleuron" viewBox="0 0 9 9" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${c.svg()}</svg>`;
}

// ------------------------------------------------------------ muros, suelos y hiedra

/** Sillares de piedra blanca, grandes y parejos, con una franja de filigrana de oro. */
function whiteWall(c, x, y, w, h, rnd, { frieze = null } = {}) {
  c.rect('mortar', x, y, w, h);
  const bh = 9;
  for (let row = 0; row * bh < h; row++) {
    const by = y + row * bh;
    const offset = row % 2 ? -11 : 0;
    for (let bx = x + offset; bx < x + w; bx += 22) {
      const left = Math.max(bx, x);
      const right = Math.min(bx + 21, x + w);
      const tone = rnd() < 0.14 ? 'stone-d' : rnd() < 0.18 ? 'stone-l' : 'stone';
      c.rect(tone, left, by, right - left, Math.min(bh - 1, y + h - by));
      c.rect('stone-l', left, by, right - left, 1);
    }
  }
  if (frieze !== null) {
    c.rect('gold-d', x, y + frieze, w, 4);
    c.rect('gold', x, y + frieze + 1, w, 2);
    for (let fx = x + 2; fx < x + w; fx += 8) {
      c.rect('gold-l', fx, y + frieze + 1, 2, 1);
      c.rect('gold-d', fx + 4, y + frieze + 2, 1, 1);
    }
  }
}

/** Suelo de mármol claro: losas en damero, más grandes hacia el frente, con taracea de oro. */
function marbleFloor(c, x, y, w, h) {
  c.rect('stone-d', x, y, w, h);
  for (let row = 0, py = y; py < y + h; row++) {
    const lh = 4 + row * 2;
    const lw = 18 + row * 6;
    for (let i = 0, px = x - (row % 2) * Math.floor(lw / 2); px < x + w; i++, px += lw) {
      const left = Math.max(px, x);
      const right = Math.min(px + lw - 1, x + w);
      c.rect(i % 2 ? 'stone' : 'stone-l', left, py, right - left, Math.min(lh - 1, y + h - py));
      if (right - left > 2) c.rect('gold-d', right - 1, py + lh - 1, 1, 1);
    }
    py += lh;
  }
  c.rect('gold-d', x, y, w, 1);
}

/** Tablones de madera plateada (el refugio del árbol). */
function plankFloor(c, x, y, w, h, rnd) {
  for (let row = 0; row * 5 < h; row++) {
    const py = y + row * 5;
    c.rect(row % 2 ? 'bark' : 'bark-d', x, py, w, 5);
    for (let seam = x + ((row * 17) % 23); seam < x + w; seam += 23 + Math.floor(rnd() * 14))
      c.rect('ink', seam, py, 1, 5);
    c.rect('bark-l', x, py, w, 1);
  }
}

/** Muro del refugio: tablones verticales de madera plateada, con su veta. */
function plankWall(c, x, y, w, h, rnd) {
  c.rect('bark', x, y, w, h);
  for (let px = x; px < x + w; px += 9) {
    c.rect('bark-d', px, y, 1, h);
    c.rect('bark-l', px + 1, y, 1, h);
    for (let k = 0; k < 3; k++) {
      const gy = y + Math.floor(rnd() * h);
      c.rect('bark-d', px + 3 + Math.floor(rnd() * 4), gy, 1, 3 + Math.floor(rnd() * 5));
    }
  }
}

/** Una hiedra que cuelga: el tallo serpentea hacia abajo y echa hojas a cada lado. */
function ivy(x, top, length, rnd) {
  const c = canvas();
  let px = x;
  for (let py = top; py < top + length; py++) {
    if (rnd() < 0.3) px += rnd() < 0.5 ? -1 : 1;
    c.rect('leaf-d', px, py, 1, 1);
    if ((py - top) % 4 === 1) {
      const side = (py - top) % 8 === 1 ? -1 : 1;
      c.rect('leaf', px + side, py, 1, 1);
      c.rect('leaf', px + side * 2, py - 1, 1, 2);
      c.rect('leaf-l', px + side * 2, py - 1, 1, 1);
    }
  }
  return c.svg();
}

// ------------------------------------------------------------ luces de noche

/** Luciérnagas: aparecen de noche y flotan (bosque.css: .px-firefly). */
function fireflies(x, y, w, h, rnd, count = 10) {
  const dots = [];
  for (let i = 0; i < count; i++) {
    const fx = x + Math.floor(rnd() * w);
    const fy = y + Math.floor(rnd() * h);
    dots.push(
      `<path class="px-firefly" style="animation-delay:${(rnd() * 6).toFixed(2)}s;animation-duration:${(5 + rnd() * 4).toFixed(1)}s" d="M${fx} ${fy}h1v1h-1z"/>`,
    );
  }
  return `<g class="px-night px-fireflies">${dots.join('')}</g>`;
}

/** Hongos al pie de un muro: de día, blancos con pintas; de noche brillan. */
function shrooms(x, bottom, flip = false) {
  const caps = [
    [0, 5, 4],
    [5, 8, 6],
    [11, 4, 3],
  ];
  const day = canvas();
  const night = canvas();
  for (const [dx, height, width] of caps) {
    const sx = flip ? x - dx - width : x + dx;
    day.rect('stone-l', sx + Math.floor(width / 2), bottom - height + 2, 1, height - 2);
    for (const layer of [day, night]) {
      const cap = layer === day ? 'shroom' : 'shroom-glow';
      layer.rect(cap, sx, bottom - height, width, 2);
      layer.rect(cap, sx + 1, bottom - height - 1, width - 2, 1);
    }
    day.rect('shroom-l', sx + 1, bottom - height, 1, 1);
  }
  return `${day.svg()}<g class="px-night px-shroom">${night.svg()}</g>`;
}

/**
 * Linterna élfica de oro, colgada de su cadena (o de pie si `chain` es 0): el vidrio deja
 * ver la llama, que titila con las mismas clases que la vela del Scriptorium.
 */
function lantern(x, y, chain = 0) {
  const c = canvas();
  if (chain > 0) c.rect('gold-d', x + 3, y - chain, 1, chain);
  c.sprite(
    [
      '...g...',
      '..ggg..',
      '.ghhhg.',
      '.gwwwg.',
      '.gwwwg.',
      '.gwwwg.',
      '.ghhhg.',
      '..ggg..',
      '...h...',
    ],
    { g: 'gold', h: 'gold-d', w: 'glass' },
    x,
    y,
  );
  const frames = [
    ['...f...', '..fyf..', '...y...'],
    ['..f....', '..fyf..', '...y...'],
  ].map((flame, i) => {
    const f = canvas();
    f.sprite(flame, { f: 'flame', y: 'flame-core' }, x, y + 3);
    return `<g class="px-flame px-flame-${i}">${f.svg()}</g>`;
  });
  return `<g class="px-lantern">${c.svg()}${frames.join('')}</g>`;
}

/** Farol de pie: poste de oro con hojas talladas y la linterna arriba (el candelabro). */
function lampPost(x, bottom, height) {
  const c = canvas();
  c.rect('ink', x - 4, bottom - 2, 9, 2);
  c.rect('ink', x - 1, bottom - height, 3, height - 2);
  c.rect('gold-d', x - 3, bottom - 2, 7, 1);
  c.rect('gold', x, bottom - height, 1, height - 2);
  for (const k of [0.3, 0.6]) {
    const ly = bottom - Math.round(height * k);
    c.rect('leaf', x - 2, ly, 2, 1);
    c.rect('leaf', x + 1, ly - 2, 2, 1);
    c.rect('leaf-l', x - 2, ly, 1, 1);
  }
  c.rect('gold', x - 2, bottom - height - 1, 5, 1);
  return c.svg() + lantern(x - 3, bottom - height - 10);
}

// ------------------------------------------------------------ ventanas y paisaje

/**
 * El bosque por la ventana: copas lejanas, las torres blancas con techos de oro sobre la
 * loma, el río que baja entre las copas del medio y, al frente, troncos plateados. De
 * noche, las ventanas de las torres se encienden.
 */
function forest(x, y, w, h) {
  const c = canvas();
  const bottom = y + h;
  const wave = (px, base, parts) =>
    base +
    Math.round(
      parts.reduce((sum, [amp, len, phase]) => sum + amp * Math.sin((px - x) / len + phase), 0),
    );
  const far = (px) =>
    wave(px, y + 44, [
      [1.6, 1.8, 0],
      [2.2, 6, 1],
    ]);
  const mid = (px) =>
    wave(px, y + 54, [
      [1.8, 2.1, 0.6],
      [1.5, 5, 2],
    ]);
  const near = (px) =>
    wave(px, y + 64, [
      [1.6, 1.6, 1.4],
      [1.2, 4, 0],
    ]);

  const lit = canvas();
  const dark = canvas();
  for (let px = x; px < x + w; px++) c.rect('tree-far', px, far(px), 1, bottom - far(px));

  // Torres de piedra blanca con su techo cónico de oro.
  const tower = (tx, tall) => {
    const base = far(tx + 1) + 2;
    c.rect('tower-d', tx, base - tall, 3, tall);
    c.rect('tower', tx, base - tall, 2, tall);
    c.rect('roof', tx, base - tall - 2, 3, 2);
    c.rect('roof', tx + 1, base - tall - 4, 1, 2);
    dark.rect('ink', tx + 1, base - tall + 3, 1, 1);
    lit.rect('lit', tx + 1, base - tall + 3, 1, 1);
  };
  tower(x + Math.round(w * 0.22), 13);
  tower(x + Math.round(w * 0.36), 18);
  tower(x + Math.round(w * 0.7), 11);

  for (let px = x; px < x + w; px++) {
    const top = mid(px);
    c.rect('tree', px, top, 1, bottom - top);
    if ((px - x) % 3 === 0) c.rect('tree-l', px, top, 1, 1);
  }
  // El río: baja desde la loma, cada vez más ancho, con un brillo.
  for (let py = y + 55; py < bottom; py++) {
    const t = (py - (y + 55)) / (bottom - (y + 55));
    const center = x + Math.round(w * 0.55 + 6 * Math.sin(py / 5) * t - t * 5);
    const width = 1 + Math.round(t * 4);
    c.rect('river', center - Math.floor(width / 2), py, width, 1);
    if (py % 3 === 0) c.rect('river-l', center, py, 1, 1);
  }
  for (let px = x; px < x + w; px++) {
    const n = near(px);
    c.rect('tree-d', px, n, 1, bottom - n);
  }
  // Troncos plateados al frente.
  for (const tx of [x + 4, x + Math.round(w * 0.82)]) {
    c.rect('trunk', tx, near(tx) - 2, 1, bottom - near(tx) + 2);
    c.rect('trunk', tx - 1, near(tx) - 1, 3, 1);
  }
  return `${c.svg()}<g class="px-day">${dark.svg()}</g><g class="px-night px-lit">${lit.svg()}</g>`;
}

/** Hoja de vidrio de color: la tracería de las ventanas ojivales. */
function leafPane(cx, cy, rx, ry) {
  const glass = canvas();
  const lead = canvas();
  for (let py = Math.floor(cy - ry); py <= Math.ceil(cy + ry); py++) {
    const dy = (py - cy) / ry;
    if (Math.abs(dy) > 1) continue;
    const half = rx * (1 - dy * dy);
    for (let px = Math.floor(cx - half); px <= Math.ceil(cx + half); px++) {
      const dx = px - cx;
      if (Math.abs(dx) > half + 0.3) continue;
      const edge = Math.abs(dx) > half - 1 || Math.abs(dy) > 0.9;
      const vein = Math.abs(dx) < 0.6 || Math.abs(Math.abs(dx) + (py - cy) - 1.5) < 0.6;
      if (edge || vein) lead.rect('lead', px, py, 1, 1);
      else glass.rect(dx < 0 ? 'leaf-l' : 'leaf', px, py, 1, 1);
    }
  }
  return glass.svg() + lead.svg();
}

/**
 * Ventana ojival de piedra blanca con filete de oro (el ventanal del Scriptorium): por el
 * vidrio se ve `view`, ya recortado a la forma del vano; en la clave, una hoja de vidrio.
 */
function ogivalWindow(x, y, w, h, view, clipId) {
  const inside = lancetShape(x, y, w, h);
  const frame = canvas();
  const glass = canvas();
  for (let py = y - 3; py < y + h + 3; py++) {
    for (let px = x - 3; px < x + w + 3; px++) {
      if (inside(px, py)) {
        const band = (py - y) / h;
        glass.rect(band < 0.3 ? 'sky-top' : band < 0.55 ? 'sky' : 'sky-low', px, py, 1, 1);
        continue;
      }
      const near1 = inside(px - 1, py) || inside(px + 1, py) || inside(px, py + 1);
      const near3 =
        inside(px - 3, py) ||
        inside(px + 3, py) ||
        inside(px, py + 3) ||
        (py >= y + h && py < y + h + 3 && px >= x - 3 && px < x + w + 3);
      if (py >= y + h) frame.rect('stone-d', px, py, 1, 1);
      else if (near1) frame.rect('gold', px, py, 1, 1);
      else if (near3) frame.rect('stone-l', px, py, 1, 1);
    }
  }
  // Tracería: la hoja en la clave, el parteluz y un travesaño (dejan ver el bosque).
  const a = Math.round(w * 0.87);
  const lead = canvas();
  const leafY = y + Math.round(a * 0.62);
  lead.rect('lead', x + Math.floor(w / 2), leafY + 9, 1, y + h - leafY - 9);
  lead.rect('lead', x, y + a + 22, w, 1);
  const path = [];
  for (let py = y; py < y + h; py++) {
    let start = null;
    for (let px = x; px <= x + w; px++) {
      const hit = px < x + w && inside(px, py);
      if (hit && start === null) start = px;
      if (!hit && start !== null) {
        path.push(`M${start} ${py}h${px - start}v1h${start - px}z`);
        start = null;
      }
    }
  }
  return `${glass.svg()}
    <defs><clipPath id="${clipId}"><path d="${path.join('')}"/></clipPath></defs>
    <g clip-path="url(#${clipId})">${view}</g>
    ${leafPane(x + w / 2 - 0.5, leafY, Math.min(6, w / 2 - 3), 8)}${lead.svg()}${frame.svg()}`;
}

/** Ventana ovalada con marco de ramas (el refugio): `view` se recorta al óvalo. */
function ovalWindow(cx, cy, rx, ry, view, clipId, rnd) {
  const inside = (px, py) => ((px + 0.5 - cx) / rx) ** 2 + ((py + 0.5 - cy) / ry) ** 2 <= 1;
  const glass = canvas();
  const frame = canvas();
  const leaves = canvas();
  const path = [];
  for (let py = Math.floor(cy - ry - 4); py < cy + ry + 4; py++) {
    let start = null;
    for (let px = Math.floor(cx - rx - 4); px <= cx + rx + 4; px++) {
      const hit = inside(px, py);
      if (hit) {
        const band = (py - (cy - ry)) / (2 * ry);
        glass.rect(band < 0.3 ? 'sky-top' : band < 0.55 ? 'sky' : 'sky-low', px, py, 1, 1);
        if (start === null) start = px;
      } else {
        if (start !== null) {
          path.push(`M${start} ${py}h${px - start}v1h${start - px}z`);
          start = null;
        }
        const ring =
          inside(px - 3, py) || inside(px + 3, py) || inside(px, py - 3) || inside(px, py + 3);
        if (ring) {
          const twist = (px + py * 2) % 5;
          frame.rect(twist === 0 ? 'bark-d' : twist === 1 ? 'bark-l' : 'bark', px, py, 1, 1);
          if (rnd() < 0.08) {
            leaves.rect('leaf', px, py, 2, 1);
            leaves.rect('leaf-l', px, py - 1, 1, 1);
          }
        }
      }
    }
  }
  const lead = canvas();
  lead.rect('bark-d', Math.round(cx), Math.round(cy - ry), 1, 2 * ry);
  lead.rect('bark-d', Math.round(cx - rx), Math.round(cy), 2 * rx, 1);
  return `${glass.svg()}
    <defs><clipPath id="${clipId}"><path d="${path.join('')}"/></clipPath></defs>
    <g clip-path="url(#${clipId})">${view}${lead.svg()}</g>
    ${frame.svg()}${leaves.svg()}`;
}

// ------------------------------------------------------------ la estantería

/** Lomos: color base, luz y sombra (los del Bosque: hoja, plata, corteza, ciruela, azul). */
const SPINES = [
  ['leaf', 'leaf-l', 'leaf-d'],
  ['emerald', 'leaf', 'emerald-d'],
  ['silver', 'silver-l', 'silver-d'],
  ['bark', 'bark-l', 'bark-d'],
  ['plum', 'plum-l', 'plum-d'],
  ['blue', 'blue-l', 'blue-d'],
  ['gold-d', 'gold', 'ink'],
  ['emerald', 'leaf', 'emerald-d'],
];

/** Objetos élficos entre los libros: un brote en su maceta, un cristal, rollos y un arpa. */
const SHELF_PALETTE = {
  o: 'ink',
  w: 'parch',
  l: 'parch-d',
  g: 'gold',
  h: 'gold-d',
  e: 'leaf-l',
  E: 'leaf',
  b: 'bark-d',
  s: 'silver-l',
  c: 'crystal',
  d: 'crystal-d',
  r: 'emerald',
};
const SHELF_OBJECTS = [
  ['..e.e..', '.eEeEe.', '..eEe..', '...b...', '.ooooo.', '.ossso.', '..ooo..'],
  ['...s...', '..scs..', '.scdcs.', '.sccds.', '.scdcs.', '..scs..', '.hhhhh.'],
  ['...ooooooo.', '..olwwrwwlo', '...ooooooo.', '.ooooooo...', 'olwwrwwlo..', '.ooooooo...'],
  ['gg.....', 'g.g....', 'g..g...', 'gs.sg..', 'gs.s.g.', 'gs.s.sg', 'ggggggg'],
  ['.oooooooo.', '.orrrrrro.', 'oooooooooo', 'osssssssso', 'ogggggggo.', 'oooooooooo'],
];

/**
 * Estantería de piedra blanca (la estantería tallada del Scriptorium): cornisa con
 * filigrana y el emblema de alas de oro, columnas con anillos de oro, fondo de piedra
 * verde plata y los estantes con libros y, de vez en cuando, un objeto élfico.
 */
function stoneShelf(c, x, y, w, h, rnd, shelves = 3) {
  const layers = [];
  const shade = canvas();
  const post = 5;
  const cornice = 9;
  const plinth = 6;
  const inner = { x: x + post, y: y + cornice, w: w - post * 2, h: h - cornice - plinth };

  c.rect('shelf-back', inner.x, inner.y, inner.w, inner.h);
  for (let px = inner.x + 4; px < inner.x + inner.w; px += 11)
    c.rect('shelf-back-d', px, inner.y, 1, inner.h);

  for (const px of [x, x + w - post]) {
    c.rect('ink', px, y, post, h);
    c.rect('stone', px + 1, y + 1, post - 2, h - 2);
    c.rect('stone-l', px + 1, y + 1, 1, h - 2);
    c.rect('stone-d', px + post - 2, y + 1, 1, h - 2);
    for (let ny = y + cornice + 8; ny < y + h - plinth - 4; ny += 14) {
      c.rect('gold', px + 1, ny, post - 2, 1);
      c.rect('gold-d', px + 1, ny + 1, post - 2, 1);
    }
  }

  c.rect('ink', x - 2, y, w + 4, cornice);
  c.rect('stone-l', x - 1, y + 1, w + 2, 2);
  c.rect('stone', x - 1, y + 3, w + 2, 2);
  c.rect('gold', x - 1, y + 5, w + 2, 1);
  for (let dx = x; dx < x + w - 1; dx += 6) c.rect('gold-l', dx + 2, y + 5, 1, 1);
  c.rect('stone-d', x - 1, y + 6, w + 2, 2);
  const crest = canvas();
  crest.sprite(
    [
      'gg.........gg',
      'hggg.....gggh',
      '.hggg.w.gggh.',
      '..hhggwgghh..',
      '....hgegh....',
      '.....heh.....',
      '......h......',
    ],
    { g: 'gold', h: 'gold-d', w: 'silver-l', e: 'leaf' },
    x + Math.floor(w / 2) - 6,
    y - 6,
  );
  layers.push(crest.svg());

  c.rect('ink', x - 1, y + h - plinth, w + 2, plinth);
  c.rect('stone', x, y + h - plinth + 1, w, plinth - 2);
  c.rect('stone-l', x, y + h - plinth + 1, w, 1);
  c.rect('gold-d', x, y + h - 2, w, 1);

  const gap = Math.floor(inner.h / shelves);
  for (let s = 0; s < shelves; s++) {
    const base = inner.y + gap * (s + 1) - 4;
    shade.rect('shade', inner.x, base - gap + 4, inner.w, 3);
    c.rect('ink', inner.x, base, inner.w, 4);
    c.rect('stone-l', inner.x, base, inner.w, 1);
    c.rect('stone', inner.x, base + 1, inner.w, 2);

    let bx = inner.x + 2;
    let sinceObject = 0;
    const end = inner.x + inner.w - 2;
    while (bx < end - 4) {
      const room = end - bx;
      if (sinceObject > 3 && rnd() < 0.22) {
        const object = SHELF_OBJECTS[Math.floor(rnd() * SHELF_OBJECTS.length)];
        const width = Math.max(...object.map((row) => row.length));
        if (width + 1 <= room) {
          const layer = canvas();
          layer.sprite(object, SHELF_PALETTE, bx + 1, base - object.length);
          layers.push(layer.svg());
          bx += width + 2;
          sinceObject = 0;
          continue;
        }
      }
      if (rnd() < 0.05) {
        bx += 3 + Math.floor(rnd() * 3);
        continue;
      }
      const bw = Math.min(room, 5 + Math.floor(rnd() * 5));
      if (bw < 4) break;
      const bh = Math.min(gap - 8, 16 + Math.floor(rnd() * (gap - 22)));
      layers.push(book(bx, base, bw, bh, SPINES[Math.floor(rnd() * SPINES.length)], rnd));
      bx += bw + (rnd() < 0.15 ? 1 : 0);
      sinceObject++;
    }
  }
  return layers.join('') + shade.svg();
}

// ------------------------------------------------------------ la puerta

/**
 * La puerta entre las salas: un arco de ramas. Cerrado, las ramas y las hojas se
 * entrelazan en el vano; abierto, se apartan a los lados y entra una luz verde dorada que
 * se derrama en el suelo. Las mismas clases que la puerta del Scriptorium (.px-door…).
 */
function branchArch(x, y, w, h) {
  const inside = lancetShape(x, y, w, h);
  const frame = canvas();
  const closed = canvas();
  const open = canvas();
  const rnd = random(x * 31 + y);
  const mid = x + w / 2 - 0.5;
  for (let py = y - 4; py < y + h; py++) {
    for (let px = x - 4; px < x + w + 4; px++) {
      if (inside(px, py)) {
        // Cerrado: dos cortinas de ramas que bajan curvas y se juntan al centro.
        const fromMid = Math.abs(px - mid);
        const lean = Math.round(fromMid + (py - y) / 6);
        const seam = fromMid < 0.6;
        const branch = lean % 4 === 0;
        const leafy = (px * 7 + py * 3) % 5 === 0;
        closed.rect(
          seam ? 'bark-d' : branch ? 'bark' : leafy ? 'leaf-l' : (px + py) % 3 ? 'leaf' : 'leaf-d',
          px,
          py,
          1,
          1,
        );
        // Abierto: la luz, con las ramas recogidas en los costados.
        const side = Math.min(px - x, x + w - 1 - px);
        open.rect(
          side < 2
            ? (px + py) % 3
              ? 'leaf-d'
              : 'bark'
            : py < y + 8
              ? 'door-light-d'
              : 'door-light',
          px,
          py,
          1,
          1,
        );
      } else if (inside(px - 3, py) || inside(px + 3, py) || inside(px, py + 3)) {
        // El marco: ramas trenzadas de corteza, con su contorno.
        const edge = !(inside(px - 2, py) || inside(px + 2, py) || inside(px, py + 2));
        const twist = (px * 2 + py) % 6;
        frame.rect(
          edge ? 'ink' : twist < 2 ? 'bark-d' : twist === 2 ? 'bark-l' : 'bark',
          px,
          py,
          1,
          1,
        );
      } else if ((inside(px - 5, py) || inside(px + 5, py) || inside(px, py + 5)) && rnd() < 0.3) {
        frame.rect(rnd() < 0.4 ? 'leaf-l' : 'leaf', px, py, 1, 1);
      }
    }
  }
  // El tirador: una hoja de oro a cada lado de la juntura.
  const knobY = y + Math.round(h * 0.58);
  closed.rect('gold', Math.floor(mid) - 1, knobY, 1, 2);
  closed.rect('gold', Math.ceil(mid) + 1, knobY, 1, 2);
  const spill = canvas();
  for (let i = 0; i < 5; i++) spill.rect('door-beam', x - i, y + h + i, w + i * 2, 1);
  return `<g class="px-door"><g class="px-door-frame">${frame.svg()}</g>
    <g class="px-door-closed">${closed.svg()}</g>
    <g class="px-door-open">${open.svg()}${spill.svg()}</g>
    <rect class="px-door-hit" x="${x - 4}" y="${y - 4}" width="${w + 8}" height="${h + 4}" fill="transparent"/>
  </g>`;
}

// ------------------------------------------------------------ muebles

/** Mesa de lectura de piedra blanca con canto de oro, el atril y el libro abierto. */
function readingTable() {
  const d = canvas();
  d.rect('ink', 92, 130, 136, 4);
  d.rect('stone-l', 92, 130, 136, 1);
  d.rect('gold', 92, 132, 136, 1);
  d.rect('stone', 96, 134, 128, 14);
  d.rect('stone-l', 96, 134, 128, 1);
  d.rect('stone-d', 96, 146, 128, 2);
  for (let fx = 104; fx < 220; fx += 12) {
    d.rect('leaf', fx, 139, 2, 1);
    d.rect('leaf-l', fx + 2, 138, 1, 1);
    d.rect('gold-d', fx + 6, 140, 1, 1);
  }
  for (const lx of [100, 214]) {
    d.rect('ink', lx - 1, 148, 8, 22);
    d.rect('stone', lx, 148, 6, 22);
    d.rect('stone-l', lx, 148, 1, 22);
    d.rect('gold', lx, 156, 6, 1);
  }
  d.rect('bark', 140, 124, 40, 6);
  d.rect('bark-d', 140, 129, 40, 1);
  d.rect('gold', 140, 124, 40, 1);
  return d.svg() + openBook(143, 114) + lantern(198, 121) + inkwellWithQuill(118, 115);
}

/** El atril élfico de la sala: pedestal de piedra como un tronco, con oro y el libro. */
function elvenLectern(cx, bottom) {
  const c = canvas();
  c.rect('ink', cx - 10, bottom - 3, 20, 3);
  c.rect('ink', cx - 4, bottom - 27, 8, 24);
  c.rect('ink', cx - 19, bottom - 32, 38, 6);
  c.rect('stone', cx - 9, bottom - 2, 18, 1);
  c.rect('stone', cx - 3, bottom - 26, 6, 23);
  c.rect('stone-l', cx - 3, bottom - 26, 1, 23);
  c.rect('stone-d', cx + 2, bottom - 26, 1, 23);
  // Raíces de piedra que abrazan la base.
  c.rect('stone-d', cx - 7, bottom - 5, 3, 2);
  c.rect('stone-d', cx + 4, bottom - 5, 3, 2);
  c.rect('stone', cx - 18, bottom - 31, 36, 3);
  c.rect('stone-l', cx - 18, bottom - 31, 36, 1);
  c.rect('gold', cx - 18, bottom - 28, 36, 1);
  c.rect('gold', cx - 4, bottom - 17, 8, 2);
  c.rect('leaf', cx - 2, bottom - 20, 1, 2);
  c.rect('leaf-l', cx + 1, bottom - 21, 1, 2);
  return c.svg() + openBook(cx - 17, bottom - 42);
}

/** Escritorio de rama: tablero de canto vivo, patas de ramas torcidas, la hoja y una maceta. */
function branchDesk(x, bottom) {
  const c = canvas();
  const top = bottom - 30;
  for (const lx of [x + 4, x + 56]) {
    c.rect('ink', lx, top + 4, 4, 26);
    c.rect('bark', lx + 1, top + 4, 2, 26);
    c.rect('bark-l', lx + 1, top + 8, 1, 6);
  }
  c.rect('ink', x + 2, bottom - 3, 10, 3);
  c.rect('ink', x + 52, bottom - 3, 10, 3);
  c.rect('ink', x, top, 64, 5);
  c.rect('bark', x + 1, top + 1, 62, 3);
  c.rect('bark-l', x + 1, top + 1, 62, 1);
  for (const gx of [x + 9, x + 30, x + 47]) c.rect('bark-d', gx, top + 2, 6, 1);
  c.rect('ink', x + 6, top - 6, 30, 6);
  c.rect('bark', x + 7, top - 5, 28, 4);
  c.rect('gold', x + 7, top - 5, 28, 1);
  const sheet = canvas();
  sheet.rect('parch-d', x + 9, top - 13, 24, 8);
  sheet.rect('parch', x + 10, top - 12, 22, 6);
  for (const ly of [top - 11, top - 9, top - 7]) sheet.rect('text', x + 12, ly, 17, 1);
  sheet.rect('leaf', x + 11, top - 11, 2, 2);
  const pot = canvas();
  pot.sprite(SHELF_OBJECTS[0], SHELF_PALETTE, x + 50, top - 7);
  return c.svg() + sheet.svg() + inkwellWithQuill(x + 38, top - 15) + pot.svg();
}

/** Sillón tejido de ramas con cojín de musgo y una manta de hojas. */
function mossChair(x, bottom) {
  const c = canvas();
  c.rect('ink', x + 4, bottom - 48, 36, 34);
  c.rect('ink', x, bottom - 26, 8, 18);
  c.rect('ink', x + 36, bottom - 26, 8, 18);
  c.rect('ink', x + 4, bottom - 18, 36, 8);
  for (const lx of [x + 3, x + 38]) c.rect('ink', lx, bottom - 10, 3, 10);
  // Respaldo tejido: ramas en trama.
  for (let py = bottom - 47; py < bottom - 16; py++)
    for (let px = x + 5; px < x + 39; px++)
      c.rect((px + py) % 4 === 0 || (px - py + 400) % 4 === 0 ? 'bark-l' : 'bark', px, py, 1, 1);
  c.rect('gold', x + 5, bottom - 47, 34, 1);
  c.rect('bark-d', x + 1, bottom - 25, 6, 16);
  c.rect('bark-d', x + 37, bottom - 25, 6, 16);
  c.rect('bark-l', x + 1, bottom - 25, 6, 1);
  c.rect('bark-l', x + 37, bottom - 25, 6, 1);
  // Cojín de musgo.
  c.rect('moss-l', x + 7, bottom - 17, 30, 3);
  c.rect('moss', x + 7, bottom - 14, 30, 3);
  for (const mx of [x + 10, x + 19, x + 28]) c.rect('moss-d', mx, bottom - 15, 3, 1);
  for (const lx of [x + 4, x + 39]) c.rect('bark-d', lx, bottom - 9, 1, 9);
  const blanket = canvas();
  blanket.rect('ink', x + 29, bottom - 31, 12, 20);
  blanket.rect('leaf', x + 30, bottom - 30, 10, 18);
  for (let sy = bottom - 28; sy < bottom - 13; sy += 4) {
    blanket.rect('leaf-l', x + 30, sy, 10, 1);
    blanket.rect('gold', x + 34, sy + 2, 2, 1);
  }
  return c.svg() + blanket.svg();
}

/** Mesita de tocón con su linterna. */
function stumpTable(x, bottom) {
  const c = canvas();
  c.rect('ink', x, bottom - 20, 14, 20);
  c.rect('bark', x + 1, bottom - 19, 12, 18);
  c.rect('bark-l', x + 1, bottom - 19, 12, 2);
  c.rect('bark-d', x + 3, bottom - 18, 8, 1);
  c.rect('bark-d', x + 5, bottom - 14, 1, 12);
  c.rect('bark-d', x + 9, bottom - 12, 1, 9);
  c.rect('ink', x - 2, bottom - 2, 4, 2);
  c.rect('ink', x + 12, bottom - 2, 4, 2);
  c.rect('moss', x + 2, bottom - 3, 4, 1);
  return c.svg() + lantern(x + 3, bottom - 29);
}

/** Alfombra tejida: campo de hoja, cenefa de oro con hojitas, el árbol al centro y flecos. */
function wovenRug(x, y, w, h) {
  const c = canvas();
  c.rect('ink', x, y, w, h);
  c.rect('gold-d', x + 1, y + 1, w - 2, h - 2);
  c.rect('emerald-d', x + 3, y + 2, w - 6, h - 4);
  c.rect('emerald', x + 5, y + 3, w - 10, h - 6);
  for (let px = x + 4; px < x + w - 4; px += 5) {
    c.rect('leaf-l', px, y + 1, 2, 1);
    c.rect('leaf-l', px + 2, y + h - 2, 2, 1);
  }
  const cx = x + Math.floor(w / 2);
  const cy = y + Math.floor(h / 2);
  c.rect('gold', cx - 8, cy, 16, 1);
  c.rect('silver-l', cx - 3, cy - 2, 6, 5);
  c.rect('leaf', cx - 1, cy - 1, 2, 3);
  for (let px = x + 1; px < x + w - 1; px += 2) {
    c.rect('silver', px, y - 1, 1, 1);
    c.rect('silver', px, y + h, 1, 1);
  }
  return c.svg();
}

/** Tapiz de hojas colgado de una rama: el árbol blanco con alas de oro sobre el verde. */
function leafTapestry(x, y, w, h) {
  const c = canvas();
  c.rect('ink', x - 3, y - 2, w + 6, 3);
  c.rect('bark', x - 2, y - 1, w + 4, 1);
  c.rect('ink', x, y + 1, w, h);
  c.rect('gold-d', x + 1, y + 2, w - 2, h - 2);
  c.rect('emerald-d', x + 3, y + 4, w - 6, h - 6);
  c.rect('emerald', x + 4, y + 5, w - 8, h - 8);
  const cx = x + Math.floor(w / 2);
  c.rect('silver-l', cx, y + 14, 1, h - 20);
  for (const [dy, half, color] of [
    [8, 3, 'leaf-l'],
    [11, 6, 'leaf'],
    [15, 8, 'leaf-l'],
    [19, 5, 'leaf'],
  ])
    c.rect(color, cx - half, y + dy, half * 2 + 1, 2);
  // Las alas de oro a los lados del tronco.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) c.rect('gold', cx + side * (2 + i), y + 26 + i, 1, 1);
    c.rect('gold', cx + side * 2, y + 27, 1, 2);
  }
  c.rect('leaf-d', x + 4, y + h - 6, w - 8, 2);
  for (let px = x + 1; px < x + w - 1; px += 2) c.rect('gold', px, y + h + 1, 1, 2);
  return c.svg();
}

/** Cofre de raíz: madera plateada abrazada por raíces, cerradura de oro y, encima, una maceta. */
function rootChest(x, bottom) {
  const c = canvas();
  c.rect('ink', x, bottom - 16, 40, 16);
  c.rect('bark', x + 1, bottom - 15, 38, 14);
  c.rect('bark-l', x + 1, bottom - 15, 38, 1);
  c.rect('bark-d', x + 1, bottom - 9, 38, 1);
  // Raíces que bajan por los costados y se abren en el suelo.
  for (const rx of [x + 4, x + 34]) {
    c.rect('bark-d', rx, bottom - 15, 2, 15);
    c.rect('bark-d', rx - 2, bottom - 2, 2, 2);
    c.rect('bark-d', rx + 2, bottom - 1, 2, 1);
  }
  c.rect('ink', x + 18, bottom - 11, 4, 4);
  c.rect('gold', x + 19, bottom - 10, 2, 2);
  c.rect('leaf', x + 10, bottom - 15, 3, 1);
  c.rect('leaf-l', x + 27, bottom - 14, 2, 1);
  const top = canvas();
  top.sprite(SHELF_OBJECTS[0], SHELF_PALETTE, x + 28, bottom - 23);
  top.sprite(SHELF_OBJECTS[4], SHELF_PALETTE, x + 6, bottom - 22);
  return c.svg() + top.svg();
}

/** Una galería que se aleja, de arcos ojivales, con el jardín al fondo (el pasillo). */
function gallery(x, y, w, h) {
  const c = canvas();
  const rings = ['stone-l', 'stone', 'stone-d', 'shelf-back-d'];
  rings.forEach((color, i) => {
    const inset = i * 3;
    const ry = y + Math.round(inset * 0.8);
    const shape = lancetShape(x + inset, ry, w - inset * 2, h - (ry - y));
    fillShape(c, color, shape, x + inset, ry, w - inset * 2, h - (ry - y));
  });
  const inset = 12;
  const ry = y + 10;
  const garden = lancetShape(x + inset, ry, w - inset * 2, h - 10);
  fillShape(c, 'sky-low', garden, x + inset, ry, w - inset * 2, h - 10);
  const mid = x + Math.floor(w / 2);
  c.rect('tree', x + inset, y + h - 10, w - inset * 2, 10);
  c.rect('tree-l', x + inset, y + h - 10, w - inset * 2, 1);
  c.rect('trunk', mid, y + h - 18, 1, 8);
  c.rect('leaf', mid - 2, y + h - 21, 5, 3);
  c.rect('leaf-l', mid - 1, y + h - 22, 3, 1);
  return c.svg();
}

/** Columna esbelta de piedra blanca, como un tronco, con capitel de hojas de oro. */
function column(c, x, bottom) {
  c.rect('stone-d', x, 0, 8, bottom);
  c.rect('stone', x + 1, 0, 6, bottom);
  c.rect('stone-l', x + 1, 0, 1, bottom);
  for (let py = 20; py < bottom - 6; py += 9)
    c.rect('leaf-d', x + 2 + ((py / 9) % 2) * 3, py, 2, 1);
  c.rect('gold', x - 1, 88, 10, 2);
  c.rect('gold-d', x - 1, 90, 10, 1);
  c.rect('leaf', x - 2, 86, 3, 2);
  c.rect('leaf', x + 7, 86, 3, 2);
}

// ------------------------------------------------------------ escenas

const svgScene = (className, body) =>
  `<svg class="px-scene ${className}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${body}</svg>`;

const dusk = `<rect class="px-night" x="0" y="0" width="${W}" height="${H}" style="fill:var(--px-dusk)"/>`;

/**
 * Interior del salón élfico: la escena de la portada (el interior del scriptorium). Las
 * estanterías a los lados, la ventana ojival al bosque, la mesa con el libro abierto y
 * la linterna, hiedra que cuelga y, de noche, luciérnagas y hongos que brillan.
 */
function titleScene() {
  const rnd = random(1605);
  const back = canvas();
  whiteWall(back, 0, 0, W, 142, rnd, { frieze: 4 });
  marbleFloor(back, 0, 142, W, H - 142);
  const shelves = stoneShelf(back, 8, 16, 100, 126, rnd) + stoneShelf(back, 212, 16, 100, 126, rnd);
  const win = { x: 138, y: 16, w: 44, h: 72 };
  const vines = [114, 124, 196, 206].map((vx, i) => ivy(vx, 8, 18 + i * 7, rnd)).join('');
  return svgScene(
    'px-bosque-title',
    `${back.svg()}${shelves}${vines}
    ${dusk}
    ${ogivalWindow(win.x, win.y, win.w, win.h, sky(win.x, win.y, win.w, win.h, rnd) + forest(win.x, win.y, win.w, win.h), 'px-bosque-window')}
    ${lightBeam(win.x + 6, win.y + win.h + 3, win.w - 12, 142, { drift: -34, color: 'beam', mode: 'day' })}
    ${lightBeam(win.x + 6, win.y + win.h + 3, win.w - 12, 142, { drift: 30, color: 'moonbeam', mode: 'night' })}
    ${motes(win.x - 40, win.y + win.h, 70, 50, rnd)}
    ${shrooms(10, 142)}${shrooms(310, 142, true)}
    ${readingTable()}
    ${lantern(121, 34, 26)}${lantern(192, 34, 26)}
    ${glow(201, 125, 44)}${glow(124, 39, 22)}${glow(195, 39, 22)}
    ${fireflies(110, 40, 100, 90, rnd, 12)}`,
  );
}

/**
 * El salón élfico (la gran biblioteca del monasterio): sala alta de piedra blanca, tres
 * ventanas ojivales con vidrios de hoja, oro y plata, columnas como troncos, la galería al
 * jardín, la escalera, faroles, el atril y el arco de ramas.
 */
function hallScene() {
  const rnd = random(2203);
  const back = canvas();
  whiteWall(back, 0, 0, W, 142, rnd, { frieze: 96 });
  marbleFloor(back, 0, 142, W, H - 142);
  for (const px of [131, 181]) column(back, px, 142);
  const shelves =
    stoneShelf(back, 2, 6, 84, 136, rnd, 5) + stoneShelf(back, 236, 6, 54, 136, rnd, 5);
  const panes = {
    leaf: { main: 'leaf', light: 'leaf-l', deep: 'leaf-d', medal: 'gold', ring: 'gold-d' },
    gold: { main: 'gold', light: 'gold-l', deep: 'gold-d', medal: 'leaf', ring: 'silver-l' },
    silver: { main: 'silver', light: 'silver-l', deep: 'silver-d', medal: 'leaf-l', ring: 'gold' },
  };
  const lancets = [
    [100, 'leaf'],
    [150, 'gold'],
    [200, 'silver'],
  ];
  const windows = lancets.map(([lx, color]) => stainedGlass(lx, 12, 20, 74, panes[color])).join('');
  const beams = lancets
    .map(([lx, color]) => {
      const tint = `beam-${color}`;
      return (
        lightBeam(lx, 88, 20, 146, { drift: 10, color: tint, mode: 'day' }) +
        lightPool(lx + 33, 149, 21, 4, tint) +
        lightBeam(lx, 88, 20, 146, { drift: 10, color: 'moonbeam', mode: 'night' })
      );
    })
    .join('');
  const vines = [92, 126, 188, 226].map((vx, i) => ivy(vx, 0, 14 + (i % 2) * 12, rnd)).join('');
  return svgScene(
    'px-monastery px-bosque-hall',
    `${back.svg()}${shelves}${windows}${gallery(146, 98, 28, 44)}${vines}
    ${dusk}
    ${beams}
    ${motes(100, 90, 130, 50, rnd, 14)}
    ${ladder(62, 12, 72, 140)}
    ${branchArch(296, 90, 20, 52)}
    ${shrooms(88, 142)}${shrooms(232, 142, true)}
    ${lampPost(128, 150, 64)}${lampPost(192, 150, 64)}
    ${elvenLectern(160, 154)}
    ${glow(129, 80, 30)}${glow(193, 80, 30)}
    ${fireflies(96, 30, 130, 110, rnd, 14)}`,
  );
}

/**
 * Tu refugio en la copa del árbol (tu estudio): muro de tablones plateados, una rama viva
 * que cruza el techo, la ventana ovalada al bosque con el escritorio debajo, el sillón de
 * musgo con el tocón y su linterna, la alfombra tejida, el tapiz, el cofre de raíz y el
 * arco de ramas.
 */
function refugeScene() {
  const rnd = random(4242);
  const back = canvas();
  plankWall(back, 0, 0, W, 150, rnd);
  plankFloor(back, 0, 150, W, H - 150, rnd);
  // La rama viva que cruza el techo (la viga del estudio), con hojas.
  back.rect('ink', 0, 4, W, 7);
  back.rect('bark-d', 0, 5, W, 5);
  back.rect('bark-l', 0, 5, W, 1);
  const leaves = canvas();
  for (let lx = 3; lx < W; lx += 7 + Math.floor(rnd() * 9)) {
    leaves.rect('leaf', lx, 11, 2, 2 + Math.floor(rnd() * 3));
    leaves.rect('leaf-l', lx + 1, 11, 1, 1);
  }
  const vines = [60, 150, 176].map((vx, i) => ivy(vx, 11, 12 + i * 6, rnd)).join('');
  const win = { cx: 228, cy: 59, rx: 22, ry: 31 };
  const box = { x: win.cx - win.rx, y: win.cy - win.ry, w: win.rx * 2, h: win.ry * 2 };
  return svgScene(
    'px-study px-bosque-refuge',
    `${back.svg()}${leaves.svg()}${vines}${leafTapestry(270, 26, 32, 48)}
    ${dusk}
    ${ovalWindow(win.cx, win.cy, win.rx, win.ry, sky(box.x, box.y, box.w, box.h, rnd) + forest(box.x, box.y, box.w, box.h), 'px-bosque-refuge-window', rnd)}
    ${lightBeam(box.x + 6, box.y + box.h + 3, box.w - 12, 150, { drift: -44, color: 'beam', mode: 'day' })}
    ${lightBeam(box.x + 6, box.y + box.h + 3, box.w - 12, 150, { drift: -40, color: 'moonbeam', mode: 'night' })}
    ${wovenRug(64, 157, 132, 13)}
    ${motes(box.x - 44, box.y + box.h, 60, 50, rnd)}
    ${branchArch(8, 76, 30, 74)}
    ${shrooms(44, 150)}
    ${rootChest(92, 150)}
    ${branchDesk(190, 150)}
    ${stumpTable(256, 150)}
    ${mossChair(272, 150)}
    ${lantern(146, 30, 19)}
    ${glow(263, 125, 40)}${glow(149, 35, 24)}
    ${fireflies(150, 30, 150, 100, rnd, 12)}`,
  );
}

/**
 * El pie del atril donde se abre la ficha del libro (en el Scriptorium, de madera
 * torneada): un tocón de madera plateada con el tablero inclinado, un anillo de oro y las
 * raíces que se abren en el suelo. El libro (HTML) se apoya encima.
 */
function lecternStand() {
  const c = canvas();
  c.rect('ink', 0, 0, 96, 6);
  c.rect('bark', 1, 1, 94, 3);
  c.rect('bark-l', 1, 1, 94, 1);
  c.rect('gold', 1, 4, 94, 1);
  c.rect('ink', 40, 6, 16, 26);
  c.rect('bark', 41, 6, 14, 26);
  c.rect('bark-l', 42, 6, 1, 26);
  c.rect('bark-d', 47, 9, 1, 18);
  c.rect('bark-d', 52, 6, 1, 26);
  c.rect('gold', 41, 15, 14, 2);
  c.rect('gold-d', 41, 16, 14, 1);
  c.rect('leaf', 38, 11, 3, 2);
  c.rect('leaf-l', 55, 21, 3, 2);
  // Raíces.
  c.rect('ink', 22, 32, 52, 6);
  c.rect('bark', 23, 33, 50, 3);
  c.rect('bark-l', 23, 33, 50, 1);
  for (const [rx, rw] of [
    [16, 8],
    [72, 8],
  ]) {
    c.rect('ink', rx, 35, rw, 3);
    c.rect('bark-d', rx + 1, 36, rw - 2, 1);
  }
  return `<svg class="px-lectern" viewBox="0 0 96 38" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${c.svg()}</svg>`;
}

export const Bosque = {
  sprout,
  corner,
  titleScene,
  hallScene,
  refugeScene,
  lecternStand,
};
