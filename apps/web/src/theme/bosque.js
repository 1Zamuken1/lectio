// Lectio · las piezas SVG del Bosque élfico (docs/lectio-temas.md §7.10). Las escenas van
// en lienzo (bosque-scenes.js); aquí, lo chico que vive en la interfaz y cambia con la
// paleta de bosque.css: el broche de la enredadera, el retoño, el taller del árbol que
// brota, los mensajeros con la litera, el libro que se vuelve piedra y la raíz que guarda.

import { Pixel } from './pixel';
import { sprout } from './bosque-scenes';

const { canvas } = Pixel;

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
 * Los elfos, al estilo de El Señor de los Anillos: altos y delgados, pelo largo y lacio que
 * cae por los hombros, orejas puntiagudas, diadema de oro, broche de hoja y túnica larga
 * del color de la voz. El color del pelo va por elfo (--px-hair: dorado, plateado o
 * castaño oscuro).
 */
const ELF = {
  stand: [
    '...ooo...',
    '..ohhho..',
    '.ohgggho.',
    '.ohsssho.',
    'sohosohos',
    '.ohsssho.',
    '.hhosohh.',
    '.hrrrrrh.',
    '.hrrbrrh.',
    '.hrrrrrh.',
    '.orrgrro.',
    '.orrrrro.',
    '.orrdrro.',
    '.ordrdro.',
    '..oo.oo..',
  ],
  walk: [
    '...ooo...',
    '..ohhho..',
    '.ohgggho.',
    '.ohsssho.',
    'sohosohos',
    '.ohsssho.',
    '.hhosohh.',
    '.hrrrrrh.',
    '.hrrbrrh.',
    '.hrrrrrh.',
    '.orrgrro.',
    '.orrrrro.',
    '.orrdrro.',
    '.ordrdro.',
    '.oo...oo.',
  ],
  weaveA: [
    '...ooo...',
    '..ohhho..',
    '.ohgggho.',
    '.ohsssho.',
    'sohosohos',
    '.ohsssho.',
    '.hhosohh.',
    '.hrrrrrh.',
    '.hrrbrrh.',
    '.hrrrrrss',
    '.orrgrrkk',
    '.orrrrro.',
    '.orrdrro.',
    '.ordrdro.',
    '..oo.oo..',
  ],
  weaveB: [
    '...ooo...',
    '..ohhho..',
    '.ohgggho.',
    '.ohsssho.',
    'sohosohos',
    '.ohsssho.',
    '.hhosohh.',
    '.hrrrrrh.',
    '.hrrbrrh.',
    '.hrrrrrh.',
    '.orrgrros',
    '.orrrrrkk',
    '.orrdrro.',
    '.ordrdro.',
    '..oo.oo..',
  ],
  carry: [
    '...ooo...',
    '..ohhho..',
    '.ohgggho.',
    '.ohsssho.',
    'sohosohos',
    '.ohsssho.',
    '.hhosohh.',
    '.hrrrrrh.',
    '.hryyrrh.',
    '.hyyyyrso',
    '.orrgrro.',
    '.orrrrro.',
    '.orrdrro.',
    '.ordrdro.',
    '..oo.oo..',
  ],
  carryWalk: [
    '...ooo...',
    '..ohhho..',
    '.ohgggho.',
    '.ohsssho.',
    'sohosohos',
    '.ohsssho.',
    '.hhosohh.',
    '.hrrrrrh.',
    '.hryyrrh.',
    '.hyyyyrso',
    '.orrgrro.',
    '.orrrrro.',
    '.orrdrro.',
    '.ordrdro.',
    '.oo...oo.',
  ],
  cheer: [
    's..ooo..s',
    'so.hhh.os',
    '.ohgggho.',
    '.ohsssho.',
    'sohosohos',
    '.ohsssho.',
    '.hhosohh.',
    '.hrrrrrh.',
    '.hrrbrrh.',
    '.hrrrrrh.',
    '.orrgrro.',
    '.orrrrro.',
    '.orrdrro.',
    '.ordrdro.',
    '..oo.oo..',
  ],
  lift: [
    's..ooo..s',
    'so.hhh.os',
    '.ohgggho.',
    '.ohsssho.',
    'sohosohos',
    '.ohsssho.',
    '.hhosohh.',
    '.hrrrrrh.',
    '.hrrbrrh.',
    '.hrrrrrh.',
    '.orrgrro.',
    '.orrrrro.',
    '.orrdrro.',
    '.ordrdro.',
    '..oo.oo..',
  ],
  liftWalk: [
    's..ooo..s',
    'so.hhh.os',
    '.ohgggho.',
    '.ohsssho.',
    'sohosohos',
    '.ohsssho.',
    '.hhosohh.',
    '.hrrrrrh.',
    '.hrrbrrh.',
    '.hrrrrrh.',
    '.orrgrro.',
    '.orrrrro.',
    '.orrdrro.',
    '.ordrdro.',
    '.oo...oo.',
  ],
  sleep: [
    '...ooo...',
    '..ohhho..',
    '.ohgggho.',
    '.ohsssho.',
    'sohsssohs',
    '.ohsssho.',
    '.hhosohh.',
    '.hrrrrrh.',
    '.hrrbrrh.',
  ],
  maestra: [
    '....ooo....',
    '...ohhho...',
    '..ohgwgho..',
    '..ohsssho..',
    '.sohososhs.',
    '..ohsssho..',
    '..hhosohh..',
    '.hhmmmmmhh.',
    '.hhmmgmmhh.',
    '.hommmmmoh.',
    '.hommmmmmo.',
    '..ogggggo..',
    '.ommmmmmmo.',
    '.ommnmmmmo.',
    '.ommnmmmmo.',
    '.ommnmnmmo.',
    '..ooo.ooo..',
  ],
  maestraPoint: [
    '....ooo....',
    '...ohhho...',
    '..ohgwgho..',
    '..ohsssho..',
    '.sohososhs.',
    '..ohsssho..',
    '..hhosohh..',
    '.hhmmmmmhh.',
    '.hhmmgmmhh.',
    '.hommmmmoss',
    '.hommmmmmo.',
    '..ogggggo..',
    '.ommmmmmmo.',
    '.ommnmmmmo.',
    '.ommnmmmmo.',
    '.ommnmnmmo.',
    '..ooo.ooo..',
  ],
  maestraCheer: [
    's...ooo...s',
    'so.ohhho.os',
    '..ohgwgho..',
    '..ohsssho..',
    '.sohososhs.',
    '..ohsssho..',
    '..hhosohh..',
    '.hhmmmmmhh.',
    '.hhmmgmmhh.',
    '.hommmmmoh.',
    '.hommmmmmo.',
    '..ogggggo..',
    '.ommmmmmmo.',
    '.ommnmmmmo.',
    '.ommnmmmmo.',
    '.ommnmnmmo.',
    '..ooo.ooo..',
  ],
};

const ELF_PALETTE = {
  o: 'elf-o',
  r: 'robe',
  d: 'robe-d',
  s: 'skin',
  b: 'leaf',
  k: 'wood-m',
  y: 'yarn',
  m: 'maestra',
  n: 'maestra-d',
  h: 'hair',
  g: 'gold',
};
const flip = (rows) => rows.map((row) => [...row].reverse().join(''));

/** Un elfo con sus poses (cada una en su grupo, las alterna el CSS del taller). */
function elf(poses, x, bottom, { className = '', style = '', mirror = false, hair = 'gold' } = {}) {
  const groups = Object.entries(poses).map(([pose, rows]) => {
    const c = canvas();
    const sprite = mirror ? flip(rows) : rows;
    c.sprite(sprite, ELF_PALETTE, x, bottom - sprite.length);
    return `<g class="ws-${pose}">${c.svg()}</g>`;
  });
  return `<g class="ws-actor ${className}" style="${style};--px-hair:var(--px-hair-${hair})">${groups.join('')}</g>`;
}

/** El libro gigante, acostado: tapas de hoja, cantos de oro y la hoja grabada en la tapa. */
const LEAF_BOOK = [
  '.ooooooooooooooooooooooooooooooooooo.',
  'ogrrrrrrgrrrrrrrrrrrrrrrrrrrgrrrrrrgo',
  'ogrrrrrrgrrrrrwwwwwwwwwwwrrrgrrrrrrgo',
  'ogrrrrrrgrrrrrwwbbbbbbbwwrrrgrrrrrrgo',
  'ogrrrrrrgrrrrrwwwwwwwwwwwrrrgrrrrrrgo',
  'ogdddddddddddddddddddddddddddddddddgo',
  '.ooooooooooooooooooooooooooooooooooo.',
];

// ------------------------------------------------------------ de lienzo a SVG

/** Un Pix como SVG: un <path> por color, con corridas horizontales. */
function svgOf(pix) {
  const byColor = new Map();
  for (let y = 0; y < pix.h; y++) {
    let run = null;
    for (let x = 0; x <= pix.w; x++) {
      const i = (y * pix.w + x) * 4;
      const key = x < pix.w && pix.d[i + 3] ? `${pix.d[i]},${pix.d[i + 1]},${pix.d[i + 2]}` : null;
      if (run && key !== run.key) {
        if (!byColor.has(run.key)) byColor.set(run.key, []);
        byColor.get(run.key).push(`M${run.start} ${y}h${x - run.start}v1h-${x - run.start}z`);
        run = null;
      }
      if (key && !run) run = { key, start: x };
    }
  }
  return [...byColor].map(([key, d]) => `<path d="${d.join('')}" fill="rgb(${key})"/>`).join('');
}

// ------------------------------------------------------------ el broche y el retoño

/** El broche de hoja de Lórien: la perilla de la enredadera (la barra de progreso). */
const BROOCH = [
  '...s...',
  '..sgs..',
  '.sgGgs.',
  '.sgGgs.',
  'sgGyGgs',
  '.sgGgs.',
  '.sgGgs.',
  '..sgs..',
  '...y...',
  '..yyy..',
];

function brooch() {
  const c = canvas();
  c.sprite(BROOCH, { s: 'silver', g: 'leaf', G: 'leaf-l', y: 'gold' }, 0, 0);
  return `<svg class="px-brooch-thumb" viewBox="0 0 7 10" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${c.svg()}</svg>`;
}

/**
 * El retoño de mallorn (el compañero): dos cuadros de andar (mece las hojas), contento
 * (florece) y triste (se marchita). Los alterna el CSS, como al búho y a Pol.
 */
function retono() {
  const group = (cls, pix) => `<g class="${cls}">${svgOf(pix)}</g>`;
  return `<svg class="px-badge px-sprout" viewBox="0 0 28 30" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${group('sprout-f0', sprout('day', 0, 'idle'))}${group('sprout-f1', sprout('day', 1, 'idle'))}${group('sprout-happy', sprout('day', 1, 'happy'))}${group('sprout-sad', sprout('day', 0, 'sad'))}</svg>`;
}

// ------------------------------------------------------------ el taller: el árbol que brota con un canto
//
// Mientras se genera una voz, un coro de elfos canta y cada nota hace brotar una hoja dorada
// en un mallorn joven: la copa se llena de abajo hacia arriba con el progreso real. La maestra
// dirige, una arpista acompaña, uno trae agua (y tropieza) y otro duerme sobre un cojín. Al
// terminar, el árbol florece, suena la campanilla de cristal y todos festejan. Las mismas
// clases y tiempos que los otros talleres (.ws-*); la túnica es del color de la voz.

const TW = 200;
const TH = 44;
const GROUND = 42;
const CROWN = { x0: 76, x1: 124, y0: 2, y1: 30 };
let treeCount = 0;

function songWorkshop(voice) {
  const uid = `bt${++treeCount}`;
  const set = canvas();
  // el piso de mármol y los dos troncos que enmarcan
  set.rect('elf-o', 0, GROUND, TW, 2);
  set.rect('marble', 0, GROUND, TW, 1);
  for (const x of [2, 194]) {
    set.rect('silver-d', x, 0, 5, GROUND);
    set.rect('silver', x + 1, 0, 3, GROUND);
    set.rect('silver-l', x + 1, 0, 1, GROUND);
  }
  // el macetero de piedra blanca y el mallorn joven
  set.rect('elf-o', 86, GROUND - 8, 28, 8);
  set.rect('marble', 87, GROUND - 7, 26, 6);
  set.rect('gold', 87, GROUND - 4, 26, 1);
  set.rect('silver-d', 99, 14, 3, GROUND - 22);
  set.rect('silver', 100, 14, 1, GROUND - 22);
  for (const [x, y, w] of [
    [92, 22, 8],
    [101, 18, 9],
    [94, 14, 7],
  ])
    set.rect('silver-d', x, y, w, 1);
  // los brotes verdes de siempre y la copa dorada que se descubre por filas
  const buds = canvas();
  const leaves = canvas();
  const spots = [];
  for (let y = CROWN.y0 + 2; y < CROWN.y1; y += 3)
    for (let x = CROWN.x0 + 4 + ((y / 3) % 2) * 2; x < CROWN.x1 - 3; x += 4) {
      const dx = (x - 100) / 24;
      const dy = (y - 16) / 15;
      if (dx * dx + dy * dy < 1) spots.push([x, y]);
    }
  for (const [x, y] of spots) {
    buds.rect('leaf', x, y + 1, 1, 1);
    leaves.sprite(
      ['.gG.', 'gGGd', 'dgg.'],
      { g: 'gleaf', G: 'gleaf-l', d: 'gleaf-d' },
      x - 1,
      y - 1,
    );
  }
  const ROWS = 7;
  const rowH = Math.ceil((CROWN.y1 - CROWN.y0) / ROWS);
  const clips = [];
  for (let i = 0; i < ROWS; i++)
    clips.push(
      `<rect class="ws-row" data-from="${CROWN.x0}" data-to="${CROWN.x1}" x="${CROWN.x0}" y="${CROWN.y1 - rowH * (i + 1)}" width="0" height="${rowH}"/>`,
    );
  // las flores del final
  const blossom = canvas();
  for (const [x, y] of spots.filter((_, i) => i % 3 === 0))
    blossom.sprite(['.w.', 'wyw', '.w.'], { w: 'niphredil', y: 'gold' }, x - 1, y - 2);
  // las notas que suben
  const notes = canvas();
  for (const [x, y] of [
    [62, 24],
    [70, 18],
    [132, 22],
    [126, 14],
    [150, 26],
  ])
    notes.sprite(['.gg', '.g.', 'gg.'], { g: 'gold' }, x, y);
  // el arpa
  const harp = canvas();
  harp.rect('wood-m', 164, GROUND - 14, 1, 14);
  harp.rect('wood-m', 164, GROUND - 14, 7, 1);
  for (let k = 0; k < 6; k++) harp.rect('gold', 165 + k, GROUND - 13 + k * 2, 1, 12 - k * 2);
  // la campanilla de cristal
  const bell = canvas();
  bell.rect('rope', 186, 0, 1, 5);
  bell.sprite(['.cc.', 'cwwc', 'cwwc', '.c..'], { c: 'crystal', w: 'crystal-l' }, 185, 5);
  // el cojín del dormilón
  const cushion = canvas();
  cushion.sprite(
    ['.oooooooooo.', 'orrrrrrrrrro', '.oooooooooo.'],
    { o: 'elf-o', r: 'robe-d' },
    14,
    GROUND - 3,
  );

  const sing = { a: ELF.stand, b: ELF.cheer, cheer: ELF.cheer };
  const carryP = { a: ELF.carry, b: ELF.carryWalk, cheer: ELF.cheer };
  const crew = [
    elf({ a: ELF.maestra, b: ELF.maestraPoint, cheer: ELF.maestraCheer }, 38, GROUND, {
      className: 'ws-toggle ws-master',
      style: '--dur:1.2s',
      hair: 'silver',
    }),
    elf(sing, 52, GROUND, { className: 'ws-toggle ws-jump', style: '--dur:0.9s', hair: 'gold' }),
    elf(sing, 64, GROUND, {
      className: 'ws-toggle ws-jump',
      style: '--dur:0.9s;animation-delay:-0.45s',
      hair: 'dark',
    }),
    elf(sing, 126, GROUND, {
      className: 'ws-toggle ws-jump',
      style: '--dur:1s',
      mirror: true,
      hair: 'silver',
    }),
    elf(sing, 138, GROUND, {
      className: 'ws-toggle ws-jump',
      style: '--dur:1s;animation-delay:-0.5s',
      mirror: true,
      hair: 'gold',
    }),
    elf({ a: ELF.weaveA, b: ELF.weaveB, cheer: ELF.cheer }, 170, GROUND, {
      className: 'ws-toggle ws-jump',
      style: '--dur:0.6s',
      mirror: true,
      hair: 'dark',
    }),
    elf({ a: ELF.sleep, cheer: ELF.cheer.slice(0, 9) }, 15, GROUND - 2, {
      className: 'ws-sleeper',
      hair: 'gold',
    }),
    `<g class="ws-walker ws-trips" style="--dist:14px;--dur:8s">${elf(carryP, 150, GROUND, { className: 'ws-toggle ws-jump', style: '--dur:0.35s', hair: 'silver' })}</g>`,
  ];
  const zzz = `<g class="ws-zzz" style="fill:var(--px-wood-l)"><path d="M26 30h2v1h-2zM27 29h1v1h-1z"/><path d="M29 26h2v1h-2zM30 25h1v1h-1z"/></g>`;
  const companion = retono().replace(
    '<svg class="px-badge px-sprout"',
    `<svg x="106" y="${GROUND - 20}" width="12" height="13" class="px-badge px-sprout ws-sprout"`,
  );
  return `<svg class="px-workshop px-song" data-voice="${voice}" viewBox="0 0 ${TW} ${TH}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
    <defs><clipPath id="${uid}-grow">${clips.join('')}</clipPath></defs>
    ${set.svg()}${cushion.svg()}${harp.svg()}<g class="ws-bell">${bell.svg()}</g>
    ${buds.svg()}<g class="ws-sheet" clip-path="url(#${uid}-grow)">${leaves.svg()}</g>
    <g class="ws-blossom">${blossom.svg()}</g><g class="ws-notes">${notes.svg()}</g>
    ${crew.join('')}${zzz}${companion}
  </svg>`;
}

// ------------------------------------------------------------ la cuadrilla y el libro que se vuelve piedra
//
// Al subir un libro, dos mensajeros élficos lo traen en una litera (dos varas al hombro)
// hasta su hueco; el segundo tropieza (.crew-tripper). Las mismas medidas que la cuadrilla
// del Scriptorium (48 × 24), así que BookCrew.tsx la lleva igual. Al fallar, el libro pierde
// su luz y se vuelve piedra (los cuadros .px-fire-*, como las llamas) y vuelve a brillar.

function bookCrew() {
  const load = canvas();
  // la litera: las varas, la tabla con su tela y el libro encima
  load.rect('elf-o', 9, 11, 40, 2);
  load.rect('wood-l', 9, 11, 40, 1);
  load.rect('robe', 18, 9, 22, 2);
  load.rect('gold', 18, 9, 22, 1);
  load.sprite(
    LEAF_BOOK.slice(0, 5).map((r) => r.slice(5, 32)),
    { o: 'elf-o', r: 'tap-leaf', d: 'tap-leaf-d', g: 'gold', w: 'tap-warp', b: 'tap-leaf-d' },
    15,
    4,
  );
  const carry = { a: ELF.lift, b: ELF.liftWalk };
  const first = elf(carry, 8, 24, { className: 'ws-toggle', style: '--dur:0.3s', hair: 'gold' });
  const second = elf(carry, 36, 24, {
    className: 'ws-toggle',
    style: '--dur:0.3s;animation-delay:-0.15s',
    hair: 'silver',
  });
  return `<svg class="px-workshop px-crew" data-voice="gonzalo" viewBox="0 0 48 24" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
    <g class="crew-load"><g class="crew-book">${load.svg()}</g>${first}<g class="crew-tripper">${second}</g></g>
  </svg>`;
}

/** El libro que pierde su luz: esquirlas de piedra que caen y chispitas de oro, en tres cuadros. */
function stone() {
  const FRAMES = [
    ['..s...g...', '.sS..s....', '..s.g..s.S', 's..sS..s..', '.s..s.S..s', 'SsSsSsSsSs'],
    ['....s...g.', '...sS.s.s.', 's.g..s...S', '.ss..sS...', 's..s..s.s.', 'sSsSsSsSsS'],
    ['.g....s...', 'sS...sS..s', '..s.s..g..', 's..ss..sS.', '..s.s..s.s', 'SsSsSsSsSs'],
  ];
  const frames = FRAMES.map((rows, i) => {
    const c = canvas();
    c.sprite(rows, { s: 'stone', S: 'stone-d', g: 'gold' }, 0, 0);
    return `<g class="px-fire px-fire-${i}">${c.svg()}</g>`;
  });
  return `<svg class="px-flames" viewBox="0 0 10 6" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${frames.join('')}</svg>`;
}

// ------------------------------------------------------------ las descargas: la raíz que guarda

/**
 * La raíz que guarda (20 × 16): una raíz que se arquea al pie del atril con un hueco; cerrada,
 * la abraza la corteza con una hojita; abierta, se ven los rollitos guardados con su luz.
 */
function rootStore() {
  const body = canvas();
  body.sprite(
    [
      '......oooooooo......',
      '....oobbbbbbbboo....',
      '...obbBBBBBBBBbbo...',
      '..obBBbbbbbbbbBBbo..',
      '.obBbb........bbBbo.',
      '.obBb..........bBbo.',
      'obBb............bBbo',
      'obBb............bBbo',
      'obBb............bBbo',
      'obBb............bBbo',
      'obBbb..........bbBbo',
      'oobBbbbbbbbbbbbbbBoo',
      'oooooooooooooooooooo',
    ],
    { o: 'elf-o', b: 'tap-bark', B: 'wood-m' },
    0,
    3,
  );
  body.rect('leaf', 8, 1, 2, 1);
  body.rect('leaf-l', 10, 0, 1, 1);
  const closed = canvas();
  closed.rect('tap-bark', 4, 7, 12, 7);
  for (let x = 5; x < 15; x += 3) closed.rect('wood-m', x, 8, 1, 5);
  closed.rect('gold', 9, 10, 2, 2);
  const open = canvas();
  open.rect('elf-o', 4, 7, 12, 7);
  open.rect('yarn', 5, 10, 3, 3);
  open.rect('robe', 9, 10, 3, 3);
  open.rect('gold', 13, 10, 2, 3);
  open.rect('firefly', 7, 8, 1, 1);
  open.rect('firefly', 12, 8, 1, 1);
  return `<svg class="px-dl-chest" viewBox="0 0 20 16" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
    ${body.svg()}<g class="dl-lid-closed">${closed.svg()}</g><g class="dl-lid-open">${open.svg()}</g>
  </svg>`;
}

// ------------------------------------------------------------ las descargas en escena
//
// Al descargar, un elfo por capítulo lleva su rollito de tela hasta el cofre de raíz al
// pie del atril (DownloadCrew.tsx): camina según el avance real y, al llegar, el cofre se
// abre, lo guarda y se cierra. Visten la túnica de la voz que se descarga (data-voice).
// Las mismas clases que el arcón del Scriptorium (dl-walker, dl-cheer, dl-lid-*).

/** El elfo con su rollito de tela, de pie y caminando (12 × 15). */
const CLOTH_CARRY = {
  a: ELF.stand.map(
    (row, i) =>
      row +
      [
        '...',
        '...',
        '...',
        '...',
        '...',
        '...',
        '...',
        'oto',
        'oto',
        'ogo',
        'oto',
        'oto',
        '...',
        '...',
        '...',
      ][i],
  ),
  b: ELF.walk.map(
    (row, i) =>
      row +
      [
        '...',
        '...',
        '...',
        '...',
        '...',
        '...',
        '...',
        'oto',
        'oto',
        'ogo',
        'oto',
        'oto',
        '...',
        '...',
        '...',
      ][i],
  ),
};

function clothCarrier(voice = '') {
  const walker = elf(
    {
      a: CLOTH_CARRY.a.map((r) => r.replace(/t/g, 'y')),
      b: CLOTH_CARRY.b.map((r) => r.replace(/t/g, 'y')),
    },
    0,
    15,
    { className: 'ws-toggle', style: '--dur:0.3s', hair: voice.length % 2 ? 'gold' : 'silver' },
  );
  const cheer = elf({ a: ELF.cheer }, 1, 15, { hair: voice.length % 2 ? 'gold' : 'silver' });
  return `<svg class="px-workshop px-dl-carrier" data-voice="${voice}" viewBox="0 0 12 15" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
    <g class="dl-walker">${walker}</g><g class="dl-cheer">${cheer}</g>
  </svg>`;
}

export const Bosque = {
  brooch,
  lecternStand,
  sprout: retono,
  workshop: songWorkshop,
  bookCrew,
  stone,
  clothCarrier,
  rootStore,
};
