// Lectio · escenas del Bosque élfico (docs/lectio-temas.md §7.5). Al estilo Stardew Valley
// / Terraria: 320×180, colores sólidos, contornos de color (nunca negros) y objetos grandes.
// A diferencia del Scriptorium (SVG con la paleta en variables CSS), se dibujan en un
// lienzo de píxeles, una vez por modo (día o noche), y lo que se mueve (el agua, las
// luciérnagas, las mariposas) se repinta encima en pasos. Cada escena dice dónde van la
// estantería de los libros reales y la puerta (el ascensor de lianas) en sus coordenadas.

export const W = 320;
export const H = 180;

// ------------------------------------------------------------ el lienzo

export class Pix {
  constructor(w = W, h = H) {
    this.w = w;
    this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
  }
  set(x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.d[i] = c[0];
    this.d[i + 1] = c[1];
    this.d[i + 2] = c[2];
    this.d[i + 3] = 255;
  }
  get(x, y) {
    x = Math.max(0, Math.min(this.w - 1, Math.round(x)));
    y = Math.max(0, Math.min(this.h - 1, Math.round(y)));
    const i = (y * this.w + x) * 4;
    return [this.d[i], this.d[i + 1], this.d[i + 2]];
  }
  blend(x, y, c, a) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    for (let k = 0; k < 3; k++) this.d[i + k] = this.d[i + k] * (1 - a) + c[k] * a;
    this.d[i + 3] = 255;
  }
  copy() {
    const p = new Pix(this.w, this.h);
    p.d.set(this.d);
    return p;
  }
}

const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------ la paleta

const PAL = {
  day: {
    sky: ['#5b8fa8', '#8fb3b0', '#d9b07a', '#f2c886'],
    cloud: ['#fff3dc', '#f0cfa2'],
    sun: '#fff1c4',
    sunRing: '#ffe08a',
    far: { outline: '#5f8566', dark: '#7aa073', mid: '#93b77c', light: '#aecb86', hl: '#c6db92' },
    far2: { outline: '#8aa88a', dark: '#a3bf96', mid: '#b8d0a2', light: '#cadcac', hl: '#d9e6b6' },
    leaf: { outline: '#2b4a30', dark: '#3d6b3a', mid: '#5a9444', light: '#86bd4e', hl: '#b4d466' },
    wood: { outline: '#8a7350', dark: '#c8b288', mid: '#e5d4ac', light: '#f8eed4' },
    bark: { outline: '#4a3423', dark: '#6e4c32', mid: '#8e6644', light: '#b08458' },
    inner: {
      outline: '#4a3020',
      dark: '#6e4a2e',
      mid: '#8a6040',
      light: '#a87a50',
      ring: '#5e3e26',
    },
    gold: '#e9b44c',
    goldD: '#b07a22',
    inside: ['#5a3c22', '#7a5532', '#9a6e40'],
    stone: { outline: '#5f5a50', dark: '#9a9282', mid: '#c4bcab', light: '#e4ddcc' },
    water: ['#2f6f99', '#4fa3c7', '#9ad6ea'],
    flower: ['#4466c4', '#7f9ff0', '#fff4e0'],
    petal: '#f7a8b8',
    rug: ['#2f6a5e', '#4f8a7a', '#e9b44c'],
    cushion: ['#7b3b4a', '#a85a6a'],
    rope: '#a8875a',
    cream: '#fbf1dc',
    ink: '#8a7350',
    lantern: '#ffcf6b',
    lanternCore: '#fff6d6',
    glow: '#ffbf55',
    shadow: '#1e3a24',
    butterfly: ['#f2a03c', '#fff1c4'],
    firefly: '#ffe58a',
    shroom: '#f4efe6',
    spines: ['#7b3b4a', '#2f6a5e', '#a8701f', '#3d5f86', '#5e4a7a', '#4f7a52', '#8a3a2a'],
  },
  night: {
    sky: ['#0b1430', '#13224a', '#1e3462', '#2b467a'],
    cloud: ['#34466e', '#28385c'],
    moon: '#eef2f8',
    moonRing: '#9fb4d6',
    star: '#f2f5ff',
    far: { outline: '#132236', dark: '#1a2c44', mid: '#22384f', light: '#2b445c', hl: '#355068' },
    far2: { outline: '#1c3050', dark: '#23395c', mid: '#2b4468', light: '#344f76', hl: '#3d5a84' },
    leaf: { outline: '#0b1822', dark: '#152c3a', mid: '#1f4253', light: '#2d5c6c', hl: '#457e86' },
    wood: { outline: '#2a3446', dark: '#4a566c', mid: '#6b788f', light: '#95a2b8' },
    bark: { outline: '#121820', dark: '#232c3a', mid: '#323d4e', light: '#465266' },
    inner: {
      outline: '#120c08',
      dark: '#24180f',
      mid: '#33241a',
      light: '#463424',
      ring: '#1c120b',
    },
    gold: '#c9a24a',
    goldD: '#8a6a24',
    inside: ['#1e140c', '#3a2614', '#5a3a1c'],
    stone: { outline: '#1c222c', dark: '#3a4252', mid: '#566072', light: '#76829a' },
    water: ['#13304f', '#1f4c72', '#5f8fbf'],
    flower: ['#3a54a8', '#6f8fe0', '#d8e0f0'],
    petal: '#b88aa8',
    rug: ['#1f4a44', '#2f6458', '#c9a24a'],
    cushion: ['#4e2632', '#6e3a48'],
    rope: '#4a4a52',
    cream: '#d8d4c4',
    ink: '#6b788f',
    lantern: '#ffbf55',
    lanternCore: '#fff0c0',
    glow: '#ffbf55',
    shadow: '#060c14',
    butterfly: null,
    firefly: '#ffe58a',
    shroom: '#9ff5e0',
    spines: ['#5e2c3a', '#2a5a50', '#8a5c1c', '#2c4566', '#4a3a62', '#3c5f40', '#6a2e22'],
  },
};

const PALETTES = {};

function palette(mode) {
  if (PALETTES[mode]) return PALETTES[mode];
  const conv = (v) =>
    typeof v === 'string'
      ? hex(v)
      : Array.isArray(v)
        ? v.map(hex)
        : v && Object.fromEntries(Object.entries(v).map(([k, c]) => [k, hex(c)]));
  return (PALETTES[mode] = Object.fromEntries(
    Object.entries(PAL[mode]).map(([k, v]) => [k, conv(v)]),
  ));
}

// ------------------------------------------------------------ piezas

/** Rellena una máscara con contorno de color y un sombreado por píxel. */
function fillMask(px, inside, box, shade, outline) {
  const [x0, y0, x1, y1] = box.map(Math.round);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      px.set(x, y, edge && outline ? outline : shade(x, y));
    }
}

function rect(px, c, x, y, w, h) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px.set(x + i, y + j, c);
}

/** Halo sólido de dos anillos (las linternas de noche). */
function halo(px, c, cx, cy, r) {
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d < r) px.blend(x, y, c, d < r * 0.55 ? 0.22 : 0.11);
    }
}

function shadow(px, pal, cx, cy, rx, ry) {
  for (let y = cy - ry; y <= cy + ry; y++)
    for (let x = cx - rx; x <= cx + rx; x++)
      if (Math.pow((x - cx) / rx, 2) + Math.pow((y - cy) / ry, 2) < 1)
        px.blend(x, y, pal.shadow, 0.35);
}

/** Hoja chica que apunta arriba a la derecha (l = un tono más claro, h = brillo, d = nervio). */
const LEAF_GLYPH = ['..ll', '.lhl', 'lll.', 'd...'];

/**
 * Un grumo de hojas: lóbulos con el borde dentado (cada diente es la punta de una hoja),
 * luz arriba a la derecha y, adentro, hojitas dibujadas que apuntan hacia afuera.
 */
function clump(px, tones, cx, cy, r, { light = 1, outline = true, detail = 1 } = {}) {
  const lobes = [[0, 0, r]];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.75;
    lobes.push([Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.5, r * 0.58]);
  }
  const teeth = (rr) => Math.max(5, Math.round(rr * 0.9));
  const inside = (x, y) =>
    lobes.some(([dx, dy, rr]) => {
      const ox = x + 0.5 - cx - dx;
      const oy = (y + 0.5 - cy - dy) * 1.08;
      const d = Math.hypot(ox, oy);
      const f = ((Math.atan2(oy, ox) / (Math.PI * 2)) * teeth(rr) + 10) % 1;
      return d < rr * (0.86 + 0.2 * (1 - Math.abs(f * 2 - 1)));
    });
  const x0 = Math.floor(cx - r * 1.4);
  const y0 = Math.floor(cy - r * 1.4);
  const x1 = Math.ceil(cx + r * 1.4);
  const y1 = Math.ceil(cy + r * 1.2);
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const mask = new Uint8Array(bw * bh);
  const tone = new Array(bw * bh);
  const at = (x, y) => (x < x0 || y < y0 || x > x1 || y > y1 ? 0 : mask[(y - y0) * bw + (x - x0)]);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) if (inside(x, y)) mask[(y - y0) * bw + (x - x0)] = 1;
  const lighter = new Map([
    [tones.dark, tones.mid],
    [tones.mid, tones.light],
    [tones.light, tones.hl],
    [tones.hl, tones.hl],
  ]);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (!at(x, y)) continue;
      const v = ((x - cx) / r) * 0.55 * light - ((y - cy) / r) * 0.8;
      tone[(y - y0) * bw + (x - x0)] =
        v > 0.6 ? tones.hl : v > 0.15 ? tones.light : v > -0.45 ? tones.mid : tones.dark;
    }
  const step = detail > 0.6 ? 4 : 6;
  for (let gy = y0; gy <= y1; gy += step - 1)
    for (let gx = x0 + ((gy / (step - 1)) % 2 ? 2 : 0); gx <= x1; gx += step) {
      const jx = gx + Math.floor(hash(gx, gy, 3) * 2);
      const jy = gy + Math.floor(hash(gx, gy, 4) * 2);
      const left = jx < cx;
      LEAF_GLYPH.forEach((row, dy) =>
        [...row].forEach((ch, dx) => {
          if (ch === '.') return;
          const x = left ? jx + 3 - dx : jx + dx;
          const y = jy + dy;
          if (!at(x, y) || !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1)) return;
          const k = (y - y0) * bw + (x - x0);
          const b = tone[k];
          tone[k] =
            ch === 'd'
              ? tones.dark
              : ch === 'h'
                ? b === tones.dark
                  ? tones.mid
                  : tones.hl
                : (lighter.get(b) ?? b);
        }),
      );
    }
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (!at(x, y)) continue;
      const edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
      px.set(x, y, edge && outline ? tones.outline : tone[(y - y0) * bw + (x - x0)]);
    }
}

/** Rama (o tronco): línea con grosor que se afina, luz de un lado y veta. */
function limb(px, tones, pts, w0, w1, light = 1) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    segs.push([pts[i], pts[i + 1], total, L]);
    total += L;
  }
  const nearest = (x, y) => {
    let best = null;
    for (const [[ax, ay], [bx, by], start, L] of segs) {
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / (L * L)));
      const qx = ax + (bx - ax) * t;
      const qy = ay + (by - ay) * t;
      const d = Math.hypot(x - qx, y - qy);
      const side = Math.sign((bx - ax) * (y - ay) - (by - ay) * (x - ax));
      const along = (start + t * L) / total;
      if (!best || d < best.d) best = { d, side, along, w: w0 + (w1 - w0) * along };
    }
    return best;
  };
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const pad = Math.max(w0, w1) + 2;
  fillMask(
    px,
    (x, y) => {
      const n = nearest(x + 0.5, y + 0.5);
      return n.d < n.w;
    },
    [
      Math.min(...xs) - pad,
      Math.max(-2, Math.min(...ys) - pad),
      Math.max(...xs) + pad,
      Math.min(H + 2, Math.max(...ys) + pad),
    ],
    (x, y) => {
      const n = nearest(x + 0.5, y + 0.5);
      const k = n.d / n.w;
      const lit = n.side * light;
      let tone = lit < 0 && k > 0.35 ? tones.light : lit > 0 && k > 0.45 ? tones.dark : tones.mid;
      if (tone === tones.mid && Math.round(n.along * 90 + k * 3) % 7 === 0 && k < 0.6)
        tone = tones.dark;
      return tone;
    },
    tones.outline,
  );
}

function sky(px, pal, night, bands, { sun, moon, clouds }) {
  for (let y = 0; y < px.h; y++) {
    let b = 0;
    bands.forEach((v, i) => {
      if (y >= v) b = i;
    });
    for (let x = 0; x < px.w; x++) px.set(x, y, pal.sky[b]);
  }
  const disc = (cx, cy, inner, ring, c, cr) => {
    for (let y = -ring; y <= ring; y++)
      for (let x = -ring; x <= ring; x++) {
        const d = Math.hypot(x, y);
        if (d < inner) px.set(cx + x, cy + y, c);
        else if (d < ring) px.set(cx + x, cy + y, cr);
      }
  };
  if (night) {
    const r = rng(5);
    for (let i = 0; i < 70; i++) px.set(Math.floor(r() * px.w), Math.floor(r() * 90), pal.star);
    if (moon) disc(moon[0], moon[1], 7, 9, pal.moon, pal.moonRing);
  } else if (sun) disc(sun[0], sun[1], 8, 10, pal.sun, pal.sunRing);
  for (const [cx, cy, w] of clouds) {
    rect(px, pal.cloud[1], cx - w / 2 + 2, cy + 3, w - 4, 2);
    rect(px, pal.cloud[0], cx - w / 2, cy, w, 3);
    rect(px, pal.cloud[0], cx - w / 4, cy - 3, w / 2, 3);
  }
}

function flowers(px, pal, x, y, n, seed) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const fx = Math.round(x + (r() - 0.5) * 26);
    const fy = Math.round(y + (r() - 0.5) * 8);
    rect(px, pal.leaf.light, fx, fy + 1, 1, 3);
    const c = r() < 0.7 ? pal.flower[0] : pal.flower[1];
    px.set(fx, fy, c);
    px.set(fx - 1, fy, c);
    px.set(fx + 1, fy, c);
    px.set(fx, fy - 1, c);
    px.set(fx, fy, pal.flower[2]);
  }
}

function planter(px, pal, cx, bottom) {
  const w = pal.wood;
  fillMask(
    px,
    (x, y) => y >= bottom - 8 && y < bottom && Math.abs(x - cx) < 9 - (bottom - y) * 0.15,
    [cx - 9, bottom - 8, cx + 9, bottom],
    (x) => (x < cx - 5 ? w.light : w.mid),
    w.outline,
  );
  rect(px, pal.gold, cx - 7, bottom - 6, 15, 1);
  clump(px, pal.leaf, cx, bottom - 12, 7, { detail: 0.5 });
  flowers(px, pal, cx, bottom - 14, 6, cx);
}

function lantern(px, pal, x, y, night, size = 1) {
  if (size > 1) {
    rect(px, pal.goldD, x - 3, y, 7, 9);
    rect(px, pal.lantern, x - 2, y + 1, 5, 6);
    rect(px, pal.lanternCore, x - 1, y + 2, 3, 3);
    rect(px, pal.gold, x - 2, y - 1, 5, 1);
    if (night) halo(px, pal.glow, x, y + 4, 20);
  } else {
    rect(px, pal.goldD, x - 2, y, 5, 7);
    rect(px, pal.lantern, x - 1, y + 1, 3, 5);
    rect(px, pal.lanternCore, x, y + 2, 1, 3);
    if (night) halo(px, pal.glow, x, y + 3, 14);
  }
}

function lampPost(px, pal, x, bottom, h, night) {
  const w = pal.wood;
  rect(px, w.outline, x - 2, bottom - h, 5, h);
  rect(px, w.mid, x - 1, bottom - h + 1, 3, h - 2);
  rect(px, w.light, x - 1, bottom - h + 1, 1, h - 2);
  rect(px, w.outline, x - 4, bottom - 2, 9, 2);
  const top = bottom - h - 10;
  rect(px, pal.goldD, x - 4, top, 9, 11);
  rect(px, pal.lantern, x - 3, top + 2, 7, 7);
  rect(px, pal.lanternCore, x - 1, top + 3, 3, 4);
  rect(px, pal.gold, x - 3, top + 1, 7, 1);
  rect(px, pal.gold, x - 2, top - 1, 5, 1);
  rect(px, pal.goldD, x, top - 2, 1, 1);
  if (night) halo(px, pal.glow, x, top + 5, 22);
}

/** Una guirnalda de lucecitas colgada entre dos puntos (cuelga en curva). */
function garland(px, pal, x0, y0, x1, y1, sag, night) {
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
    const t = (x - x0) / (x1 - x0);
    const y = Math.round(y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag);
    px.set(x, y, pal.rope);
    if (Math.round(t * 100) % 12 === 0) {
      px.set(x, y + 1, pal.lantern);
      px.set(x, y + 2, pal.lanternCore);
      if (night) halo(px, pal.glow, x, y + 2, 5);
    }
  }
}

/**
 * El ascensor de lianas (la puerta entre las salas): dos cuerdas que bajan de una rama y
 * una canasta de madera clara con hojas y una linterna.
 */
function liftBasket(px, pal, x, top, bottom, night) {
  const w = pal.wood;
  for (let y = top; y < bottom - 10; y++) {
    px.set(x + 2, y, pal.rope);
    px.set(x + 15, y, pal.rope);
    if (y % 9 === 0) {
      px.set(x + 1, y, pal.leaf.mid);
      px.set(x + 16, y + 3, pal.leaf.light);
    }
  }
  fillMask(
    px,
    (X, Y) =>
      Y >= bottom - 10 &&
      Y < bottom &&
      X >= x + Math.max(0, Y - (bottom - 3)) &&
      X <= x + 17 - Math.max(0, Y - (bottom - 3)),
    [x, bottom - 10, x + 17, bottom],
    (X, Y) => ((Y - bottom) % 3 === 0 ? w.dark : X < x + 3 ? w.light : w.mid),
    w.outline,
  );
  rect(px, pal.gold, x + 1, bottom - 8, 16, 1);
  clump(px, pal.leaf, x + 4, bottom - 11, 4, { detail: 0.5 });
  lantern(px, pal, x + 12, bottom - 18, night);
}

// ------------------------------------------------------------ la biblioteca sobre la copa

/** El borde de la plataforma: se está parado arriba de la copa, casi plana, que se curva. */
const rim = (x) => 196 - 104 * Math.sqrt(Math.max(0, 1 - Math.pow((x - 170) / 225, 2)));

const LIB_SHELF = { cx: 160, top: 62, bottom: 110, w: 36 };

function shelfCabinet(px, pal, s) {
  const w = pal.wood;
  const x0 = s.cx - s.w - 5;
  const x1 = s.cx + s.w + 5;
  const top = s.top - 10;
  const bottom = s.bottom + 6;
  const arch = (x, y) => {
    if (x < x0 || x > x1 || y < top || y > bottom) return false;
    const u = (x - s.cx) / (s.w + 5);
    return y >= top + 16 * (1 - Math.sqrt(Math.max(0, 1 - u * u)));
  };
  const inner = (x, y) => {
    if (x < s.cx - s.w || x > s.cx + s.w || y < s.top - 4 || y > s.bottom) return false;
    const u = (x - s.cx) / s.w;
    return y >= s.top - 4 + 12 * (1 - Math.sqrt(Math.max(0, 1 - u * u)));
  };
  fillMask(
    px,
    arch,
    [x0, top, x1, bottom],
    (x, y) => (inner(x, y) ? pal.inside[1] : x < s.cx - s.w + 2 || y < top + 4 ? w.light : w.mid),
    w.outline,
  );
  fillMask(
    px,
    inner,
    [x0, top, x1, bottom],
    (x, y) =>
      y > s.bottom - 10 ? pal.inside[2] : (x - x0) % 9 === 0 ? pal.inside[0] : pal.inside[1],
    pal.goldD,
  );
  rect(px, w.outline, x0 - 2, s.bottom + 1, x1 - x0 + 5, 6);
  rect(px, w.light, x0 - 1, s.bottom + 2, x1 - x0 + 3, 2);
  rect(px, w.mid, x0 - 1, s.bottom + 4, x1 - x0 + 3, 2);
  rect(px, pal.gold, x0, s.bottom + 4, x1 - x0 + 1, 1);
  const crest = [
    'gg.........gg',
    'Gggg.....gggG',
    '.Gggg...ggggG',
    '..GGgggggGG..',
    '....GgwgG....',
    '.....GwG.....',
    '......G......',
  ];
  crest.forEach((row, dy) =>
    [...row].forEach((ch, dx) => {
      const c = ch === 'g' ? pal.gold : ch === 'G' ? pal.goldD : ch === 'w' ? pal.cream : null;
      if (c) px.set(s.cx - 6 + dx, top - 6 + dy, c);
    }),
  );
}

function deckFloor(px, pal) {
  const w = pal.wood;
  const VP = { x: 160, y: 28 };
  const K = 7;
  const L = 14;
  for (let x = 0; x < W; x++)
    for (let y = Math.round(rim(x)) + 3; y < H; y++) {
      const dy = y - VP.y;
      const f = ((x - VP.x) / dy) * K;
      const plank = Math.floor(f);
      const seam = (f - plank) * (dy / K) < 1;
      const z = 1000 / dy;
      const end = (((z / L + plank * 0.37) % 1) + 1) % 1 < 1000 / (dy * dy) / L;
      px.set(
        x,
        y,
        seam || end ? w.outline : (plank * 7) % 5 === 0 ? w.dark : plank % 2 ? w.mid : w.light,
      );
    }
}

function railing(px, pal) {
  const w = pal.wood;
  for (let x = 0; x < W; x++) {
    const y = Math.round(rim(x)) + 2;
    for (let dy = 0; dy < 3; dy++)
      px.set(x, y - 12 + dy, dy === 0 ? w.outline : dy === 1 ? w.light : w.mid);
    px.set(x, y - 9, w.outline);
    px.set(x, y - 4, pal.gold);
    px.set(x, y + 1, w.outline);
    px.set(x, y + 2, w.dark);
  }
  for (let x = 4; x < W; x += 13) {
    const y = Math.round(rim(x)) + 2;
    for (let dy = -9; dy < 1; dy++) {
      px.set(x, y + dy, w.outline);
      px.set(x + 1, y + dy, w.light);
      px.set(x + 2, y + dy, w.mid);
      px.set(x + 3, y + dy, w.outline);
    }
    px.set(x + 1, y - 13, pal.gold);
    px.set(x + 2, y - 13, pal.gold);
  }
}

function sideBookcase(px, pal, x, bottom, w, h, seed) {
  const wd = pal.wood;
  const top = bottom - h;
  fillMask(
    px,
    (X, Y) => X >= x && X < x + w && Y >= top && Y < bottom,
    [x, top, x + w, bottom],
    (X) => (X < x + 3 ? wd.light : X > x + w - 4 ? wd.dark : wd.mid),
    wd.outline,
  );
  rect(px, pal.inside[1], x + 4, top + 5, w - 8, h - 9);
  rect(px, wd.outline, x - 2, top - 2, w + 4, 4);
  rect(px, wd.light, x - 1, top - 1, w + 2, 2);
  rect(px, pal.gold, x, top + 2, w, 1);
  const r = rng(seed);
  const shelfH = Math.floor((h - 9) / 3);
  for (let k = 0; k < 3; k++) {
    const base = top + 5 + shelfH * (k + 1);
    rect(px, wd.outline, x + 3, base - 1, w - 6, 2);
    rect(px, wd.light, x + 4, base - 1, w - 8, 1);
    let bx = x + 5;
    while (bx < x + w - 8) {
      const bw = 2 + Math.floor(r() * 3);
      const bh = shelfH - 4 - Math.floor(r() * 4);
      const c = pal.spines[Math.floor(r() * pal.spines.length)];
      rect(
        px,
        c.map((v) => v * 0.7),
        bx,
        base - 1 - bh,
        bw,
        bh,
      );
      rect(px, c, bx, base - bh, Math.max(1, bw - 1), bh - 1);
      px.set(bx, base - bh + 2, pal.gold);
      bx += bw + (r() < 0.15 ? 2 : 0);
    }
  }
}

/** El rincón de lectura: silla con cojín, mesita con el libro abierto y una taza. */
function readingNook(px, pal, x, bottom) {
  const w = pal.wood;
  shadow(px, pal, x + 16, bottom, 22, 3);
  fillMask(
    px,
    (X, Y) => Math.pow((X - x - 16) / 20, 2) + Math.pow((Y - bottom + 1) / 3.5, 2) < 1,
    [x - 6, bottom - 6, x + 38, bottom + 4],
    () => pal.rug[1],
    pal.rug[2],
  );
  fillMask(
    px,
    (X, Y) =>
      X >= x &&
      X <= x + 9 &&
      Y >= bottom - 20 &&
      Y <= bottom - 9 &&
      Y >= bottom - 20 + 3 * (1 - Math.sqrt(Math.max(0, 1 - Math.pow((X - x - 4.5) / 4.5, 2)))),
    [x, bottom - 20, x + 9, bottom - 9],
    (X, Y) => (X < x + 2 ? w.light : (X + Y) % 3 === 0 ? w.dark : w.mid),
    w.outline,
  );
  rect(px, w.outline, x - 1, bottom - 10, 13, 3);
  rect(px, pal.cushion[1], x, bottom - 10, 11, 1);
  rect(px, pal.cushion[0], x, bottom - 9, 11, 1);
  for (const lx of [x, x + 10]) rect(px, w.outline, lx, bottom - 7, 1, 6);
  rect(px, w.outline, x + 16, bottom - 12, 18, 3);
  rect(px, w.light, x + 17, bottom - 12, 16, 1);
  rect(px, pal.gold, x + 17, bottom - 10, 16, 1);
  rect(px, w.outline, x + 24, bottom - 9, 3, 8);
  rect(px, w.mid, x + 25, bottom - 9, 1, 7);
  rect(px, w.outline, x + 21, bottom - 2, 9, 1);
  rect(px, w.outline, x + 18, bottom - 16, 11, 4);
  rect(px, pal.cream, x + 19, bottom - 15, 4, 2);
  rect(px, pal.cream, x + 24, bottom - 15, 4, 2);
  rect(px, pal.stone.outline, x + 30, bottom - 15, 3, 3);
  px.set(x + 31, bottom - 14, pal.cream);
}

function libraryBase(mode) {
  const pal = palette(mode);
  const night = mode === 'night';
  const light = night ? -1 : 1;
  const px = new Pix();
  sky(px, pal, night, [0, 30, 62, 90], {
    sun: [272, 84],
    moon: [270, 30],
    clouds: [
      [60, 40, 34],
      [210, 22, 28],
      [130, 70, 22],
    ],
  });
  for (let x = -6; x < W + 20; x += 18)
    clump(px, pal.far2, x, 70 + (((x + 40) * 13) % 9), 14, { light, detail: 0.5 });
  for (let x = -10; x < W + 20; x += 16)
    clump(px, pal.far, x, 90 + (((x + 40) * 7) % 9), 14, { light, detail: 0.5 });
  const wd = pal.wood;
  limb(
    px,
    wd,
    [
      [30, 140],
      [22, 80],
      [36, 30],
      [26, -4],
    ],
    9,
    5,
    light,
  );
  limb(
    px,
    wd,
    [
      [294, 136],
      [306, 80],
      [292, 30],
      [304, -4],
    ],
    9,
    5,
    light,
  );
  limb(
    px,
    wd,
    [
      [76, 118],
      [88, 70],
      [80, 26],
      [92, -4],
    ],
    6,
    3,
    light,
  );
  limb(
    px,
    wd,
    [
      [248, 116],
      [236, 66],
      [250, 24],
      [240, -4],
    ],
    6,
    3,
    light,
  );
  // Guirnaldas de lucecitas entre las ramas: llenan el cielo de entre las copas.
  garland(px, pal, 34, 66, 82, 60, 8, night);
  garland(px, pal, 240, 58, 300, 70, 9, night);
  garland(px, pal, 94, 40, 120, 30, 4, night);
  for (const [x, y, r] of [
    [14, 44, 20],
    [46, 16, 18],
    [76, 34, 15],
    [96, 8, 14],
    [230, 30, 15],
    [252, 8, 15],
    [286, 46, 20],
    [314, 16, 18],
    [6, 92, 14],
    [318, 94, 15],
  ])
    clump(px, pal.leaf, x, y, r, { light });
  for (let x = -6; x < W + 10; x += 14)
    clump(px, pal.leaf, x, rim(x) - 3 + ((x * 7) % 5), 11 + ((x * 3) % 4), { light });
  deckFloor(px, pal);
  railing(px, pal);
  shadow(px, pal, 64, 132, 34, 4);
  sideBookcase(px, pal, 34, 131, 58, 50, 11);
  shadow(px, pal, 256, 130, 34, 4);
  sideBookcase(px, pal, 228, 129, 58, 50, 12);
  const s = LIB_SHELF;
  shadow(px, pal, s.cx, s.bottom + 6, s.w + 12, 4);
  shelfCabinet(px, pal, s);
  limb(
    px,
    wd,
    [
      [s.cx - s.w - 9, s.bottom + 7],
      [s.cx - s.w - 10, s.top + 6],
      [s.cx - s.w + 4, s.top - 17],
      [s.cx, s.top - 21],
    ],
    5,
    3,
    light,
  );
  limb(
    px,
    wd,
    [
      [s.cx + s.w + 9, s.bottom + 7],
      [s.cx + s.w + 10, s.top + 6],
      [s.cx + s.w - 4, s.top - 17],
      [s.cx, s.top - 21],
    ],
    5,
    3,
    light,
  );
  for (const [dx, dy, r] of [
    [-s.w + 2, -22, 10],
    [-s.w * 0.4, -29, 11],
    [s.w * 0.4, -29, 11],
    [s.w - 2, -22, 10],
    [0, -25, 9],
  ])
    clump(px, pal.leaf, s.cx + dx, s.top + dy, r, { light });
  for (const side of [-1, 1])
    for (const k of [-1, 1])
      limb(
        px,
        wd,
        [
          [s.cx + side * (s.w + 9), s.bottom + 5],
          [s.cx + side * (s.w + 9) + k * 5, s.bottom + 9],
        ],
        2,
        1,
        light,
      );
  for (const lx of [s.cx - s.w - 2, s.cx + s.w + 2]) {
    rect(px, wd.outline, lx, s.top - 8, 1, 5);
    lantern(px, pal, lx, s.top - 3, night);
  }
  fillMask(
    px,
    (x, y) => Math.pow((x - 160) / 38, 2) + Math.pow((y - 128) / 6, 2) < 1,
    [120, 120, 200, 136],
    (x, y) => {
      const d = Math.pow((x - 160) / 38, 2) + Math.pow((y - 128) / 6, 2);
      return d > 0.72 ? pal.rug[2] : d > 0.3 ? pal.rug[0] : pal.rug[1];
    },
    pal.rug[0].map((v) => v * 0.7),
  );
  readingNook(px, pal, 90, 141);
  shadow(px, pal, 226, 156, 6, 2);
  lampPost(px, pal, 226, 156, 30, night);
  // El ascensor de lianas, a la derecha: sube a tu estudio.
  shadow(px, pal, 299, 150, 12, 3);
  liftBasket(px, pal, 290, 0, 150, night);
  planter(px, pal, 28, 160);
  planter(px, pal, 266, 168);
  for (const [x, y, r] of [
    [-4, 178, 22],
    [20, 186, 16],
    [324, 182, 18],
  ])
    clump(px, pal.leaf, x, y, r, { light });
  return px;
}

// ------------------------------------------------------------ tu hueco arriba en el árbol

const HOLLOW_SHELF = { cx: 160, top: 80, bottom: 118, w: 46 };

const opening = (x, y) => {
  const cx = 160;
  const half = 88;
  const top = 12;
  const rise = 46;
  if (x < cx - half || x > cx + half || y > 118 || y < top) return false;
  const u = (x - cx) / half;
  return y >= top + rise * (1 - Math.sqrt(Math.max(0, 1 - u * u)));
};

function hollowBase(mode) {
  const pal = palette(mode);
  const night = mode === 'night';
  const light = night ? -1 : 1;
  const inner = pal.inner;
  const bark = pal.bark;
  const wd = pal.wood;
  const px = new Pix();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ring = Math.sin(Math.hypot(x - 160, (y - 70) * 1.4) / 5) > 0.92;
      const grain = (x * 3 + Math.round(Math.sin(y / 9) * 3)) % 17 === 0;
      px.set(
        x,
        y,
        ring
          ? inner.ring
          : grain
            ? inner.dark
            : y < 30 || x < 20 || x > 300
              ? inner.dark
              : inner.mid,
      );
    }
  // Afuera: el cielo, las copas abajo (se está alto) y la plataforma de la biblioteca.
  const view = new Pix();
  sky(view, pal, night, [0, 30, 58, 84], {
    sun: [206, 66],
    moon: [212, 34],
    clouds: [
      [110, 30, 26],
      [220, 46, 20],
    ],
  });
  for (let x = 60; x < 270; x += 13)
    clump(view, pal.far2, x, 84 + ((x * 7) % 5), 11, { light, detail: 0.4 });
  for (let x = 60; x < 270; x += 15)
    clump(view, pal.far, x, 98 + ((x * 5) % 6), 13, { light, detail: 0.5 });
  for (let x = 92; x < 150; x++) {
    const y = 104 + Math.round(Math.pow((x - 121) / 29, 2) * 3);
    view.set(x, y, wd.outline);
    view.set(x, y + 1, wd.light);
    view.set(x, y + 2, wd.mid);
    view.set(x, y + 3, wd.outline);
  }
  for (let x = 94; x < 150; x += 5) for (let y = 101; y < 104; y++) view.set(x, y, wd.outline);
  for (const bx of [104, 130]) {
    rect(view, wd.outline, bx, 94, 9, 10);
    rect(view, pal.inside[1], bx + 1, 95, 7, 8);
    for (let i = 0; i < 3; i++) rect(view, pal.spines[i], bx + 2 + i * 2, 97, 1, 5);
  }
  rect(view, pal.goldD, 120, 92, 2, 3);
  view.set(120, 93, pal.lantern);
  if (night) halo(view, pal.glow, 121, 93, 9);
  for (let x = 90; x < 160; x += 9)
    clump(view, pal.leaf, x, 116 + ((x * 3) % 4), 8, { light, detail: 0.5 });
  limb(
    view,
    bark,
    [
      [226, 120],
      [252, 102],
      [278, 92],
      [300, 88],
    ],
    6,
    3,
    light,
  );
  for (const [x, y, r] of [
    [262, 88, 12],
    [288, 80, 13],
    [244, 96, 9],
  ])
    clump(view, pal.leaf, x, y, r, { light });
  // El ascensor de lianas cuelga del arco, afuera a la derecha: baja a la biblioteca.
  liftBasket(view, pal, 214, 14, 112, night);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (opening(x, y)) px.set(x, y, view.get(x, y));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (opening(x, y)) continue;
      const near = [1, 2, 3, 4, 5, 6].find(
        (k) => opening(x - k, y) || opening(x + k, y) || opening(x, y + k),
      );
      if (near === undefined) continue;
      const lit = (x < 160 ? 1 : -1) * light;
      px.set(
        x,
        y,
        near === 1 || near === 6
          ? bark.outline
          : near < 3
            ? lit > 0
              ? bark.light
              : bark.mid
            : bark.dark,
      );
    }
  for (let x = 72; x < 249; x++) {
    const sag = Math.round(Math.pow((x - 160) / 88, 2) * -2);
    for (let dy = 0; dy < 8; dy++)
      px.set(
        x,
        118 + dy + sag,
        dy === 0 || dy === 7 ? bark.outline : dy < 3 ? bark.light : bark.mid,
      );
  }
  for (const [x, y, r] of [
    [78, 60, 9],
    [70, 88, 8],
    [244, 58, 9],
    [250, 84, 8],
    [120, 14, 7],
    [200, 14, 7],
  ])
    clump(px, pal.leaf, x, y, r, { light });
  for (const vx of [96, 104, 226])
    for (let y = 18; y < 18 + 14 + (vx % 9); y++) {
      px.set(vx + Math.round(Math.sin(y / 3)), y, pal.leaf.mid);
      if (y % 4 === 0) px.set(vx + 1 + Math.round(Math.sin(y / 3)), y, pal.leaf.light);
    }
  // Repisas en las paredes: frascos y un libro a la izquierda, hierbas secas a la derecha.
  for (const [sx, sy] of [
    [8, 66],
    [270, 70],
  ]) {
    rect(px, wd.outline, sx, sy, 42, 3);
    rect(px, wd.light, sx + 1, sy, 40, 1);
    rect(px, wd.outline, sx + 4, sy + 3, 2, 5);
    rect(px, wd.outline, sx + 36, sy + 3, 2, 5);
  }
  for (const [jx, jh, c] of [
    [11, 8, pal.water[1]],
    [19, 6, pal.flower[1]],
    [26, 9, pal.leaf.light],
  ]) {
    rect(px, pal.stone.outline, jx, 66 - jh, 6, jh);
    rect(px, c, jx + 1, 66 - jh + 2, 4, jh - 2);
    rect(px, pal.cream, jx + 1, 66 - jh, 4, 1);
  }
  rect(px, pal.spines[3], 35, 58, 3, 8);
  rect(px, pal.spines[0], 38, 59, 3, 7);
  rect(px, pal.spines[2], 41, 60, 4, 6);
  for (const hx of [274, 282, 290, 298, 306]) {
    rect(px, pal.rope, hx, 73, 1, 3);
    for (let k = 0; k < 7; k++)
      px.set(hx + (k % 2 ? 1 : -1), 76 + k, k % 3 ? pal.leaf.mid : pal.leaf.light);
  }
  // El piso de tablas claras.
  for (let y = 136; y < H; y++)
    for (let x = 0; x < W; x++) {
      const row = Math.floor((y - 136) / 7);
      const seam = (y - 136) % 7 === 0 || (x + row * 23) % 41 === 0;
      px.set(x, y, seam ? wd.outline : row % 2 ? wd.mid : wd.light);
    }
  for (let x = 0; x < W; x++) {
    px.set(x, 135, inner.outline);
    px.set(x, 134, inner.dark);
  }
  fillMask(
    px,
    (x, y) => Math.pow((x - 160) / 52, 2) + Math.pow((y - 152) / 8, 2) < 1,
    [106, 142, 214, 162],
    (x, y) => {
      const d = Math.pow((x - 160) / 52, 2) + Math.pow((y - 152) / 8, 2);
      return d > 0.72 ? pal.rug[2] : d > 0.3 ? pal.rug[0] : pal.rug[1];
    },
    pal.rug[0].map((v) => v * 0.7),
  );
  // A la izquierda, el nido de cojines con su manta y un par de libros.
  shadow(px, pal, 40, 150, 32, 4);
  fillMask(
    px,
    (x, y) => Math.pow((x - 40) / 30, 2) + Math.pow((y - 142) / 10, 2) < 1,
    [8, 130, 72, 154],
    (x, y) => (y < 138 ? pal.cushion[1] : pal.cushion[0]),
    pal.cushion[0].map((v) => v * 0.6),
  );
  fillMask(
    px,
    (x, y) => x >= 22 && x <= 58 && y >= 136 && y <= 146 && (x + y) % 11 !== 0,
    [22, 136, 58, 146],
    (x) => ((x >> 2) % 2 ? pal.rug[1] : pal.rug[0]),
    null,
  );
  for (const [cx, cy, r] of [
    [18, 134, 7],
    [62, 135, 6],
  ])
    fillMask(
      px,
      (x, y) => Math.hypot(x - cx, (y - cy) * 1.3) < r,
      [cx - r, cy - r, cx + r, cy + r],
      (x, y) => (y < cy ? pal.cream : pal.stone.light),
      pal.stone.outline,
    );
  rect(px, pal.stone.outline, 66, 142, 12, 6);
  rect(px, pal.spines[3], 67, 143, 10, 2);
  rect(px, pal.spines[2], 67, 145, 10, 2);
  // A la derecha, la mesita con su linterna y una maceta; al frente, un cesto de rollos.
  shadow(px, pal, 276, 152, 22, 3);
  rect(px, wd.outline, 258, 132, 36, 4);
  rect(px, wd.light, 259, 132, 34, 2);
  rect(px, pal.gold, 259, 134, 34, 1);
  for (const lx of [261, 289]) {
    rect(px, wd.outline, lx, 136, 3, 15);
    rect(px, wd.mid, lx + 1, 136, 1, 14);
  }
  lantern(px, pal, 283, 122, night, 2);
  planter(px, pal, 268, 132);
  shadow(px, pal, 236, 170, 10, 2);
  fillMask(
    px,
    (x, y) => y >= 160 && y < 171 && Math.abs(x - 236) < 9 - (170 - y) * 0.1,
    [226, 160, 246, 171],
    (x, y) => ((y - 160) % 3 === 0 ? wd.dark : wd.mid),
    wd.outline,
  );
  for (const [rx, rh] of [
    [231, 7],
    [235, 9],
    [239, 6],
  ]) {
    rect(px, pal.stone.outline, rx, 160 - rh, 3, rh);
    rect(px, pal.cream, rx + 1, 160 - rh, 1, rh);
  }
  for (const lx of [36, 290]) {
    rect(px, inner.outline, lx, 0, 1, 40);
    lantern(px, pal, lx, 40, night, 2);
  }
  for (const [mx, my] of [
    [12, 100],
    [20, 108],
    [304, 96],
  ]) {
    rect(px, inner.outline, mx - 3, my - 2, 7, 3);
    rect(px, pal.shroom, mx - 2, my - 2, 5, 2);
    rect(px, pal.stone.light, mx, my + 1, 1, 3);
    if (night) halo(px, pal.shroom, mx, my, 9);
  }
  return px;
}

// ------------------------------------------------------------ la portada: el lago

const HORIZON = 112;

function forestRidge(px, tones, base, amp, step, seed, light) {
  for (let x = 0; x < W; x++) {
    const top = Math.round(base - amp * (0.5 + 0.5 * Math.sin(x / 37 + seed)));
    for (let y = top; y < HORIZON; y++) px.set(x, y, tones.dark);
  }
  for (let x = -8; x < W + 10; x += step) {
    const top = Math.round(base - amp * (0.5 + 0.5 * Math.sin(x / 37 + seed)));
    clump(px, tones, x + ((x * 7) % 4), top + 2, step * 0.7, { light, detail: 0.4 });
  }
}

function lakeBase(mode) {
  const pal = palette(mode);
  const night = mode === 'night';
  const light = night ? -1 : 1;
  const bark = pal.bark;
  const wd = pal.wood;
  const px = new Pix();
  sky(px, pal, night, [0, 34, 66, 92], {
    sun: [112, 84],
    moon: [150, 22],
    clouds: [
      [40, 22, 30],
      [150, 40, 26],
      [290, 16, 22],
    ],
  });
  // Una bandada lejana (de día).
  if (!night)
    for (const [bx, by] of [
      [176, 30],
      [184, 26],
      [190, 33],
      [70, 46],
    ]) {
      px.set(bx, by, pal.bark.outline);
      px.set(bx + 1, by + 1, pal.bark.outline);
      px.set(bx + 2, by, pal.bark.outline);
    }
  forestRidge(px, pal.far2, 102, 4, 9, 1, light);
  forestRidge(px, pal.far, 107, 3, 10, 4, light);
  for (let x = 150; x < W; x++) {
    const top = Math.round(HORIZON - 4 - 5 * Math.sin((Math.min(1, (x - 150) / 60) * Math.PI) / 2));
    for (let y = top; y < HORIZON + 2; y++)
      px.set(x, y, y === top ? pal.leaf.light : y < top + 3 ? pal.leaf.mid : pal.leaf.dark);
  }
  limb(
    px,
    bark,
    [
      [236, HORIZON + 1],
      [230, 92],
      [238, 70],
      [234, 52],
    ],
    15,
    9,
    light,
  );
  for (const [dx, k] of [
    [-1, 24],
    [1, 22],
    [-1, 12],
  ])
    limb(
      px,
      bark,
      [
        [236, HORIZON - 6],
        [236 + dx * k, HORIZON + 2],
      ],
      6,
      2,
      light,
    );
  limb(
    px,
    bark,
    [
      [232, 74],
      [196, 58],
      [170, 54],
    ],
    6,
    3,
    light,
  );
  limb(
    px,
    bark,
    [
      [238, 68],
      [276, 52],
      [302, 50],
    ],
    6,
    3,
    light,
  );
  for (const [x, y, r] of [
    [236, 40, 30],
    [196, 48, 24],
    [276, 46, 25],
    [170, 60, 17],
    [300, 58, 18],
    [214, 26, 22],
    [258, 24, 22],
    [236, 60, 20],
    [190, 68, 13],
    [282, 70, 13],
    [236, 20, 18],
  ])
    clump(px, pal.leaf, x, y, r, { light });
  // En la cima de la copa, la biblioteca: plataforma con baranda, el arco con libros y linternas.
  const top = 8;
  for (let x = 210; x < 264; x++) {
    px.set(x, top + 10, wd.outline);
    px.set(x, top + 11, wd.light);
    px.set(x, top + 12, wd.mid);
    px.set(x, top + 13, wd.outline);
    px.set(x, top + 5, wd.outline);
    px.set(x, top + 6, wd.light);
  }
  for (let x = 210; x < 264; x += 6)
    for (let y = top + 6; y < top + 10; y++) px.set(x, y, wd.outline);
  const ax0 = 226;
  const ax1 = 248;
  for (let y = top - 6; y < top + 10; y++) {
    px.set(ax0, y, wd.outline);
    px.set(ax0 + 1, y, wd.light);
    px.set(ax1 - 1, y, wd.mid);
    px.set(ax1, y, wd.outline);
  }
  for (let x = ax0; x <= ax1; x++) {
    const y = Math.round(top - 6 - Math.sin(((x - ax0) / (ax1 - ax0)) * Math.PI) * 4);
    px.set(x, y, wd.outline);
    px.set(x, y + 1, wd.light);
  }
  rect(px, pal.inside[1], ax0 + 2, top - 4, ax1 - ax0 - 3, 14);
  for (let x = ax0 + 3, i = 0; x < ax1 - 2; x += 3, i++)
    rect(px, pal.spines[i % pal.spines.length], x, top - 1 - (i % 2), 2, 10 + (i % 2));
  rect(px, wd.outline, ax0, top + 9, ax1 - ax0 + 1, 1);
  px.set(237, top - 11, pal.gold);
  px.set(236, top - 10, pal.gold);
  px.set(238, top - 10, pal.gold);
  for (const lx of [216, 258]) {
    rect(px, pal.goldD, lx - 1, top - 2, 3, 5);
    px.set(lx, top - 1, pal.lantern);
    px.set(lx, top, pal.lanternCore);
    if (night) halo(px, pal.glow, lx, top, 14);
  }
  // A la izquierda, un muelle de tablas claras que entra al lago, con su farol.
  for (let y = HORIZON + 6; y < HORIZON + 10; y++)
    for (let x = 0; x < 70; x++)
      px.set(x, y, y === HORIZON + 6 ? wd.light : x % 7 === 0 ? wd.outline : wd.mid);
  for (const lx of [8, 30, 52, 68]) rect(px, wd.outline, lx, HORIZON + 10, 2, 8);
  rect(px, wd.outline, 64, HORIZON - 14, 3, 20);
  rect(px, wd.mid, 65, HORIZON - 13, 1, 18);
  lantern(px, pal, 65, HORIZON - 22, night, 2);
  for (let y = HORIZON; y < H; y++)
    for (let x = 0; x < W; x++) px.set(x, y, pal.water[y < HORIZON + 18 ? 1 : 0]);
  return px;
}

/** El agua: el reflejo corre un píxel por fila en pasos, y titilan los destellos. */
function lakeFrame(base, mode, time) {
  const pal = palette(mode);
  const night = mode === 'night';
  const px = base.copy();
  const tick = Math.floor(time * 4);
  const water = pal.water[0];
  for (let y = HORIZON; y < H; y++) {
    const depth = y - HORIZON;
    const shift = Math.round(Math.sin(y * 0.7 + tick * 0.6) * (depth > 30 ? 2 : 1));
    const sy = HORIZON - 1 - Math.round(depth * 0.95);
    if (sy < 0) continue;
    for (let x = 0; x < W; x++) {
      const src = base.get(x + shift, sy);
      px.set(
        x,
        y,
        [0, 1, 2].map((k) => Math.round(src[k] * 0.55 + water[k] * 0.45)),
      );
    }
  }
  // El muelle sobre el agua (va delante del reflejo).
  const wd = pal.wood;
  for (let y = HORIZON + 6; y < HORIZON + 10; y++)
    for (let x = 0; x < 70; x++)
      px.set(x, y, y === HORIZON + 6 ? wd.light : x % 7 === 0 ? wd.outline : wd.mid);
  for (const lx of [8, 30, 52, 68]) rect(px, wd.outline, lx, HORIZON + 10, 2, 8);
  for (let x = 0; x < W; x++) px.set(x, HORIZON, pal.water[2]);
  const lx = night ? 150 : 112;
  const r = rng((tick % 6) + 1);
  for (let i = 0; i < 26; i++) {
    const y = HORIZON + 2 + Math.floor(r() * (H - HORIZON - 4));
    const spread = 4 + (y - HORIZON) * 0.5;
    rect(
      px,
      pal.water[2],
      Math.round(lx + (r() - 0.5) * spread * 2),
      y,
      2 + Math.floor(r() * 5),
      1,
    );
  }
  for (let i = 0; i < 14; i++)
    rect(
      px,
      pal.water[1],
      Math.floor(r() * W),
      HORIZON + 4 + Math.floor(r() * 60),
      3 + Math.floor(r() * 4),
      1,
    );
  // Al frente: nenúfares con flor y juncos que se mecen.
  for (const [cx, cy, rr] of [
    [30, 164, 8],
    [52, 172, 6],
    [276, 166, 7],
    [118, 170, 5],
  ])
    fillMask(
      px,
      (x, y) =>
        Math.pow((x - cx) / rr, 2) + Math.pow((y - cy) / (rr * 0.4), 2) < 1 &&
        !(x > cx && Math.abs(y - cy) < 1),
      [cx - rr, cy - rr, cx + rr, cy + rr],
      (x, y) => (y < cy ? pal.leaf.light : pal.leaf.mid),
      pal.leaf.outline,
    );
  for (const [fx, fy] of [
    [28, 161],
    [276, 163],
  ]) {
    px.set(fx, fy, pal.petal);
    px.set(fx - 1, fy + 1, pal.petal);
    px.set(fx + 1, fy + 1, pal.petal);
    px.set(fx, fy + 1, pal.cream);
  }
  for (const rx of [300, 305, 311, 296, 4, 9, 14])
    for (let y = 150; y < H; y++)
      if (y > 150 + (rx % 7) * 2)
        px.set(
          rx + Math.round(Math.sin(y / 6 + tick * 0.2) * 0.6),
          y,
          y % 9 === 0 ? pal.leaf.light : pal.leaf.dark,
        );
  if (night) fireflies(px, pal, 150, 50, 160, 60, time, 16);
  return px;
}

// ------------------------------------------------------------ el tronco (el paso entre salas)

function trunkBase(mode) {
  const pal = palette(mode);
  const night = mode === 'night';
  const light = night ? -1 : 1;
  const bark = pal.bark;
  const px = new Pix();
  const bands = [0, 45, 90, 135];
  for (let y = 0; y < H; y++) {
    let b = 0;
    bands.forEach((v, i) => {
      if (y >= v) b = i;
    });
    for (let x = 0; x < W; x++) px.set(x, y, pal.sky[3 - b]);
  }
  for (const [x, y, r] of [
    [14, 30, 18],
    [306, 60, 18],
    [20, 120, 16],
    [300, 150, 18],
    [40, 170, 14],
  ])
    clump(px, pal.leaf, x, y, r, { light });
  limb(
    px,
    bark,
    [
      [160, 60],
      [80, 40],
      [30, 30],
    ],
    7,
    3,
    light,
  );
  limb(
    px,
    bark,
    [
      [160, 130],
      [240, 110],
      [300, 104],
    ],
    7,
    3,
    light,
  );
  for (const [x, y, r] of [
    [40, 26, 14],
    [70, 36, 11],
    [286, 98, 14],
    [258, 108, 11],
  ])
    clump(px, pal.leaf, x, y, r, { light });
  limb(
    px,
    bark,
    [
      [160, -10],
      [156, 90],
      [162, 190],
    ],
    70,
    70,
    light,
  );
  for (let y = 0; y < H; y++)
    for (let x = 92; x < 228; x++)
      if (Math.sin(x * 0.55 + Math.sin(y / 11 + x * 0.05) * 2.4) > 0.86) px.set(x, y, bark.dark);
  for (let x = -10; x < W + 20; x += 18) clump(px, pal.leaf, x, 176 + ((x * 7) % 5), 16, { light });
  for (const [vx, vy] of [
    [120, 20],
    [196, 96],
  ])
    for (let y = vy; y < vy + 34; y++) {
      px.set(vx + Math.round(Math.sin(y / 4) * 2), y, pal.leaf.mid);
      if (y % 5 === 0) px.set(vx + 1 + Math.round(Math.sin(y / 4) * 2), y, pal.leaf.light);
    }
  return px;
}

// ------------------------------------------------------------ lo que se mueve

/** Luciérnagas que flotan y titilan (de noche). */
function fireflies(px, pal, x0, y0, w, h, time, n) {
  const r = rng(99);
  for (let i = 0; i < n; i++) {
    const bx = x0 + r() * w;
    const by = y0 + r() * h;
    const ph = r() * 6.28;
    const sp = 0.4 + r() * 0.6;
    const x = Math.round(bx + Math.sin(time * sp + ph) * 6);
    const y = Math.round(by + Math.cos(time * sp * 0.8 + ph) * 4);
    const on = Math.sin(time * 2 * sp + ph * 3);
    if (on <= -0.2) continue;
    px.blend(x, y, pal.firefly, 0.95);
    if (on > 0.5)
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        px.blend(x + dx, y + dy, pal.firefly, 0.35);
  }
}

/** Mariposas (de día): dos alas que se abren y se cierran. */
function butterflies(px, pal, spots, time) {
  spots.forEach(([bx, by], i) => {
    const x = Math.round(bx + Math.sin(time * 0.7 + i * 2) * 14);
    const y = Math.round(by + Math.sin(time * 1.3 + i) * 5);
    const open = Math.floor(time * 6 + i) % 2 === 0;
    px.set(x, y, pal.bark.outline);
    for (const s of [-1, 1]) {
      px.set(x + s, y - (open ? 1 : 0), pal.butterfly[0]);
      if (open) px.set(x + s * 2, y - 1, pal.butterfly[1]);
    }
  });
}

// ------------------------------------------------------------ las escenas

/**
 * Cada escena: cómo se dibuja (una vez por modo), qué se repinta encima en cada paso y,
 * en coordenadas de la escena, dónde van la estantería real (`shelf`, el hueco entre las
 * tablas) y la puerta (`door`, el ascensor de lianas). `focus` es el punto que queda a la
 * vista cuando la pantalla recorta la escena (en el celular).
 */
export const SCENES = {
  title: {
    base: lakeBase,
    frame: lakeFrame,
    focus: [0.62, 0.5],
  },
  monastery: {
    base: libraryBase,
    frame: (base, mode, time) => {
      const px = base.copy();
      const pal = palette(mode);
      if (mode === 'night') fireflies(px, pal, 20, 30, 280, 120, time, 22);
      else
        butterflies(
          px,
          pal,
          [
            [110, 120],
            [214, 112],
          ],
          time,
        );
      return px;
    },
    shelf: {
      x: LIB_SHELF.cx - LIB_SHELF.w + 2,
      y: LIB_SHELF.top - 2,
      w: LIB_SHELF.w * 2 - 4,
      h: LIB_SHELF.bottom - LIB_SHELF.top + 1,
    },
    door: { x: 286, y: 96, w: 26, h: 56 },
    focus: [0.5, 0.5],
  },
  study: {
    base: hollowBase,
    frame: (base, mode, time) => {
      const px = base.copy();
      const pal = palette(mode);
      if (mode === 'night') fireflies(px, pal, 80, 20, 160, 90, time, 14);
      else butterflies(px, pal, [[120, 60]], time);
      return px;
    },
    shelf: {
      x: HOLLOW_SHELF.cx - HOLLOW_SHELF.w + 2,
      y: HOLLOW_SHELF.top - 2,
      w: HOLLOW_SHELF.w * 2 - 4,
      h: HOLLOW_SHELF.bottom - HOLLOW_SHELF.top + 1,
    },
    door: { x: 210, y: 60, w: 26, h: 56 },
    focus: [0.5, 0.5],
  },
  trunk: { base: trunkBase, frame: null, focus: [0.5, 0.5] },
};
