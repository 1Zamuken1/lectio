// Lectio · motor de pixel art (docs/lectio-temas.md §3.4). Los sprites son cuadrículas
// de caracteres; cada carácter es un color de la paleta del tema (variables CSS --px-*),
// así que día y noche son solo un cambio de variables: el dibujo no se regenera.
// Salida: SVG con un <path> por color (runs horizontales), nítido a cualquier escala.
// Portado de apps/cli/assets/theme/pixel.js como módulo ES (la CLI conserva su copia).

// ------------------------------------------------------------ utilidades

/** Generador pseudoaleatorio con semilla: la escena es siempre la misma. */
function random(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Lienzo de píxeles: acumula rectángulos por color y los emite como paths. */
function canvas() {
  const byColor = new Map();
  const add = (color, x, y, w = 1, h = 1) => {
    if (w <= 0 || h <= 0) return;
    if (!byColor.has(color)) byColor.set(color, []);
    byColor.get(color).push(`M${x} ${y}h${w}v${h}h${-w}z`);
  };
  return {
    rect: add,
    /** Sprite de cuadrícula en (x, y). `palette` traduce caracteres a colores. */
    sprite(rows, palette, x, y) {
      rows.forEach((row, dy) => {
        let run = null;
        for (let dx = 0; dx <= row.length; dx++) {
          const color = palette[row[dx]] ?? null;
          if (run && color !== run.color) {
            add(run.color, x + run.start, y + dy, dx - run.start, 1);
            run = null;
          }
          if (color && !run) run = { color, start: dx };
        }
      });
    },
    svg(className = '') {
      const paths = [...byColor]
        .map(([color, parts]) => `<path d="${parts.join('')}" style="fill:var(--px-${color})"/>`)
        .join('');
      return className ? `<g class="${className}">${paths}</g>` : paths;
    },
  };
}

// ------------------------------------------------------------ sprites del scriptorium

const OWL = {
  palette: {
    o: 'ink',
    b: 'owl',
    d: 'owl-d',
    l: 'owl-l',
    w: 'eye',
    p: 'ink',
    k: 'gold',
    f: 'gold-d',
  },
  body: [
    '..oo........oo..',
    '.obbo......obbo.',
    '.obbbbbbbbbbbbo.',
    'obbddbbbbbbddbbo',
    null, // ojos: filas 4 a 7, según el fotograma
    null,
    null,
    null,
    'obbdddbbbbdddbbo',
    '.obbllllllllbbo.',
    '.obldlldlldldbo.',
    '.obllllllllllbo.',
    '.obbldlldlldbbo.',
    '..obbllllllbbo..',
    '...oobbbbbboo...',
    '....ff....ff....',
  ],
  open: ['obdwwwdbbdwwwdbo', 'obwppwwbbwwppwbo', 'obwppwwkkwwppwbo', 'obdwwwdkkdwwwdbo'],
  closed: ['obdbbbdbbdbbbdbo', 'obbbbbbbbbbbbbbo', 'obdoodbkkbdoodbo', 'obbbbbbkkbbbbbbo'],
};

/** Búho escriba: cuerpo + dos juegos de ojos (el parpadeo lo hace el CSS). */
function owl(x, y) {
  const withEyes = (eyes) => OWL.body.map((row, i) => row ?? eyes[i - 4]);
  const open = canvas();
  open.sprite(withEyes(OWL.open), OWL.palette, x, y);
  const closed = canvas();
  closed.sprite(withEyes(OWL.closed), OWL.palette, x, y);
  return `<g class="px-owl"><g class="px-owl-open">${open.svg()}</g><g class="px-owl-closed">${closed.svg()}</g></g>`;
}

const CANDLE = {
  palette: {
    f: 'flame',
    y: 'flame-core',
    n: 'ink',
    o: 'ink',
    w: 'parch',
    l: 'parch-d',
    g: 'gold',
    h: 'gold-d',
  },
  flames: [
    ['...f....', '..fyf...', '..fyf...', '...n....'],
    ['....f...', '...fyf..', '..fyf...', '...n....'],
  ],
  body: [
    '.oooooo.',
    '.owwwlo.',
    '.owwwlo.',
    '.owwwlo.',
    '.owwwlo.',
    '.owwwlo.',
    '.owwwlo.',
    'oggggggo',
    '.ohhhho.',
    '..oooo..',
  ],
};

function candle(x, y) {
  const body = canvas();
  body.sprite(CANDLE.body, CANDLE.palette, x, y + 4);
  const frames = CANDLE.flames.map((flame, i) => {
    const c = canvas();
    c.sprite(flame, CANDLE.palette, x, y);
    return `<g class="px-flame px-flame-${i}">${c.svg()}</g>`;
  });
  return `<g class="px-candle">${frames.join('')}${body.svg()}</g>`;
}

const QUILL = [
  '.......oo.',
  '......owwo',
  '.....owwso',
  '....owwso.',
  '...owwso..',
  '..owwso...',
  '..owso....',
  '.owo......',
  '.oo.......',
  'o.........',
];
const INKWELL = ['..oooo..', '..okko..', '.okkkko.', 'okkkkkko', 'okhkkkko', '.oooooo.'];

function inkwellWithQuill(x, y) {
  const c = canvas();
  c.sprite(QUILL, { o: 'ink', w: 'parch', s: 'parch-d' }, x + 3, y);
  c.sprite(INKWELL, { o: 'ink', k: 'inkwell', h: 'stone-l' }, x, y + 9);
  return c.svg();
}

/** Libro abierto sobre el atril: dos páginas, pliegue central, renglones y una inicial roja. */
function openBook(x, y, w = 34, h = 11) {
  const c = canvas();
  const mid = Math.floor(w / 2);
  c.rect('ink', x + 1, y, mid - 2, 1);
  c.rect('ink', x + mid + 1, y, w - mid - 2, 1);
  c.rect('ink', x, y + 1, 1, h - 2);
  c.rect('ink', x + w - 1, y + 1, 1, h - 2);
  c.rect('parch', x + 1, y + 1, w - 2, h - 2);
  c.rect('parch-d', x + mid - 1, y + 1, 2, h - 2);
  c.rect('ink', x + 1, y + h - 1, w - 2, 1);
  for (let line = 0; line < 3; line++) {
    const ly = y + 3 + line * 2;
    c.rect('text', x + 3 + (line === 0 ? 3 : 0), ly, mid - 6 - (line === 0 ? 3 : 0), 1);
    c.rect('text', x + mid + 3, ly, w - mid - 6 - (line === 2 ? 4 : 0), 1);
  }
  c.rect('red', x + 3, y + 2, 2, 3); // inicial iluminada
  c.rect('gold', x + 5, y + 2, 1, 1);
  return c.svg();
}

// ------------------------------------------------------------ piezas generadas

function stoneWall(c, x, y, w, h, rnd) {
  c.rect('mortar', x, y, w, h);
  const brickH = 6;
  for (let row = 0; row * brickH < h; row++) {
    const by = y + row * brickH;
    const offset = row % 2 ? -6 : 0;
    for (let bx = x + offset; bx < x + w; bx += 12) {
      const left = Math.max(bx, x);
      const right = Math.min(bx + 11, x + w);
      const tone = rnd() < 0.18 ? 'stone-d' : rnd() < 0.12 ? 'stone-l' : 'stone';
      c.rect(tone, left, by, right - left, Math.min(brickH - 1, y + h - by));
      if (tone !== 'stone-l') c.rect('stone-l', left, by, 1, 1);
    }
  }
}

function floor(c, x, y, w, h, rnd) {
  for (let row = 0; row * 5 < h; row++) {
    const py = y + row * 5;
    c.rect(row % 2 ? 'wood' : 'wood-d', x, py, w, 5);
    for (let seam = x + ((row * 17) % 23); seam < x + w; seam += 23 + Math.floor(rnd() * 14))
      c.rect('ink', seam, py, 1, 5);
    c.rect('wood-l', x, py, w, 1);
  }
}

/** Lomos: color base, luz (borde izquierdo) y sombra (borde derecho), para dar volumen. */
const SPINES = [
  ['red', 'red-l', 'red-d'],
  ['blue', 'blue-l', 'blue-d'],
  ['green', 'green-l', 'green-d'],
  ['leather', 'leather-l', 'leather-d'],
  ['plum', 'plum-l', 'plum-d'],
  ['red-d', 'red', 'ink'],
  ['parch-d', 'parch', 'leather-d'],
  ['leather', 'leather-l', 'leather-d'],
];

/** Objetos de monasterio entre los libros (se apoyan en la tabla del estante). */
const SHELF_PALETTE = {
  o: 'ink',
  w: 'parch',
  l: 'parch-d',
  g: 'gold',
  h: 'gold-d',
  b: 'blue',
  e: 'green',
  r: 'red',
  k: 'inkwell',
  s: 'stone-l',
  f: 'flame',
  y: 'flame-core',
};
const SHELF_OBJECTS = [
  // Pergaminos enrollados, apilados, con cinta roja.
  ['...ooooooo.', '..olwwrwwlo', '...ooooooo.', '.ooooooo...', 'olwwrwwlo..', '.ooooooo...'],
  // Reloj de arena.
  [
    'hhhhhhh',
    '.o...o.',
    '.ogggo.',
    '..ogo..',
    '...o...',
    '..o.o..',
    '.o.g.o.',
    '.ogggo.',
    'hhhhhhh',
  ],
  // Globo terráqueo sobre su pie.
  [
    '..ooo..',
    '.obbeo.',
    'obbeeeo',
    'obeebbo',
    'obbbeeo',
    '.obbbo.',
    '..ooo..',
    '...h...',
    '..hhh..',
  ],
  // Cráneo.
  ['.ooooo.', 'owwwwwo', 'owwwwwo', 'oowowoo', 'owwwwwo', '.owowo.', '..ooo..'],
  // Cabo de vela.
  ['..f..', '.fyf.', '..o..', '.owo.', '.owo.', '.owo.', 'ohhho'],
  // Tintero con pluma.
  ['.....o', '....ow', '...ow.', '..ow..', '.okko.', 'okkkko', 'okskko', '.oooo.'],
  // Libros acostados, uno sobre otro.
  ['.oooooooo.', '.orrrrrro.', 'oooooooooo', 'obbbbbbbbo', 'ogggggggo.', 'oooooooooo'],
];

/**
 * Un libro de pie en su propia capa (el lienzo agrupa por color, así que compartirlo
 * dejaría los dorados debajo de los lomos): contorno de tinta, luz y sombra, cabezada,
 * nervios dorados y, según el libro, etiqueta del título o un florón grabado en oro.
 */
function book(bx, base, bw, bh, [color, light, dark], rnd) {
  const c = canvas();
  const bands = bh > 22 ? 3 : 2;
  const ornament = rnd();
  const labelColor = rnd() < 0.5 ? 'parch' : 'ink';
  const top = base - bh;
  c.rect('ink', bx, top, bw, bh);
  c.rect(color, bx + 1, top + 1, bw - 2, bh - 2);
  c.rect(light, bx + 1, top + 1, 1, bh - 2);
  c.rect(dark, bx + bw - 2, top + 1, 1, bh - 2);
  c.rect(light, bx + 1, top + 1, bw - 2, 1); // cabezada
  // Nervios: bandas en relieve (oro con su sombra).
  const bandRows = [];
  for (let b = 0; b < bands; b++) {
    const at = top + Math.round(3 + (b * (bh - 7)) / Math.max(1, bands - 1));
    bandRows.push(at);
    c.rect('gold', bx + 1, at, bw - 2, 1);
    c.rect('gold-d', bx + 1, at + 1, bw - 2, 1);
  }
  // Entre los dos primeros nervios: etiqueta con el título, o un florón de oro.
  const from = bandRows[0] + 3;
  const to = (bandRows[1] ?? base) - 2;
  if (to - from >= 3 && bw >= 5) {
    const mid = Math.floor((from + to) / 2);
    if (ornament < 0.5) {
      c.rect(labelColor, bx + 2, mid - 1, bw - 4, 3);
      if (bw >= 6) c.rect(labelColor === 'ink' ? 'gold' : 'ink', bx + 3, mid, bw - 6, 1);
    } else if (ornament < 0.8) {
      const cx = bx + Math.floor(bw / 2);
      c.rect('gold', cx, mid - 1, 1, 3);
      c.rect('gold', cx - 1, mid, 3, 1);
    }
  }
  return c.svg();
}

/**
 * Estantería tallada: cornisa con dentículos y remate, postes con molduras, fondo de
 * tablones y tres estantes con libros detallados y, de vez en cuando, un objeto. El
 * mueble va en `c`; libros, objetos y la penumbra de cada estante se devuelven como
 * capas aparte, para pintarlos encima.
 */
function bookshelf(c, x, y, w, h, rnd, shelves = 3) {
  const layers = [];
  const shade = canvas();
  const post = 5;
  const cornice = 9;
  const plinth = 6;
  const inner = { x: x + post, y: y + cornice, w: w - post * 2, h: h - cornice - plinth };

  // Fondo: tablones verticales con juntas.
  c.rect('wood-d', inner.x, inner.y, inner.w, inner.h);
  for (let px = inner.x + 3; px < inner.x + inner.w; px += 9)
    c.rect('ink', px, inner.y, 1, inner.h);

  // Postes laterales con moldura (filo claro, cuerpo, sombra) y muescas talladas.
  for (const px of [x, x + w - post]) {
    c.rect('ink', px, y, post, h);
    c.rect('wood', px + 1, y + 1, post - 2, h - 2);
    c.rect('wood-l', px + 1, y + 1, 1, h - 2);
    c.rect('wood-d', px + post - 2, y + 1, 1, h - 2);
    for (let ny = y + cornice + 6; ny < y + h - plinth - 4; ny += 12) {
      c.rect('wood-d', px + 2, ny, 1, 3);
      c.rect('gold-d', px + 2, ny + 1, 1, 1);
    }
  }

  // Cornisa: tres molduras, dentículos y un remate dorado al centro.
  c.rect('ink', x - 2, y, w + 4, cornice);
  c.rect('wood-l', x - 1, y + 1, w + 2, 1);
  c.rect('wood', x - 1, y + 2, w + 2, 2);
  c.rect('wood-d', x - 1, y + 4, w + 2, 1);
  for (let dx = x; dx < x + w - 1; dx += 4) c.rect('wood-l', dx + 1, y + 5, 2, 2);
  c.rect('wood-d', x - 1, y + 7, w + 2, 1);
  const crest = canvas();
  crest.sprite(
    ['..g..', '.ggg.', 'ghggh', '.ggg.'],
    { g: 'gold', h: 'gold-d' },
    x + Math.floor(w / 2) - 2,
    y - 4,
  );
  layers.push(crest.svg());

  // Zócalo.
  c.rect('ink', x - 1, y + h - plinth, w + 2, plinth);
  c.rect('wood', x, y + h - plinth + 1, w, plinth - 2);
  c.rect('wood-l', x, y + h - plinth + 1, w, 1);

  const gap = Math.floor(inner.h / shelves);
  for (let s = 0; s < shelves; s++) {
    const base = inner.y + gap * (s + 1) - 4;
    // Penumbra bajo la tabla de arriba (se pinta sobre las cabezas de los libros).
    shade.rect('shade', inner.x, base - gap + 4, inner.w, 3);
    // Tabla: canto claro, cuerpo y sombra.
    c.rect('ink', inner.x, base, inner.w, 4);
    c.rect('wood-l', inner.x, base, inner.w, 1);
    c.rect('wood', inner.x, base + 1, inner.w, 2);

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
        bx += 3 + Math.floor(rnd() * 3); // hueco
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

/** Forma del vano: rectángulo coronado por un arco de medio punto. */
function archShape(x, y, w, h) {
  const r = w / 2;
  return (px, py) => {
    if (py < y || py >= y + h) return false;
    if (py >= y + r) return px >= x && px < x + w;
    const dy = y + r - py - 0.5;
    const half = Math.sqrt(Math.max(0, r * r - dy * dy));
    return px + 0.5 >= x + r - half && px + 0.5 <= x + r + half;
  };
}

/** El vano como un solo path (para recortar el paisaje y el cielo). */
function archPath(x, y, w, h) {
  const inside = archShape(x, y, w, h);
  let d = '';
  for (let py = y; py < y + h; py++) {
    let start = null;
    for (let px = x; px <= x + w; px++) {
      const hit = px < x + w && inside(px, py);
      if (hit && start === null) start = px;
      if (!hit && start !== null) {
        d += `M${start} ${py}h${px - start}v1h${start - px}z`;
        start = null;
      }
    }
  }
  return d;
}

/**
 * Ventanal gótico: marco de piedra, rosetón emplomado en el arco y, por el vidrio, el
 * cielo y el paisaje (`view`, ya recortado a la forma del vano).
 */
function archWindow(x, y, w, h, view, clipId = 'px-window-clip') {
  const inside = archShape(x, y, w, h);
  const r = w / 2;
  const frame = canvas();
  const glass = canvas();
  for (let py = y - 3; py < y + h + 3; py++) {
    for (let px = x - 3; px < x + w + 3; px++) {
      const inGlass = inside(px, py);
      const inFrame =
        !inGlass &&
        (inside(px - 3, py) ||
          inside(px + 3, py) ||
          inside(px, py + 3) ||
          (py >= y + h && py < y + h + 3 && px >= x - 3 && px < x + w + 3));
      if (inFrame) frame.rect(py >= y + h ? 'stone-d' : 'stone-l', px, py, 1, 1);
      else if (inGlass) {
        const band = (py - y) / h;
        glass.rect(band < 0.3 ? 'sky-top' : band < 0.55 ? 'sky' : 'sky-low', px, py, 1, 1);
      }
    }
  }

  // Rosetón en el arco: un círculo de vidrios de color con emplomado radial.
  const rose = canvas();
  const lead = canvas();
  const cx = x + r - 0.5;
  const cy = y + r - 4.5;
  const radius = 7.5;
  const PANES = ['red', 'blue', 'gold', 'blue', 'red', 'green', 'gold', 'green'];
  for (let py = Math.floor(cy - radius); py <= cy + radius; py++) {
    for (let px = Math.floor(cx - radius); px <= cx + radius; px++) {
      const dx = px - cx;
      const dy = py - cy;
      const d = Math.hypot(dx, dy);
      if (d > radius + 0.4) continue;
      const angle = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI); // 0..1
      const sector = Math.floor(angle * 8) % 8;
      const onSpoke = Math.abs(angle * 8 - Math.round(angle * 8)) < 0.12 && d > 2;
      if (d > radius - 0.8 || d < 1.6 || onSpoke) lead.rect('lead', px, py, 1, 1);
      else if (d < 3) rose.rect('gold', px, py, 1, 1);
      else rose.rect(PANES[sector], px, py, 1, 1);
    }
  }
  // Emplomado del vano: parteluz y dos travesaños (dejan ver el paisaje).
  lead.rect(
    'lead',
    x + Math.floor(w / 2),
    Math.ceil(cy + radius),
    1,
    y + h - Math.ceil(cy + radius),
  );
  for (const ly of [y + r + 12, y + r + 36]) if (ly < y + h) lead.rect('lead', x, ly, w, 1);

  return `${glass.svg()}
    <defs><clipPath id="${clipId}"><path d="${archPath(x, y, w, h)}"/></clipPath></defs>
    <g clip-path="url(#${clipId})">${view}</g>
    ${rose.svg()}${lead.svg()}${frame.svg()}`;
}

/** Cielo: de día sol, nubes que pasan y pájaros; de noche luna y estrellas. */
function sky(x, y, w, h, rnd) {
  const day = canvas();
  day.rect('sun', x + w - 13, y + 24, 6, 6);
  day.rect('sun', x + w - 14, y + 25, 8, 4);

  const cloud = (cx, cy, width) => {
    const c = canvas();
    c.rect('cloud', cx + 2, cy, width - 5, 1);
    c.rect('cloud', cx, cy + 1, width, 2);
    c.rect('cloud-d', cx + 1, cy + 3, width - 2, 1);
    return c.svg();
  };
  const clouds = [
    [x - 4, y + 30, 12, 70, 0],
    [x + 18, y + 20, 9, 95, -40],
    [x + 30, y + 38, 14, 80, -20],
  ]
    .map(
      ([cx, cy, cw, secs, delay]) =>
        `<g class="px-day px-cloud" style="animation-duration:${secs}s;animation-delay:${delay}s">${cloud(cx, cy, cw)}</g>`,
    )
    .join('');

  // Pájaros: una "v" de tres píxeles con dos poses (alas arriba y abajo).
  const bird = (bx, by) =>
    `<path class="px-wing-up" d="M${bx} ${by}h1v1h-1zM${bx + 1} ${by + 1}h1v1h-1zM${bx + 2} ${by}h1v1h-1z"/>` +
    `<path class="px-wing-down" d="M${bx} ${by + 1}h1v1h-1zM${bx + 1} ${by}h1v1h-1zM${bx + 2} ${by + 1}h1v1h-1z"/>`;
  const birds = `<g class="px-day px-birds" style="fill:var(--px-bird)">${bird(x - 6, y + 33)}${bird(x - 11, y + 36)}${bird(x - 2, y + 37)}</g>`;

  const night = canvas();
  night.rect('moon', x + 9, y + 22, 5, 6);
  night.rect('moon', x + 8, y + 23, 7, 4);
  night.rect('sky-top', x + 11, y + 22, 3, 4); // luna menguante
  const stars = [];
  for (let i = 0; i < 12; i++) {
    const sx = x + 2 + Math.floor(rnd() * (w - 4));
    const sy = y + 4 + Math.floor(rnd() * (h * 0.45));
    stars.push(
      `<path class="px-star" style="animation-delay:${(rnd() * 3).toFixed(2)}s;fill:var(--px-star)" d="M${sx} ${sy}h1v1h-1z"/>`,
    );
  }
  return `<g class="px-day">${day.svg()}</g>${clouds}${birds}<g class="px-night">${night.svg()}${stars.join('')}</g>`;
}

/**
 * Paisaje por el ventanal: colinas lejanas, colinas con campos en mosaico, un pueblo con
 * su iglesia y un camino que baja serpenteando. De noche, las ventanas se encienden.
 */
function landscape(x, y, w, h) {
  const c = canvas();
  const bottom = y + h;
  const wave = (px, base, parts) =>
    base +
    Math.round(
      parts.reduce((sum, [amp, len, phase]) => sum + amp * Math.sin((px - x) / len + phase), 0),
    );
  const far = (px) =>
    wave(px, y + 43, [
      [2.2, 5.5, 0],
      [1.3, 2.7, 1],
    ]);
  const mid = (px) =>
    wave(px, y + 52, [
      [2.6, 7, 1.2],
      [0.8, 3, 0],
    ]);
  const near = (px) => wave(px, y + 63, [[1.8, 8, 2.4]]);

  for (let px = x; px < x + w; px++) {
    c.rect('hill-far', px, far(px), 1, bottom - far(px));
    const top = mid(px);
    c.rect('hill', px, top, 1, bottom - top);
    c.rect('hill-d', px, top, 1, 1); // borde de la colina
    // Campos en mosaico: parcelas de 5×3 alternando dos tonos (y algunas verdes).
    for (let py = top + 2; py < near(px) - 1; py++) {
      const cell =
        Math.floor((px - x + (Math.floor((py - y) / 3) % 2) * 2) / 5) + Math.floor((py - y) / 3);
      const tone = cell % 3 === 0 ? 'hill' : cell % 3 === 1 ? 'field' : 'field-d';
      if (tone !== 'hill') c.rect(tone, px, py, 1, 1);
    }
    const n = near(px);
    c.rect('hill-d', px, n, 1, bottom - n);
  }

  // Camino: baja del pueblo hacia el primer plano, cada vez más ancho.
  for (let py = y + 55; py < bottom; py++) {
    const t = (py - (y + 55)) / (bottom - (y + 55));
    const center = x + 20 + Math.round(5 * Math.sin(py / 4.5) * t + t * 3);
    const width = 1 + Math.round(t * 3);
    c.rect('road', center - Math.floor(width / 2), py, width, 1);
  }

  // El pueblo, sobre la colina del medio: casas, la iglesia y sus ventanas.
  const windowsDay = canvas();
  const windowsNight = canvas();
  const house = (hx) => {
    const base = mid(hx + 2);
    c.rect('roof', hx + 1, base - 5, 3, 1);
    c.rect('roof', hx, base - 4, 5, 1);
    c.rect('house', hx, base - 3, 5, 3);
    windowsDay.rect('ink', hx + 2, base - 2, 1, 1);
    windowsNight.rect('lit', hx + 2, base - 2, 1, 1);
  };
  const church = (chx) => {
    const base = mid(chx + 3);
    c.rect('house', chx + 2, base - 10, 2, 6); // campanario
    c.rect('roof', chx + 2, base - 11, 2, 1);
    c.rect('gold', chx + 2, base - 13, 1, 2); // cruz
    c.rect('gold', chx + 1, base - 12, 3, 1);
    c.rect('roof', chx, base - 5, 7, 1);
    c.rect('house', chx, base - 4, 7, 4);
    windowsDay.rect('ink', chx + 3, base - 8, 1, 2);
    windowsNight.rect('lit', chx + 3, base - 8, 1, 2);
    windowsDay.rect('ink', chx + 3, base - 2, 1, 2);
    windowsNight.rect('lit', chx + 3, base - 2, 1, 2);
  };
  house(x + 7);
  church(x + 13);
  house(x + 22);
  house(x + 28);

  return `${c.svg()}<g class="px-day">${windowsDay.svg()}</g><g class="px-night px-lit">${windowsNight.svg()}</g>`;
}

/** Rayo de luz del ventanal (día): escalones que se ensanchan hacia el suelo. */
function lightBeam(x, y, w, toY, { drift, color, mode }) {
  const c = canvas();
  for (let py = y; py < toY; py++) {
    const t = (py - y) / (toY - y);
    const widen = Math.round(t * 26);
    // `drift` > 0: la luz viene de la izquierda y cae hacia la derecha (y al revés).
    const left = Math.round(x + t * drift - (drift < 0 ? widen : 0));
    c.rect(color, left, py, w + widen, 1);
  }
  return `<g class="px-${mode} px-beam">${c.svg()}</g>`;
}

/** Halo de la vela (noche): anillos concéntricos escalonados. */
function glow(cx, cy, radius) {
  const rings = [1, 0.84, 0.69, 0.55, 0.42, 0.3]
    .map((f) => radius * f)
    .map((r, i) => {
      const c = canvas();
      for (let dy = -r; dy <= r; dy++) {
        const half = Math.round(Math.sqrt(r * r - dy * dy));
        c.rect('glow', Math.round(cx - half), Math.round(cy + dy), half * 2, 1);
      }
      return `<g class="px-glow px-glow-${i}">${c.svg()}</g>`;
    });
  return `<g class="px-night">${rings.join('')}</g>`;
}

function motes(x, y, w, h, rnd, count = 10) {
  const dots = [];
  for (let i = 0; i < count; i++) {
    const mx = x + Math.floor(rnd() * w);
    const my = y + Math.floor(rnd() * h);
    dots.push(
      `<path class="px-mote" style="animation-delay:${(rnd() * 6).toFixed(2)}s;fill:var(--px-sun)" d="M${mx} ${my}h1v1h-1z"/>`,
    );
  }
  return `<g class="px-day">${dots.join('')}</g>`;
}

const CREW = {
  stand: [
    '...ooo...',
    '..orrro..',
    '.orrrrro.',
    '.orrrsso.',
    '.orrsoso.',
    '..orsss..',
    '.orrrrro.',
    '.orrrrrso',
    '.orbbbro.',
    '.orrrrro.',
    '.orrdrro.',
    '..oo.oo..',
  ],
  walk: [
    '...ooo...',
    '..orrro..',
    '.orrrrro.',
    '.orrrsso.',
    '.orrsoso.',
    '..orsss..',
    '.orrrrro.',
    '.orrrrrso',
    '.orbbbro.',
    '.orrrrro.',
    '.orrdrro.',
    '.oo...oo.',
  ],
  writeA: [
    '...ooo...',
    '..orrro.k',
    '.orrrrrok',
    '.orrrssos',
    '.orrsosos',
    '..orssso.',
    '.orrrrro.',
    '.orrrrro.',
    '.orbbbro.',
    '.orrrrro.',
    '.orrdrro.',
    '..oo.oo..',
  ],
  writeB: [
    '...ooo...',
    '..orrro..',
    '.orrrrro.',
    '.orrrsso.',
    '.orrsosok',
    '..orsssok',
    '.orrrrros',
    '.orrrrro.',
    '.orbbbro.',
    '.orrrrro.',
    '.orrdrro.',
    '..oo.oo..',
  ],
  cheer: [
    's..ooo..s',
    'so.rrr.os',
    '.orrrrro.',
    '.orrrsso.',
    '.orrsoso.',
    '..orsss..',
    '.orrrrro.',
    '.orrrrro.',
    '.orbbbro.',
    '.orrrrro.',
    '.orrdrro.',
    '..oo.oo..',
  ],
  monk: [
    '....ooo....',
    '...ohhho...',
    '..ohssssho.',
    '..ohssosso.',
    '..ohsssss..',
    '...ossss...',
    '..ommmmmo..',
    '.ommmmmmmo.',
    '.ommmmmmmo.',
    '.ommmmmmso.',
    '.ogggggggo.',
    '.ommmmmmmo.',
    '.ommnmmmmo.',
    '.ommnmmmmo.',
    '.ommnmmmmo.',
    '..ooo.ooo..',
  ],
  monkPoint: [
    '....ooo....',
    '...ohhho...',
    '..ohssssho.',
    '..ohssosso.',
    '..ohsssss..',
    '...ossss...',
    '..ommmmmoss',
    '.ommmmmmmo.',
    '.ommmmmmmo.',
    '.ommmmmmmo.',
    '.ogggggggo.',
    '.ommmmmmmo.',
    '.ommnmmmmo.',
    '.ommnmmmmo.',
    '.ommnmmmmo.',
    '..ooo.ooo..',
  ],
  monkCheer: [
    's...ooo...s',
    'so.ohhho.os',
    '.oohssssho.',
    '..ohssosso.',
    '..ohsssss..',
    '...ossss...',
    '..ommmmmo..',
    '.ommmmmmmo.',
    '.ommmmmmmo.',
    '.ommmmmmmo.',
    '.ogggggggo.',
    '.ommmmmmmo.',
    '.ommnmmmmo.',
    '.ommnmmmmo.',
    '.ommnmmmmo.',
    '..ooo.ooo..',
  ],
};

// ------------------------------------------------------------ taller de copistas
//
// Mientras se genera una voz, un maestro y nueve aprendices la "fabrican": llenan un
// pergamino gigante renglón por renglón (el progreso real) y, al terminar, uno lo
// enrolla y lo lleva por la puerta de la derecha. Los aprendices visten el color de la
// voz (data-voice en el <svg>; ver scriptorium.css). Sprites: .scratch/workshop-sprites.mjs.

const CREW_PALETTE = {
  o: 'ink',
  r: 'robe',
  d: 'robe-d',
  s: 'skin',
  b: 'gold-d',
  k: 'ink',
  m: 'monk',
  n: 'monk-d',
  h: 'hair',
  g: 'gold',
  w: 'parch',
};
const flip = (rows) => rows.map((row) => [...row].reverse().join(''));

/** Un personaje con sus poses (cada una en su grupo, las alterna el CSS). */
function actor(poses, x, bottom, { className = '', style = '', mirror = false } = {}) {
  const groups = Object.entries(poses).map(([pose, rows]) => {
    const c = canvas();
    const sprite = mirror ? flip(rows) : rows;
    c.sprite(sprite, CREW_PALETTE, x, bottom - sprite.length);
    return `<g class="ws-${pose}">${c.svg()}</g>`;
  });
  return `<g class="ws-actor ${className}" style="${style}">${groups.join('')}</g>`;
}

const WS_W = 200;
const WS_H = 40;
const FLOOR = 38;
const SHEET = { x: 34, y: 6, w: 64, h: 27 };
const ROWS = 8;
let workshopCount = 0;

/**
 * El taller como SVG. `rows` son los renglones del pergamino: la página los descubre
 * según el progreso (clipPath con un <rect> por renglón, ver `LectioWorkshop`).
 */
function workshop(voice) {
  const uid = `ws${++workshopCount}`;
  const rnd = random(77);
  const set = canvas();

  // Tarima: una tabla de madera a lo ancho.
  set.rect('ink', 0, FLOOR, WS_W, 2);
  set.rect('wood', 0, FLOOR, WS_W, 1);

  // Atril con el pergamino: patas, rodillos con pomos dorados.
  for (const lx of [SHEET.x + 3, SHEET.x + SHEET.w - 4]) {
    set.rect('ink', lx, SHEET.y, 2, FLOOR - SHEET.y);
    set.rect('wood-d', lx, SHEET.y + 1, 1, FLOOR - SHEET.y - 1);
  }
  const roller = (ry) => {
    const r = canvas();
    r.rect('ink', SHEET.x - 2, ry, SHEET.w + 4, 3);
    r.rect('wood-l', SHEET.x - 1, ry + 1, SHEET.w + 2, 1);
    r.rect('gold', SHEET.x - 3, ry, 2, 3);
    r.rect('gold', SHEET.x + SHEET.w + 1, ry, 2, 3);
    return r.svg();
  };

  // La hoja y su texto: palabras de tinta; la inicial, iluminada en rojo y oro.
  const sheet = canvas();
  sheet.rect('parch-d', SHEET.x, SHEET.y, SHEET.w, SHEET.h);
  sheet.rect('parch', SHEET.x + 1, SHEET.y + 1, SHEET.w - 2, SHEET.h - 2);
  const text = canvas();
  text.rect('red', SHEET.x + 4, SHEET.y + 3, 5, 5);
  text.rect('gold', SHEET.x + 5, SHEET.y + 4, 3, 3);
  text.rect('red', SHEET.x + 6, SHEET.y + 5, 1, 1);
  const clips = [];
  for (let i = 0; i < ROWS; i++) {
    const ry = SHEET.y + 3 + i * 3;
    const from = SHEET.x + (i < 2 ? 11 : 4);
    const to = SHEET.x + SHEET.w - 4;
    for (let wx = from; wx < to;) {
      const len = Math.min(to - wx, 2 + Math.floor(rnd() * 5));
      text.rect(i === 0 && wx === from ? 'red' : 'ink', wx, ry, len, 1);
      wx += len + 1;
    }
    clips.push(
      `<rect class="ws-row" data-from="${from}" data-to="${to}" x="${from}" y="${ry}" width="0" height="1"/>`,
    );
  }
  const initialClip = `<rect x="${SHEET.x + 4}" y="${SHEET.y + 3}" width="5" height="5"/>`;

  // Utilería: taburete, escalera, pupitre con tintero, mortero, vela.
  const props = canvas();
  props.rect('ink', 44, 33, 8, 1);
  props.rect('wood', 45, 34, 6, 1);
  for (const px of [45, 50]) props.rect('wood-d', px, 34, 1, 4);
  for (const px of [99, 104]) props.rect('wood-d', px, 14, 1, FLOOR - 14);
  for (let py = 17; py < FLOOR; py += 4) props.rect('wood-l', 99, py, 6, 1);
  props.rect('ink', 111, 30, 10, 1);
  props.rect('wood', 111, 31, 10, 2);
  for (const px of [112, 119]) props.rect('wood-d', px, 33, 1, 5);
  props.sprite(['.oo.', 'okko', 'okko'], { o: 'ink', k: 'inkwell' }, 116, 27);
  props.sprite(['o....o', 'osssso', '.osso.', '..oo..'], { o: 'ink', s: 'stone-l' }, 155, 34);
  props.sprite(
    ['.y.', 'yfy', '.o.', 'owo', 'owo'],
    { y: 'flame-core', f: 'flame', o: 'ink', w: 'parch' },
    184,
    27,
  );

  // La puerta: arco de piedra, hoja de madera (cerrada / abierta) y la campanita.
  const door = canvas();
  door.rect('stone-l', 188, 14, 12, FLOOR - 14);
  door.rect('stone-l', 190, 12, 8, 2);
  door.rect('ink', 190, 16, 8, FLOOR - 16);
  const closed = canvas();
  closed.rect('wood-d', 191, 17, 6, FLOOR - 17);
  closed.rect('wood', 192, 17, 4, FLOOR - 17);
  closed.rect('gold', 195, 27, 1, 1);
  const open = canvas();
  open.rect('flame-core', 192, 18, 5, FLOOR - 18);
  open.rect('wood-d', 191, 17, 1, FLOOR - 17);
  const bell = canvas();
  bell.rect('ink', 193, 8, 2, 1);
  bell.sprite(['.gg.', 'gggg', 'gggg', '.h..'], { g: 'gold', h: 'gold-d' }, 192, 9);

  const stand = { a: CREW.stand, b: CREW.walk, cheer: CREW.cheer };
  const write = { a: CREW.writeA, b: CREW.writeB, cheer: CREW.cheer };
  const crew = [
    // El maestro, señalando el pergamino.
    actor({ a: CREW.monk, b: CREW.monkPoint, cheer: CREW.monkCheer }, 18, FLOOR, {
      className: 'ws-toggle ws-master',
      style: '--dur:2.4s',
    }),
    // Uno dormido a los pies del maestro (sentado: le faltan las piernas).
    actor({ a: CREW.stand.slice(0, 10), cheer: CREW.cheer.slice(0, 10) }, 3, FLOOR, {
      className: 'ws-sleeper',
    }),
    // Escribiendo: en el taburete, en la escalera y abajo.
    actor(write, 44, 33, { className: 'ws-toggle ws-jump', style: '--dur:0.5s' }),
    actor(write, 94, 26, {
      className: 'ws-toggle ws-jump',
      style: '--dur:0.6s;animation-delay:-0.2s',
      mirror: true,
    }),
    actor(write, 66, FLOOR, { className: 'ws-toggle ws-jump ws-hand-off', style: '--dur:0.55s' }),
    // Mojando la pluma en el tintero.
    actor(write, 121, FLOOR, {
      className: 'ws-toggle ws-jump',
      style: '--dur:1.1s',
      mirror: true,
    }),
    // Traen tinta y hojas, de ida y vuelta (el de las hojas a veces tropieza).
    `<g class="ws-walker" style="--dist:18px;--dur:7s">${actor(stand, 128, FLOOR, {
      className: 'ws-toggle ws-jump',
      style: '--dur:0.35s',
    })}</g>`,
    // Moliendo pigmentos en el mortero.
    actor(write, 146, FLOOR, { className: 'ws-toggle ws-jump', style: '--dur:0.4s' }),
    `<g class="ws-walker ws-trips" style="--dist:16px;--dur:9s">${actor(stand, 164, FLOOR, {
      className: 'ws-toggle ws-jump',
      style: '--dur:0.35s',
    })}</g>`,
    // Sosteniendo la vela junto a la puerta.
    actor(stand, 176, FLOOR, { className: 'ws-jump' }),
  ];

  // El que lleva el pergamino enrollado hasta la puerta (aparece al terminar).
  const scroll = ['.ooooooo.', 'gwwwwwwwg', '.ooooooo.'];
  const carrier = canvas();
  carrier.sprite(scroll, { o: 'ink', w: 'parch', g: 'gold' }, 62, 22);
  const carrierBody = actor({ a: CREW.cheer, b: CREW.cheer }, 62, FLOOR, {
    className: 'ws-toggle',
    style: '--dur:0.3s',
  });

  const zzz = `<g class="ws-zzz" style="fill:var(--px-parch-d)"><path d="M12 24h2v1h-2zM13 23h1v1h-1z"/><path d="M15 20h2v1h-2zM16 19h1v1h-1z"/></g>`;

  return `<svg class="px-workshop" data-voice="${voice}" viewBox="0 0 ${WS_W} ${WS_H}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
    <defs><clipPath id="${uid}-text">${initialClip}${clips.join('')}</clipPath></defs>
    ${set.svg()}${door.svg()}
    <g class="ws-door-closed">${closed.svg()}</g><g class="ws-door-open">${open.svg()}</g>
    <g class="ws-bell">${bell.svg()}</g>
    ${props.svg()}
    <g class="ws-sheet">${sheet.svg()}<g clip-path="url(#${uid}-text)">${text.svg()}</g></g>
    <g class="ws-roller-top">${roller(SHEET.y - 2)}</g><g class="ws-roller-bottom">${roller(SHEET.y + SHEET.h)}</g>
    ${crew.join('')}${zzz}
    <g class="ws-carrier" style="--to:124px">${carrier.svg()}${carrierBody}</g>
  </svg>`;
}

// ------------------------------------------------------------ escenas

const W = 320;
const H = 180;

/** Interior del scriptorium: la escena de la pantalla de título y del fondo de la biblioteca. */
function scriptoriumScene({ desk = true } = {}) {
  const rnd = random(1605);
  const back = canvas();
  stoneWall(back, 0, 0, W, 142, rnd);
  floor(back, 0, 142, W, H - 142, rnd);
  const shelves = bookshelf(back, 8, 16, 100, 126, rnd) + bookshelf(back, 212, 16, 100, 126, rnd);

  const win = { x: 138, y: 16, w: 44, h: 72 };
  let furniture = '';
  if (desk) {
    const d = canvas();
    d.rect('wood-d', 92, 130, 136, 4);
    d.rect('wood-l', 92, 130, 136, 1);
    d.rect('wood', 96, 134, 128, 14);
    d.rect('wood-d', 96, 146, 128, 2);
    d.rect('ink', 92, 133, 136, 1);
    for (const lx of [100, 214]) d.rect('wood-d', lx, 148, 6, 22);
    // Atril inclinado bajo el libro.
    d.rect('wood', 140, 124, 40, 6);
    d.rect('wood-d', 140, 129, 40, 1);
    furniture = `${d.svg()}${openBook(143, 114)}${candle(196, 112)}${inkwellWithQuill(118, 115)}`;
  }

  return `<svg class="px-scene" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
    ${back.svg()}${shelves}
    <rect class="px-night" x="0" y="0" width="${W}" height="${H}" style="fill:var(--px-dusk)"/>
    ${archWindow(win.x, win.y, win.w, win.h, sky(win.x, win.y, win.w, win.h, rnd) + landscape(win.x, win.y, win.w, win.h))}
    ${lightBeam(win.x + 6, win.y + win.h + 3, win.w - 12, 142, { drift: -34, color: 'beam', mode: 'day' })}
    ${lightBeam(win.x + 6, win.y + win.h + 3, win.w - 12, 142, { drift: 30, color: 'moonbeam', mode: 'night' })}
    ${motes(win.x - 40, win.y + win.h, 70, 50, rnd)}
    ${furniture}
    ${desk ? glow(199, 116, 44) : ''}
    ${desk ? `<g class="px-companion">${owl(102, 114)}</g>` : ''}
  </svg>`;
}

// ------------------------------------------------------------ las salas de la app
//
// La gran biblioteca del monasterio (el catálogo público) y tu estudio (tus
// libros). Las dos tienen una puerta que se puede pulsar (.px-door): la página la abre
// (.px-door-open) y funde a la otra sala.

/** Rellena una forma (función px, py → bool) con runs horizontales de un color. */
function fillShape(c, color, shape, x, y, w, h) {
  for (let py = y; py < y + h; py++) {
    let start = null;
    for (let px = x; px <= x + w; px++) {
      const hit = px < x + w && shape(px, py);
      if (hit && start === null) start = px;
      if (!hit && start !== null) {
        c.rect(color, start, py, px - start, 1);
        start = null;
      }
    }
  }
}

/** Vano de arco apuntado (gótico): dos arcos de radio `w` que se cruzan en la clave. */
function lancetShape(x, y, w, h) {
  const a = Math.round(w * 0.87);
  return (px, py) => {
    if (py < y || py >= y + h || px < x || px >= x + w) return false;
    if (py >= y + a) return true;
    const cx = px + 0.5;
    const cy = py + 0.5;
    return Math.hypot(cx - (x + w), cy - (y + a)) <= w && Math.hypot(cx - x, cy - (y + a)) <= w;
  };
}

/** Losas de piedra de la nave: hiladas desparejas, más altas hacia el frente. */
function flagstones(c, x, y, w, h, rnd) {
  c.rect('mortar', x, y, w, h);
  for (let row = 0, py = y; py < y + h; row++) {
    const lh = 4 + row;
    for (let px = x - (row % 2) * 7; px < x + w;) {
      const lw = 12 + Math.floor(rnd() * 8) + row * 2;
      const left = Math.max(px, x);
      const right = Math.min(px + lw - 1, x + w);
      c.rect(
        rnd() < 0.2 ? 'stone-d' : 'stone',
        left,
        py,
        right - left,
        Math.min(lh - 1, y + h - py),
      );
      c.rect('stone-l', left, py, right - left, 1);
      px += lw;
    }
    py += lh;
  }
}

/** Colores de cada vitral: vidrio base, claro y hondo, y el medallón con su anillo. */
const VITRALS = {
  red: { main: 'red', light: 'red-l', deep: 'red-d', medal: 'gold', ring: 'gold-d' },
  blue: { main: 'blue', light: 'blue-l', deep: 'blue-d', medal: 'red', ring: 'gold' },
  gold: { main: 'gold', light: 'parch', deep: 'gold-d', medal: 'blue', ring: 'red' },
};

/**
 * Vitral alto de arco apuntado: vidrios en rombo con emplomado diagonal, un medallón bajo
 * la clave, borde de plomo, marco de piedra y alféizar.
 */
function stainedGlass(x, y, w, h, colors) {
  const inside = lancetShape(x, y, w, h);
  const glass = canvas();
  const lead = canvas();
  const frame = canvas();
  const mx = x + w / 2 - 0.5;
  const my = y + Math.round(w * 0.87) + 12;
  for (let py = y - 2; py < y + h + 2; py++) {
    for (let px = x - 2; px < x + w + 2; px++) {
      if (!inside(px, py)) {
        const nearGlass =
          inside(px - 2, py) || inside(px + 2, py) || inside(px, py - 2) || inside(px, py + 2);
        if (nearGlass) frame.rect('stone-l', px, py, 1, 1);
        continue;
      }
      const d = Math.hypot(px - mx, py - my);
      const edge = !inside(px - 1, py) || !inside(px + 1, py) || !inside(px, py - 1);
      if (edge) lead.rect('lead', px, py, 1, 1);
      else if (d < 6.5) {
        if (d > 5.4) lead.rect('lead', px, py, 1, 1);
        else if (d > 4.2) glass.rect(colors.ring, px, py, 1, 1);
        else glass.rect(d < 1.5 ? 'parch' : colors.medal, px, py, 1, 1);
      } else if ((px + py) % 6 === 0 || (px - py + 600) % 6 === 0) lead.rect('lead', px, py, 1, 1);
      else {
        const cell = Math.floor((px + py) / 6) + Math.floor((px - py + 600) / 6);
        const tone = cell % 3 === 0 ? colors.light : cell % 5 === 1 ? colors.deep : colors.main;
        glass.rect(tone, px, py, 1, 1);
      }
    }
  }
  frame.rect('stone-d', x - 3, y + h, w + 6, 2);
  frame.rect('stone-l', x - 3, y + h, w + 6, 1);
  return glass.svg() + lead.svg() + frame.svg();
}

/** Mancha de luz de color en el suelo, donde cae el haz de un vitral (de día). */
function lightPool(cx, cy, rx, ry, color) {
  const c = canvas();
  for (let dy = -ry; dy <= ry; dy++) {
    const half = Math.round(rx * Math.sqrt(1 - (dy * dy) / (ry * ry)));
    c.rect(color, cx - half, cy + dy, half * 2, 1);
  }
  return `<g class="px-day px-beam">${c.svg()}</g>`;
}

/**
 * El pasillo que se aleja: arcos cada vez más chicos y oscuros, con libros en los muros
 * y, al fondo, una ventanita con luz.
 */
function aisle(x, y, w, h) {
  const c = canvas();
  const rings = ['stone-l', 'stone-d', 'mortar', 'wood-d', 'ink'];
  const spines = ['red', 'blue', 'green', 'gold-d', 'plum'];
  rings.forEach((color, i) => {
    const inset = i * 3;
    const ry = y + Math.round(inset * 0.8);
    const shape = archShape(x + inset, ry, w - inset * 2, h - (ry - y));
    fillShape(c, color, shape, x + inset, ry, w - inset * 2, h - (ry - y));
  });
  for (let i = 1; i < 4; i++) {
    const inset = i * 3 + 1;
    for (let py = y + h - 16 + i * 2; py < y + h - 3; py += 3) {
      const color = spines[(i + py) % spines.length];
      c.rect(color, x + inset, py, 1, 2);
      c.rect(color, x + w - inset - 1, py, 1, 2);
    }
  }
  const mid = x + Math.floor(w / 2);
  c.rect('sky-low', mid - 1, y + 17, 2, 4);
  return c.svg();
}

/** Atril de la nave: pie, columna con nudo dorado, tablero inclinado y el libro abierto. */
function lectern(cx, bottom) {
  const c = canvas();
  c.rect('ink', cx - 9, bottom - 3, 18, 3);
  c.rect('ink', cx - 3, bottom - 27, 6, 24);
  c.rect('ink', cx - 19, bottom - 32, 38, 6);
  c.rect('wood', cx - 8, bottom - 2, 16, 1);
  c.rect('wood', cx - 2, bottom - 26, 4, 23);
  c.rect('wood', cx - 18, bottom - 31, 36, 3);
  c.rect('wood-l', cx - 2, bottom - 26, 1, 23);
  c.rect('wood-l', cx - 18, bottom - 31, 36, 1);
  c.rect('wood-d', cx - 18, bottom - 28, 36, 1);
  c.rect('gold', cx - 3, bottom - 16, 6, 2);
  return c.svg() + openBook(cx - 17, bottom - 42);
}

/** Candelabro de pie, de bronce, con su vela. */
function candelabrum(x, bottom, height) {
  const c = canvas();
  c.rect('ink', x - 4, bottom - 2, 9, 2);
  c.rect('ink', x - 1, bottom - height, 3, height - 2);
  c.rect('ink', x - 3, bottom - height - 1, 7, 2);
  c.rect('gold-d', x - 3, bottom - 2, 7, 1);
  c.rect('gold-d', x, bottom - height, 1, height - 2);
  for (const k of [0.35, 0.7]) c.rect('gold', x - 1, bottom - Math.round(height * k), 3, 1);
  c.rect('gold', x - 2, bottom - height - 1, 5, 1);
  return c.svg() + candle(x - 3, bottom - height - 15);
}

/** Escalera corrediza apoyada en la estantería, colgada de su riel de bronce. */
function ladder(topX, topY, bottomX, bottomY) {
  const c = canvas();
  c.rect('ink', topX - 3, topY - 3, 14, 3);
  c.rect('gold-d', topX - 2, topY - 2, 12, 1);
  for (let py = topY; py <= bottomY; py++) {
    const t = (py - topY) / (bottomY - topY);
    const lx = Math.round(topX + (bottomX - topX) * t);
    for (const off of [0, 7]) {
      c.rect('ink', lx + off - 1, py, 3, 1);
      c.rect('wood-l', lx + off, py, 1, 1);
    }
    if ((py - topY) % 7 === 4) {
      c.rect('wood', lx + 1, py, 6, 1);
      c.rect('wood-d', lx + 1, py + 1, 6, 1);
    }
  }
  c.rect('ink', bottomX - 1, bottomY + 1, 3, 2);
  c.rect('ink', bottomX + 6, bottomY + 1, 3, 2);
  return c.svg();
}

/**
 * Puerta de tablones con arco de piedra, bisagras de hierro y aldaba. Cerrada o abierta
 * (luz cálida del otro lado y la hoja girada); el rectángulo transparente recibe el clic.
 */
function door(x, y, w, h) {
  const inside = archShape(x, y, w, h);
  const frame = canvas();
  const leaf = canvas();
  const open = canvas();
  for (let py = y - 3; py < y + h; py++) {
    for (let px = x - 3; px < x + w + 3; px++) {
      if (inside(px, py)) {
        const plank = (px - x) % 5;
        leaf.rect(plank === 0 ? 'wood-d' : plank === 1 ? 'wood-l' : 'wood', px, py, 1, 1);
        open.rect(py < y + 6 ? 'flame' : 'flame-core', px, py, 1, 1);
      } else if (inside(px - 3, py) || inside(px + 3, py) || inside(px, py + 3)) {
        frame.rect(px >= x + w ? 'stone-d' : 'stone-l', px, py, 1, 1);
      }
    }
  }
  const r = Math.floor(w / 2);
  for (const hy of [y + r + 4, y + h - 12]) {
    leaf.rect('ink', x + 1, hy, w - 7, 2);
    leaf.rect('lead', x + 1, hy, w - 8, 1);
  }
  leaf.rect('ink', x + w - 6, y + Math.round(h * 0.58), 3, 4);
  leaf.rect('gold', x + w - 5, y + Math.round(h * 0.58) + 1, 1, 2);
  // Abierta: la hoja se ve de canto a la izquierda y la luz se derrama en el suelo.
  open.rect('wood-d', x, y + r, 3, h - r);
  open.rect('wood-l', x, y + r, 1, h - r);
  const spill = canvas();
  for (let i = 0; i < 5; i++) spill.rect('beam', x - i, y + h + i, w + i * 2, 1);
  return `<g class="px-door">${frame.svg()}
    <g class="px-door-closed">${leaf.svg()}</g>
    <g class="px-door-open">${open.svg()}${spill.svg()}</g>
    <rect class="px-door-hit" x="${x - 3}" y="${y - 3}" width="${w + 6}" height="${h + 3}" fill="transparent"/>
  </g>`;
}

/** La gran biblioteca del monasterio: nave alta, tres vitrales, escalera, atril y puerta. */
function monasteryScene() {
  const rnd = random(2203);
  const back = canvas();
  stoneWall(back, 0, 0, W, 142, rnd);
  flagstones(back, 0, 142, W, H - 142, rnd);
  // Pilastras entre los vitrales, con su capitel.
  for (const px of [131, 181]) {
    back.rect('stone-d', px, 0, 8, 142);
    back.rect('stone-l', px + 1, 0, 1, 142);
    back.rect('stone-l', px - 1, 90, 10, 3);
  }
  const shelves = bookshelf(back, 2, 6, 84, 136, rnd, 5) + bookshelf(back, 236, 6, 54, 136, rnd, 5);

  const lancets = [
    [100, 'red'],
    [150, 'blue'],
    [200, 'gold'],
  ];
  const windows = lancets
    .map(([lx, color]) => stainedGlass(lx, 12, 20, 74, VITRALS[color]))
    .join('');
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

  return `<svg class="px-scene px-monastery" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
    ${back.svg()}${shelves}${windows}${aisle(146, 98, 28, 44)}
    <rect class="px-night" x="0" y="0" width="${W}" height="${H}" style="fill:var(--px-dusk)"/>
    ${beams}
    ${motes(100, 90, 130, 50, rnd, 14)}
    ${ladder(62, 12, 72, 140)}
    ${door(296, 90, 20, 52)}
    ${candelabrum(128, 150, 64)}${candelabrum(192, 150, 64)}
    ${lectern(160, 154)}
    ${glow(129, 73, 30)}${glow(193, 73, 30)}
  </svg>`;
}

/** Escritorio: patas, tablero, atril inclinado con la hoja, tintero y vela o libros. */
function writingDesk(x, bottom, { withCandle = true } = {}) {
  const c = canvas();
  const top = bottom - 30;
  for (const lx of [x + 3, x + 57]) c.rect('ink', lx, top + 4, 4, 26);
  c.rect('ink', x, top, 64, 5);
  c.rect('ink', x + 6, top - 6, 30, 6);
  for (const lx of [x + 3, x + 57]) c.rect('wood-d', lx + 1, top + 4, 2, 26);
  c.rect('wood-d', x + 5, bottom - 8, 54, 2);
  c.rect('wood', x + 1, top + 1, 62, 3);
  c.rect('wood', x + 7, top - 5, 28, 4);
  c.rect('wood-l', x + 1, top + 1, 62, 1);
  const sheet = canvas();
  sheet.rect('parch-d', x + 9, top - 13, 24, 8);
  sheet.rect('parch', x + 10, top - 12, 22, 6);
  for (const ly of [top - 11, top - 9, top - 7]) sheet.rect('text', x + 12, ly, 17, 1);
  sheet.rect('red', x + 11, top - 11, 2, 2);
  const stack = canvas();
  stack.sprite(SHELF_OBJECTS[6], SHELF_PALETTE, x + 50, top - 6);
  return (
    c.svg() +
    sheet.svg() +
    inkwellWithQuill(x + 38, top - 15) +
    (withCandle ? candle(x + 50, top - 14) : stack.svg())
  );
}

/** Sillón de lectura: respaldo alto capitoné, brazos de madera, cojín y una manta encima. */
function armchair(x, bottom) {
  const c = canvas();
  c.rect('ink', x + 4, bottom - 46, 36, 32);
  c.rect('ink', x, bottom - 26, 8, 18);
  c.rect('ink', x + 36, bottom - 26, 8, 18);
  c.rect('ink', x + 4, bottom - 18, 36, 8);
  for (const lx of [x + 3, x + 38]) c.rect('ink', lx, bottom - 10, 3, 10);
  c.rect('red', x + 5, bottom - 45, 34, 29);
  c.rect('red-d', x + 5, bottom - 45, 34, 2);
  c.rect('red-l', x + 6, bottom - 43, 1, 26);
  for (let by = bottom - 40; by < bottom - 18; by += 7)
    for (let bx = x + 11; bx < x + 38; bx += 8) c.rect('gold-d', bx, by, 1, 1);
  c.rect('wood', x + 1, bottom - 25, 6, 16);
  c.rect('wood', x + 37, bottom - 25, 6, 16);
  c.rect('wood-l', x + 1, bottom - 25, 6, 1);
  c.rect('wood-l', x + 37, bottom - 25, 6, 1);
  c.rect('red-l', x + 7, bottom - 17, 30, 3);
  c.rect('red', x + 7, bottom - 14, 30, 3);
  for (const lx of [x + 4, x + 39]) c.rect('wood-d', lx, bottom - 9, 1, 9);
  // La manta, doblada sobre el brazo derecho.
  const blanket = canvas();
  blanket.rect('ink', x + 29, bottom - 30, 12, 20);
  blanket.rect('green', x + 30, bottom - 29, 10, 18);
  for (let sy = bottom - 27; sy < bottom - 12; sy += 4) blanket.rect('green-l', x + 30, sy, 10, 1);
  blanket.rect('parch-d', x + 30, bottom - 12, 10, 1);
  return c.svg() + blanket.svg();
}

/** Mesita redonda de un pie, con una vela. */
function sideTable(x, bottom) {
  const c = canvas();
  c.rect('ink', x, bottom - 20, 14, 3);
  c.rect('ink', x + 5, bottom - 17, 4, 15);
  c.rect('ink', x + 2, bottom - 3, 10, 3);
  c.rect('wood', x + 1, bottom - 19, 12, 1);
  c.rect('wood-l', x + 1, bottom - 20, 12, 1);
  c.rect('wood-d', x + 6, bottom - 17, 2, 15);
  c.rect('wood', x + 3, bottom - 2, 8, 1);
  return c.svg() + candle(x + 3, bottom - 34);
}

/** Alfombra en el suelo: campo rojo, cenefa dorada, medallón y flecos. */
function rug(x, y, w, h) {
  const c = canvas();
  c.rect('ink', x, y, w, h);
  c.rect('gold-d', x + 1, y + 1, w - 2, h - 2);
  c.rect('red-d', x + 3, y + 2, w - 6, h - 4);
  c.rect('red', x + 5, y + 3, w - 10, h - 6);
  for (let px = x + 4; px < x + w - 4; px += 4) c.rect('gold', px, y + 1, 2, 1);
  const cx = x + Math.floor(w / 2);
  const cy = y + Math.floor(h / 2);
  c.rect('gold', cx - 6, cy, 12, 1);
  c.rect('gold', cx - 3, cy - 2, 6, 5);
  c.rect('blue', cx - 1, cy - 1, 2, 3);
  for (let px = x + 1; px < x + w - 1; px += 2) {
    c.rect('parch-d', px, y - 1, 1, 1);
    c.rect('parch-d', px, y + h, 1, 1);
  }
  return c.svg();
}

/** Tapiz colgado de su barra: cenefa dorada, un árbol de la vida y flecos. */
function tapestry(x, y, w, h) {
  const c = canvas();
  c.rect('ink', x - 3, y - 2, w + 6, 3);
  c.rect('ink', x, y + 1, w, h);
  c.rect('gold-d', x - 2, y - 1, w + 4, 1);
  c.rect('gold-d', x + 1, y + 2, w - 2, h - 2);
  c.rect('blue-d', x + 3, y + 4, w - 6, h - 6);
  c.rect('blue', x + 4, y + 5, w - 8, h - 8);
  const cx = x + Math.floor(w / 2);
  c.rect('wood-l', cx, y + 16, 1, h - 20);
  for (const [dy, half, color] of [
    [8, 4, 'green-l'],
    [11, 7, 'green'],
    [15, 9, 'green'],
    [19, 6, 'green-l'],
  ])
    c.rect(color, cx - half, y + dy, half * 2 + 1, 2);
  for (const [ax, ay] of [
    [-5, 13],
    [4, 10],
    [6, 17],
    [-7, 18],
  ])
    c.rect('red', cx + ax, y + ay, 1, 1);
  c.rect('green-d', x + 4, y + h - 6, w - 8, 2);
  for (let px = x + 1; px < x + w - 1; px += 2) c.rect('gold', px, y + h + 1, 1, 2);
  return c.svg();
}

/** Arcón de madera con herrajes, cerradura dorada y, encima, el globo y dos libros. */
function chest(x, bottom) {
  const c = canvas();
  c.rect('ink', x, bottom - 16, 40, 16);
  c.rect('wood', x + 1, bottom - 15, 38, 14);
  c.rect('wood-l', x + 1, bottom - 15, 38, 1);
  c.rect('wood-d', x + 1, bottom - 9, 38, 1);
  for (const bx of [x + 5, x + 33]) c.rect('lead', bx, bottom - 15, 2, 14);
  c.rect('ink', x + 18, bottom - 11, 4, 4);
  c.rect('gold', x + 19, bottom - 10, 2, 2);
  const top = canvas();
  top.sprite(SHELF_OBJECTS[2], SHELF_PALETTE, x + 26, bottom - 25);
  top.sprite(SHELF_OBJECTS[6], SHELF_PALETTE, x + 6, bottom - 22);
  return c.svg() + top.svg();
}

/**
 * Tu estudio: el cuarto de un lector. Ventana al paisaje con el escritorio debajo, sillón
 * de lectura con su mesita y vela, alfombra, tapiz, arcón con el globo y la puerta.
 */
function studyScene() {
  const rnd = random(4242);
  const back = canvas();
  stoneWall(back, 0, 0, W, 150, rnd);
  floor(back, 0, 150, W, H - 150, rnd);
  // Viga del techo: un cuarto a escala de persona, no una nave.
  back.rect('ink', 0, 4, W, 7);
  back.rect('wood', 0, 5, W, 4);
  back.rect('wood-l', 0, 5, W, 1);

  // La repisa con tus libros (HTML) va en la pared entre la puerta y la ventana; el
  // escritorio queda bajo la ventana, el arcón bajo la repisa y el sillón en el rincón.
  const win = { x: 206, y: 28, w: 44, h: 62 };
  return `<svg class="px-scene px-study" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
    ${back.svg()}${tapestry(270, 26, 32, 48)}
    <rect class="px-night" x="0" y="0" width="${W}" height="${H}" style="fill:var(--px-dusk)"/>
    ${archWindow(win.x, win.y, win.w, win.h, sky(win.x, win.y, win.w, win.h, rnd) + landscape(win.x, win.y, win.w, win.h), 'px-study-window')}
    ${lightBeam(win.x + 6, win.y + win.h + 3, win.w - 12, 150, { drift: -44, color: 'beam', mode: 'day' })}
    ${lightBeam(win.x + 6, win.y + win.h + 3, win.w - 12, 150, { drift: -40, color: 'moonbeam', mode: 'night' })}
    ${rug(64, 157, 132, 13)}
    ${motes(win.x - 44, win.y + win.h, 60, 50, rnd)}
    ${door(8, 76, 30, 74)}
    ${chest(92, 150)}
    ${writingDesk(190, 150, { withCandle: false })}
    ${sideTable(256, 150)}
    ${armchair(272, 150)}
    ${glow(263, 118, 40)}
  </svg>`;
}

/** Búho solo, para acompañar en el índice o en la biblioteca. */
function owlBadge() {
  return `<svg class="px-badge" viewBox="0 0 18 18" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${owl(1, 1)}</svg>`;
}

/** Esquinero ornamental para la página de lectura (flor de lis estilizada, 7×7). */
function fleuron() {
  const c = canvas();
  c.sprite(
    ['...g...', '..gog..', '.g.o.g.', 'gooooog', '.g.o.g.', '..gog..', '...g...'],
    { g: 'gold', o: 'red' },
    0,
    0,
  );
  return `<svg class="px-fleuron" viewBox="0 0 7 7" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${c.svg()}</svg>`;
}

/** Pluma de ave: la perilla de la barra de progreso (escribe mientras avanza el audio). */
function quill() {
  const c = canvas();
  c.sprite(QUILL, { o: 'ink', w: 'parch', s: 'parch-d' }, 0, 0);
  return `<svg class="px-quill" viewBox="0 0 10 10" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${c.svg()}</svg>`;
}

export const Pixel = {
  scriptoriumScene,
  monasteryScene,
  studyScene,
  workshop,
  owlBadge,
  fleuron,
  quill,
  canvas,
  random,
};
