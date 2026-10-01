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

// ------------------------------------------------------------ el taller del tapiz
//
// Mientras se genera una voz, una maestra élfica y nueve aprendices la tejen: el tapiz del
// gran árbol se llena fila a fila, de abajo hacia arriba, con el progreso real. Al
// terminar lo enrollan, dos aprendices lo llevan a la canasta del ascensor de lianas, la
// canasta sube, suena la campanilla de cristal y Lumen da una voltereta. Las mismas
// clases que el taller del Scriptorium (.ws-*: poses, idas y vueltas, el que tropieza, el
// dormilón, el festejo): la mecánica y los tiempos son los mismos; cambia el arte. Los
// aprendices visten la capa de la voz (data-voice en el <svg>; ver bosque.css).

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

const TW = 200;
const TH = 40;
const GROUND = 38;
const LOOM = { x: 36, y: 5, w: 58, h: 28 };
const WEFT = 9;
let loomCount = 0;

/** El tapiz del gran árbol: el lago abajo, el tronco, la copa con la biblioteca arriba. */
function tapestry(c) {
  const { x, y, w, h } = LOOM;
  const cx = x + Math.floor(w / 2);
  c.rect('tap-warp', x, y, w, h);
  for (let px = x + 1; px < x + w; px += 2) c.rect('tap-warp-d', px, y, 1, h);
  // Cielo y el sol de la tarde.
  c.rect('tap-sky', x + 2, y + 2, w - 4, 15);
  c.rect('tap-sun', x + 8, y + 5, 4, 4);
  // El lago al pie, con su reflejo.
  c.rect('tap-water', x + 2, y + h - 7, w - 4, 5);
  for (let px = x + 4; px < x + w - 4; px += 6) c.rect('tap-warp', px, y + h - 5, 3, 1);
  // El tronco y las raíces.
  c.rect('tap-bark', cx - 3, y + 12, 6, h - 17);
  c.rect('tap-bark', cx - 6, y + h - 8, 3, 2);
  c.rect('tap-bark', cx + 3, y + h - 8, 3, 2);
  // La copa, en tres capas, y la biblioteca en la cima.
  c.rect('tap-leaf-d', x + 10, y + 9, w - 20, 7);
  c.rect('tap-leaf', x + 13, y + 6, w - 26, 6);
  c.rect('tap-leaf', x + 8, y + 11, 8, 4);
  c.rect('tap-leaf', x + w - 16, y + 11, 8, 4);
  c.rect('gold', cx - 5, y + 3, 10, 1);
  c.rect('tap-warp', cx - 3, y + 4, 6, 2);
  c.rect('gold', cx - 1, y + 2, 2, 1);
  // La guarda de oro.
  c.rect('gold', x, y, w, 1);
  c.rect('gold', x, y, 1, h);
  c.rect('gold', x + w - 1, y, 1, h);
  c.rect('gold', x, y + h - 1, w, 1);
  for (let px = x + 2; px < x + w - 2; px += 4) c.rect('tap-leaf', px, y + h - 2, 2, 1);
}

/** Una rueca en dos poses (la rueda gira): las alterna el CSS como a los elfos. */
function spinningWheel(x, bottom) {
  const frame = canvas();
  frame.rect('elf-o', x + 2, bottom - 4, 9, 2);
  frame.rect('wood-m', x + 3, bottom - 4, 7, 1);
  frame.rect('elf-o', x + 5, bottom - 12, 1, 8);
  const wheel = (spokes) => {
    const c = canvas();
    for (let a = 0; a < 12; a++) {
      const t = (a / 12) * Math.PI * 2;
      c.rect(
        'wood-l',
        Math.round(x + 5 + Math.cos(t) * 4),
        Math.round(bottom - 12 + Math.sin(t) * 4),
        1,
        1,
      );
    }
    for (const [dx, dy] of spokes) c.rect('wood-m', x + 5 + dx, bottom - 12 + dy, 1, 1);
    c.rect('gold', x + 5, bottom - 12, 1, 1);
    return c.svg();
  };
  const plus = [
    [0, -2],
    [0, -1],
    [0, 1],
    [0, 2],
    [-2, 0],
    [-1, 0],
    [1, 0],
    [2, 0],
  ];
  const cross = [
    [-1, -1],
    [-2, -2],
    [1, 1],
    [2, 2],
    [1, -1],
    [2, -2],
    [-1, 1],
    [-2, 2],
  ];
  return `${frame.svg()}<g class="ws-actor ws-toggle" style="--dur:0.4s"><g class="ws-a">${wheel(plus)}</g><g class="ws-b">${wheel(cross)}</g></g>`;
}

/** El caldero de tinte del color de la voz, con su vapor. */
function cauldron(x, bottom) {
  const c = canvas();
  c.sprite(
    ['.oooooo.', 'orrrrrro', 'oddddddo', 'oddddddo', '.oddddo.', 'oo....oo'],
    { o: 'elf-o', r: 'robe', d: 'stone-d' },
    x,
    bottom - 6,
  );
  return c.svg();
}

function loomWorkshop(voice) {
  const uid = `bw${++loomCount}`;
  const set = canvas();
  // El suelo: tablas de madera clara, y una rama arriba a la izquierda (para la hamaca).
  set.rect('elf-o', 0, GROUND, TW, 2);
  set.rect('wood-l', 0, GROUND, TW, 1);
  set.rect('elf-o', 0, 3, 24, 3);
  set.rect('wood-l', 0, 3, 23, 1);
  set.rect('leaf', 2, 6, 3, 2);
  set.rect('leaf-l', 14, 6, 3, 2);
  // La hamaca colgada de la rama.
  const hammock = canvas();
  for (const hx of [3, 19]) hammock.rect('rope', hx, 6, 1, 12);
  for (let hx = 3; hx <= 19; hx++)
    hammock.rect('rope', hx, 18 + Math.round(Math.sin(((hx - 3) / 16) * Math.PI) * 4), 1, 1);
  // El telar: dos postes, el travesaño de arriba y el rodillo de abajo.
  for (const lx of [LOOM.x - 3, LOOM.x + LOOM.w + 1]) {
    set.rect('elf-o', lx, LOOM.y - 3, 2, GROUND - LOOM.y + 3);
    set.rect('wood-l', lx, LOOM.y - 2, 1, GROUND - LOOM.y + 2);
  }
  const beam = (by) => {
    const r = canvas();
    r.rect('elf-o', LOOM.x - 4, by, LOOM.w + 8, 3);
    r.rect('wood-l', LOOM.x - 3, by + 1, LOOM.w + 6, 1);
    r.rect('gold', LOOM.x - 5, by, 2, 3);
    r.rect('gold', LOOM.x + LOOM.w + 3, by, 2, 3);
    return r.svg();
  };
  // El tapiz, y las filas que la página descubre (de abajo hacia arriba).
  const weave = canvas();
  tapestry(weave);
  const clips = [];
  const rowH = Math.ceil(LOOM.h / WEFT);
  for (let i = 0; i < WEFT; i++) {
    const ry = LOOM.y + LOOM.h - rowH * (i + 1);
    clips.push(
      `<rect class="ws-row" data-from="${LOOM.x}" data-to="${LOOM.x + LOOM.w}" x="${LOOM.x}" y="${Math.max(LOOM.y, ry)}" width="0" height="${rowH}"/>`,
    );
  }
  const warp = canvas();
  warp.rect('tap-warp-d', LOOM.x, LOOM.y, LOOM.w, LOOM.h);
  for (let px = LOOM.x + 1; px < LOOM.x + LOOM.w; px += 3)
    warp.rect('tap-warp', px, LOOM.y, 1, LOOM.h);
  // Utilería: el cesto de ovillos y la devanadera.
  const props = canvas();
  props.sprite(
    ['.oooooo.', 'oyyyyyyo', 'oyyoyyyo', '.oooooo.'],
    { o: 'elf-o', y: 'yarn' },
    126,
    GROUND - 4,
  );
  props.rect('elf-o', 140, GROUND - 10, 1, 10);
  props.rect('wood-l', 137, GROUND - 10, 7, 1);
  // El ascensor de lianas a la derecha: cuerdas, la canasta (abajo y, al terminar, subida).
  const lift = canvas();
  lift.rect('elf-o', 180, 0, 20, 2);
  lift.rect('wood-l', 180, 0, 20, 1);
  for (const rx of [184, 196]) lift.rect('rope', rx, 2, 1, GROUND - 2);
  const basket = canvas();
  basket.sprite(
    ['oooooooooooooo', 'owwwwwwwwwwwwo', 'owgggggggggggo', '.owwwwwwwwwwo.', '..oooooooooo..'],
    { o: 'elf-o', w: 'wood-m', g: 'gold' },
    183,
    GROUND - 5,
  );
  const raised = canvas();
  raised.sprite(['..oooooooooo..', '.owwwwwwwwwwo.'], { o: 'elf-o', w: 'wood-m' }, 183, 3);
  // La campanilla de cristal, colgada del travesaño del ascensor.
  const bell = canvas();
  bell.rect('rope', 190, 2, 1, 4);
  bell.sprite(['.cc.', 'cwwc', 'cwwc', '.c..'], { c: 'crystal', w: 'crystal-l' }, 189, 6);

  const weaveP = { a: ELF.weaveA, b: ELF.weaveB, cheer: ELF.cheer };
  const carryP = { a: ELF.carry, b: ELF.carryWalk, cheer: ELF.cheer };
  const crew = [
    // La maestra, señalando el tapiz.
    elf({ a: ELF.maestra, b: ELF.maestraPoint, cheer: ELF.maestraCheer }, 22, GROUND, {
      className: 'ws-toggle ws-master',
      style: '--dur:2.4s',
      hair: 'silver',
    }),
    // Dormido en la hamaca (sus zetas suben).
    elf({ a: ELF.sleep, cheer: ELF.cheer.slice(0, 9) }, 7, 21, {
      className: 'ws-sleeper',
      hair: 'silver',
    }),
    // Tejiendo en el telar, uno a cada lado, pasando la lanzadera.
    elf(weaveP, LOOM.x - 2, GROUND, {
      className: 'ws-toggle ws-jump ws-hand-off',
      style: '--dur:0.5s',
    }),
    elf(weaveP, LOOM.x + LOOM.w - 6, GROUND, {
      className: 'ws-toggle ws-jump',
      style: '--dur:0.6s;animation-delay:-0.2s',
      mirror: true,
      hair: 'dark',
    }),
    // Hilando en la rueca.
    elf(weaveP, 112, GROUND, {
      className: 'ws-toggle ws-jump',
      style: '--dur:0.8s',
      mirror: true,
      hair: 'dark',
    }),
    // Devanando ovillos.
    elf(weaveP, 142, GROUND, {
      className: 'ws-toggle ws-jump',
      style: '--dur:0.45s',
      hair: 'gold',
    }),
    // Traen ovillos, de ida y vuelta; uno se enreda con su hilo y cae.
    `<g class="ws-walker" style="--dist:16px;--dur:7s">${elf(carryP, 120, GROUND, { className: 'ws-toggle ws-jump', style: '--dur:0.35s', hair: 'silver' })}</g>`,
    `<g class="ws-walker ws-trips" style="--dist:14px;--dur:9s">${elf(carryP, 162, GROUND, { className: 'ws-toggle ws-jump', style: '--dur:0.35s', hair: 'dark' })}</g>`,
    // Removiendo el caldero de tinte.
    elf(weaveP, 156, GROUND, {
      className: 'ws-toggle ws-jump',
      style: '--dur:0.7s',
      mirror: true,
      hair: 'gold',
    }),
  ];

  // Los que llevan el tapiz enrollado al ascensor (aparecen al terminar).
  const roll = canvas();
  roll.sprite(
    ['.oooooooooooooooo.', 'gttttttttttttttttg', '.oooooooooooooooo.'],
    { o: 'elf-o', t: 'tap-leaf', g: 'gold' },
    60,
    22,
  );
  const carriers =
    elf({ a: ELF.cheer, b: ELF.cheer }, 60, GROUND, {
      className: 'ws-toggle',
      style: '--dur:0.3s',
    }) +
    elf({ a: ELF.cheer, b: ELF.cheer }, 69, GROUND, {
      className: 'ws-toggle',
      style: '--dur:0.3s;animation-delay:-0.15s',
    });

  const zzz = `<g class="ws-zzz" style="fill:var(--px-wood-l)"><path d="M16 9h2v1h-2zM17 8h1v1h-1z"/><path d="M19 5h2v1h-2zM20 4h1v1h-1z"/></g>`;
  const lumenSvg = lumen().replace(
    '<svg class="px-badge px-lumen"',
    `<svg x="${LOOM.x + LOOM.w / 2 - 6}" y="-2" width="12" height="9" class="px-badge px-lumen ws-lumen"`,
  );

  return `<svg class="px-workshop px-loom" data-voice="${voice}" viewBox="0 0 ${TW} ${TH}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
    <defs><clipPath id="${uid}-weave">${clips.join('')}</clipPath></defs>
    ${set.svg()}${hammock.svg()}${lift.svg()}
    <g class="ws-door-closed">${basket.svg()}</g><g class="ws-door-open">${raised.svg()}</g>
    <g class="ws-bell">${bell.svg()}</g>
    ${props.svg()}${spinningWheel(100, GROUND)}${cauldron(146, GROUND)}
    <g class="ws-sheet">${warp.svg()}<g clip-path="url(#${uid}-weave)">${weave.svg()}</g></g>
    <g class="ws-roller-top">${beam(LOOM.y - 3)}</g><g class="ws-roller-bottom">${beam(LOOM.y + LOOM.h)}</g>
    ${crew.join('')}${zzz}${lumenSvg}
    <g class="ws-carrier" style="--to:118px">${roll.svg()}${carriers}</g>
  </svg>`;
}

// ------------------------------------------------------------ la cuadrilla y el libro que se marchita
//
// Al subir un libro, sube en la canasta del ascensor de lianas con dos elfos que lo cargan
// en alto hasta su hueco (el segundo tropieza con una raíz, .crew-tripper); Lumen va
// adelante alumbrando. Las mismas medidas que la cuadrilla del Scriptorium (48 × 24), así
// que BookCrew.tsx la lleva igual. Al fallar, el lomo se marchita: caen hojas secas (los
// cuadros .px-fire-*, como las llamas) y renace con un brote.

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

function bookCrew() {
  const book = canvas();
  book.sprite(
    LEAF_BOOK,
    { o: 'elf-o', r: 'tap-leaf', d: 'tap-leaf-d', g: 'gold', w: 'tap-warp', b: 'tap-leaf-d' },
    11,
    2,
  );
  const carry = { a: ELF.lift, b: ELF.liftWalk };
  const first = elf(carry, 13, 24, { className: 'ws-toggle', style: '--dur:0.3s', hair: 'gold' });
  const second = elf(carry, 36, 24, {
    className: 'ws-toggle',
    style: '--dur:0.3s;animation-delay:-0.15s',
    hair: 'dark',
  });
  const guide = lumen().replace(
    '<svg class="px-badge px-lumen"',
    '<svg x="0" y="9" width="10" height="7" class="px-badge px-lumen"',
  );
  return `<svg class="px-workshop px-crew" data-voice="gonzalo" viewBox="0 0 48 24" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
    ${guide}
    <g class="crew-load"><g class="crew-book">${book.svg()}</g>${first}<g class="crew-tripper">${second}</g></g>
  </svg>`;
}

/** La canasta del ascensor de lianas en la que llega la cuadrilla (20 × 40; cuerdas arriba). */
function crewLift() {
  const c = canvas();
  for (const rx of [2, 17]) c.rect('rope', rx, 0, 1, 33);
  for (let y = 4; y < 33; y += 7) {
    c.rect('leaf', 1, y, 1, 2);
    c.rect('leaf-l', 18, y + 3, 1, 2);
  }
  c.sprite(
    [
      'oooooooooooooooooooo',
      'owwwwwwwwwwwwwwwwwwo',
      'owggggggggggggggggwo',
      'owmwmwmwmwmwmwmwmwwo',
      '.owwwwwwwwwwwwwwwwo.',
      '..oooooooooooooooo..',
    ],
    { o: 'elf-o', w: 'wood-m', m: 'wood-l', g: 'gold' },
    0,
    33,
  );
  return `<svg class="px-crew-lift" viewBox="0 0 20 39" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${c.svg()}</svg>`;
}

/** El lomo que se marchita: hojas secas que caen, en tres cuadros (como las llamas). */
function wither() {
  const FRAMES = [
    ['..l...d...', '.lw..dl...', '..l.l..d.l', 'd..lw..dl.', '.d..l.l..d', 'dldldldldl'],
    ['....l...d.', '...lw.ldl.', 'l.d..l...d', '.dl..dlw..', 'l..d..l.d.', 'ldldldldld'],
    ['.d....l...', 'dl...lw..l', '..d.l..d..', 'l..dl..lw.', '..l.d..d.l', 'dldldldldl'],
  ];
  const frames = FRAMES.map((rows, i) => {
    const c = canvas();
    c.sprite(rows, { l: 'wither-l', d: 'wither-d', w: 'wither' }, 0, 0);
    return `<g class="px-fire px-fire-${i}">${c.svg()}</g>`;
  });
  return `<svg class="px-flames" viewBox="0 0 10 6" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${frames.join('')}</svg>`;
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

/**
 * El cofre de raíz (20 × 16): madera clara abrazada por raíces, con la cerradura de oro y
 * una hojita. Cerrado, la tapa abombada; abierto, la tapa atrás y los rollitos adentro.
 */
function rootChest() {
  const body = canvas();
  body.rect('elf-o', 0, 7, 20, 9);
  body.rect('wood-m', 1, 8, 18, 7);
  body.rect('wood-l', 1, 8, 18, 1);
  body.rect('wood-d', 1, 14, 18, 1);
  // Las raíces que lo abrazan y se abren en el suelo.
  for (const x of [3, 15]) {
    body.rect('tap-bark', x, 7, 2, 9);
    body.rect('tap-bark', x - 1, 15, 4, 1);
  }
  body.rect('tap-bark', 0, 15, 2, 1);
  body.rect('tap-bark', 18, 15, 2, 1);
  const closed = canvas();
  closed.rect('elf-o', 1, 3, 18, 5);
  closed.rect('elf-o', 0, 5, 20, 3);
  closed.rect('wood-m', 2, 4, 16, 3);
  closed.rect('wood-m', 1, 6, 18, 1);
  closed.rect('wood-l', 2, 4, 16, 1);
  for (const x of [3, 15]) closed.rect('tap-bark', x, 4, 2, 3);
  closed.rect('elf-o', 8, 6, 4, 4);
  closed.rect('gold', 9, 7, 2, 2);
  closed.rect('leaf', 6, 2, 2, 1);
  closed.rect('leaf-l', 7, 1, 1, 1);
  const open = canvas();
  open.rect('elf-o', 1, 0, 18, 8);
  open.rect('wood-d', 2, 1, 16, 5);
  open.rect('wood-m', 2, 1, 16, 1);
  for (const x of [3, 15]) open.rect('tap-bark', x, 1, 2, 5);
  open.rect('elf-o', 1, 6, 18, 2);
  open.rect('yarn', 4, 6, 3, 1);
  open.rect('robe', 8, 6, 3, 1);
  open.rect('gold', 12, 6, 2, 1);
  return `<svg class="px-dl-chest" viewBox="0 0 20 16" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
    ${body.svg()}<g class="dl-lid-closed">${closed.svg()}</g><g class="dl-lid-open">${open.svg()}</g>
  </svg>`;
}

export const Bosque = {
  firefly,
  lecternStand,
  lumen,
  workshop: loomWorkshop,
  bookCrew,
  crewLift,
  wither,
  clothCarrier,
  rootChest,
};
