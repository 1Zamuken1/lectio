// Lectio · motor de pixel art (docs/lectio-temas.md §3.4). Los sprites son cuadrículas
// de caracteres; cada carácter es un color de la paleta del tema (variables CSS --px-*),
// así que día y noche son solo un cambio de variables: el dibujo no se regenera.
// Salida: SVG con un <path> por color (runs horizontales), nítido a cualquier escala.
(() => {
  'use strict';

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

  const SPINES = ['red', 'red-d', 'blue', 'green', 'gold-d', 'parch-d', 'blue-d', 'red'];

  /** Estantería con libros de alturas y colores variados (lomos con banda dorada). */
  function bookshelf(c, x, y, w, h, rnd, shelves = 4) {
    c.rect('wood-d', x, y, w, h);
    c.rect('wood', x + 2, y + 2, w - 4, h - 4);
    const gap = Math.floor((h - 4) / shelves);
    for (let s = 0; s < shelves; s++) {
      const base = y + 2 + gap * (s + 1) - 3;
      c.rect('wood-d', x + 2, base, w - 4, 3);
      c.rect('wood-l', x + 2, base, w - 4, 1);
      let bx = x + 4;
      while (bx < x + w - 8) {
        if (rnd() < 0.08) {
          bx += 4 + Math.floor(rnd() * 5); // hueco
          continue;
        }
        const bw = 3 + Math.floor(rnd() * 4);
        const bh = Math.min(gap - 6, 12 + Math.floor(rnd() * (gap - 16)));
        const color = SPINES[Math.floor(rnd() * SPINES.length)];
        const top = base - bh;
        c.rect('ink', bx, top, bw, bh);
        c.rect(color, bx, top + 1, bw - 1, bh - 1);
        c.rect('gold', bx, top + 3, bw - 1, 1);
        if (bh > 16) c.rect('gold', bx, base - 4, bw - 1, 1);
        bx += bw + (rnd() < 0.2 ? 1 : 0);
      }
    }
    c.rect('ink', x, y, w, 1);
    c.rect('ink', x, y, 1, h);
    c.rect('ink', x + w - 1, y, 1, h);
  }

  /** Ventanal gótico con vitral: arco de medio punto, emplomado y cielo de día o de noche. */
  function archWindow(x, y, w, h) {
    const frame = canvas();
    const glass = canvas();
    const r = w / 2;
    const inside = (px, py) => {
      if (py >= y + r) return px >= x && px < x + w;
      const dy = y + r - py - 0.5;
      const half = Math.sqrt(Math.max(0, r * r - dy * dy));
      return px + 0.5 >= x + r - half && px + 0.5 <= x + r + half;
    };
    for (let py = y - 3; py < y + h + 3; py++) {
      for (let px = x - 3; px < x + w + 3; px++) {
        const inGlass = py < y + h && inside(px, py);
        const inFrame =
          !inGlass &&
          (inside(px - 3, py) ||
            inside(px + 3, py) ||
            inside(px, py + 3) ||
            (py >= y + h && py < y + h + 3 && px >= x - 3 && px < x + w + 3));
        if (inFrame) frame.rect(py >= y + h ? 'stone-d' : 'stone-l', px, py, 1, 1);
        else if (inGlass) {
          const band = (py - y) / h;
          glass.rect(band < 0.35 ? 'sky-top' : band < 0.7 ? 'sky' : 'sky-low', px, py, 1, 1);
        }
      }
    }
    // Emplomado: parteluz central y travesaños.
    const lead = canvas();
    lead.rect('lead', x + Math.floor(w / 2), y + 2, 1, h - 2);
    for (let ly = y + r + 6; ly < y + h; ly += 12) lead.rect('lead', x, ly, w, 1);
    // Cristales de color en el arco (el vitral).
    const colors = canvas();
    colors.rect('red', x + r - 3, y + 5, 2, 2);
    colors.rect('gold', x + r + 2, y + 5, 2, 2);
    colors.rect('blue', x + r - 7, y + 10, 2, 2);
    colors.rect('green', x + r + 6, y + 10, 2, 2);
    return `${glass.svg()}${colors.svg()}${lead.svg()}${frame.svg()}`;
  }

  function sky(x, y, w, h, rnd) {
    // Día: sol y rayo de luz. Noche: luna y estrellas.
    const day = canvas();
    day.rect('sun', x + w - 16, y + 20, 6, 6);
    day.rect('sun', x + w - 17, y + 21, 8, 4);
    const night = canvas();
    night.rect('moon', x + 9, y + 18, 5, 6);
    night.rect('moon', x + 8, y + 19, 7, 4);
    night.rect('sky', x + 11, y + 18, 3, 4); // luna menguante
    const stars = [];
    for (let i = 0; i < 9; i++) {
      const sx = x + 3 + Math.floor(rnd() * (w - 6));
      const sy = y + 6 + Math.floor(rnd() * (h * 0.6));
      stars.push(
        `<path class="px-star" style="animation-delay:${(rnd() * 3).toFixed(2)}s;fill:var(--px-star)" d="M${sx} ${sy}h1v1h-1z"/>`,
      );
    }
    return `<g class="px-day">${day.svg()}</g><g class="px-night">${night.svg()}${stars.join('')}</g>`;
  }

  /** Rayo de luz del ventanal (día): escalones que se ensanchan hacia el suelo. */
  function lightBeam(x, y, w, toY) {
    const c = canvas();
    for (let py = y; py < toY; py++) {
      const t = (py - y) / (toY - y);
      const left = Math.round(x + t * 34);
      c.rect('beam', left, py, Math.round(w + t * 26), 1);
    }
    return `<g class="px-day px-beam">${c.svg()}</g>`;
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

  // ------------------------------------------------------------ escenas

  const W = 320;
  const H = 180;

  /** Interior del scriptorium: la escena de la pantalla de título y del fondo de la biblioteca. */
  function scriptoriumScene({ desk = true } = {}) {
    const rnd = random(1605);
    const back = canvas();
    stoneWall(back, 0, 0, W, 142, rnd);
    floor(back, 0, 142, W, H - 142, rnd);
    bookshelf(back, 10, 22, 96, 120, rnd);
    bookshelf(back, 214, 22, 96, 120, rnd);

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
      ${back.svg()}
      <rect class="px-night" x="0" y="0" width="${W}" height="${H}" style="fill:var(--px-dusk)"/>
      ${archWindow(win.x, win.y, win.w, win.h)}
      <g clip-path="url(#px-window-clip)">${sky(win.x, win.y, win.w, win.h, rnd)}</g>
      ${lightBeam(win.x + 6, win.y + win.h + 3, win.w - 12, 142)}
      ${motes(win.x, win.y + win.h, 70, 50, rnd)}
      ${furniture}
      ${desk ? glow(199, 116, 44) : ''}
      ${desk ? `<g class="px-companion">${owl(102, 114)}</g>` : ''}
      <defs><clipPath id="px-window-clip"><rect x="${win.x}" y="${win.y}" width="${win.w}" height="${win.h}"/></clipPath></defs>
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

  window.LectioPixel = { scriptoriumScene, owlBadge, fleuron, quill, canvas, random };
})();
