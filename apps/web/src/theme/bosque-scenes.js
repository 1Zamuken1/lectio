// Lectio · escenas del Bosque élfico (docs/lectio-temas.md §7.10): Lothlórien noble, al
// estilo Stardew Valley / Terraria: 320×180, colores sólidos, contornos de color (nunca
// negros) y objetos grandes. Mallorn de corteza plateada y copa dorada, talan con baranda
// blanca, faroles; filas de mallorn al fondo, más claras cuanto más lejos (sin bruma).
// Se dibujan en un lienzo de píxeles, una vez por modo (día o noche), y lo que se mueve (las
// luciérnagas, las mariposas) se repinta encima en pasos. Cada sala dice dónde van los
// libros reales (`shelf`) y la escalera a la otra sala (`door`).

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

// ============================================================ REDISEÑO (maqueta)
// Lothlórien noble: mallorn de corteza plateada y copa dorada, talan con baranda blanca,
// faroles. Usa los ayudantes de arriba (sky, clump, limb, lantern, garland…).

const EXH = {
  day: {
    silver: { outline: '#6f7c88', dark: '#a6b2bc', mid: '#cbd5dc', light: '#eef3f6' },
    gleaf: { outline: '#7a4e12', dark: '#b8832a', mid: '#dcaa3e', light: '#f2cc66', hl: '#fff0a6' },
    marble: ['#efe6d4', '#e2d6bf', '#c9b896', '#fffaf0'],
    elanor: '#ffd84a',
    niphr: '#f4f6ff',
    glowWarm: '#ffe2a0',
  },
  night: {
    silver: { outline: '#1a2230', dark: '#3a4658', mid: '#5a687e', light: '#8494ac' },
    gleaf: { outline: '#121a26', dark: '#2a3a3e', mid: '#3e5048', light: '#5c6a52', hl: '#7e865e' },
    marble: ['#3a4256', '#30384a', '#232a3a', '#4c5670'],
    elanor: '#c8a83a',
    niphr: '#c8d0e8',
    glowWarm: '#ffcf6b',
  },
};
const EXC = {};
function ex(mode) {
  if (EXC[mode]) return EXC[mode];
  const conv = (v) =>
    typeof v === 'string'
      ? hex(v)
      : Array.isArray(v)
        ? v.map(hex)
        : Object.fromEntries(Object.entries(v).map(([k, c]) => [k, hex(c)]));
  return (EXC[mode] = {
    ...palette(mode),
    ...Object.fromEntries(Object.entries(EXH[mode]).map(([k, v]) => [k, conv(v)])),
  });
}

/** Un mallorn: tronco plateado que se ensancha en la raíz y una copa de grumos dorados. */
function mallorn(px, p, x, bottom, top, w, { canopy = true, lean = 0, light = 1 } = {}) {
  limb(
    px,
    p.silver,
    [
      [x, bottom + 4],
      [x + lean * 0.4, (bottom + top) / 2],
      [x + lean, top],
    ],
    w * 0.62,
    w * 0.34,
    light,
  );
  // raíces que se abren
  for (const d of [-1, 1])
    limb(
      px,
      p.silver,
      [
        [x + d * w * 0.2, bottom - 8],
        [x + d * w * 0.9, bottom + 3],
      ],
      w * 0.18,
      w * 0.08,
      light,
    );
  // corteza: vetas verticales claras
  for (let y = top + 6; y < bottom - 4; y += 3)
    px.set(x + lean * ((y - top) / (bottom - top)) * -1 + lean - 2, y, p.silver.light);
  if (!canopy) return;
  const cx = x + lean;
  for (const [dx, dy, r] of [
    [0, -6, w * 1.3],
    [-w * 1.1, 2, w],
    [w * 1.1, 0, w],
    [-w * 0.5, -w * 0.9, w * 0.9],
    [w * 0.6, -w * 0.8, w * 0.9],
  ])
    clump(px, p.gleaf, cx + dx, top + dy, r, { light });
}

/** Un talan: plataforma elíptica de madera clara con baranda blanca y faroles. */
function talan(px, p, cx, y, rx, night, lanterns = 2) {
  fillMask(
    px,
    (X, Y) => ((X + 0.5 - cx) / rx) ** 2 + ((Y + 0.5 - y) / (rx * 0.18)) ** 2 < 1,
    [cx - rx - 1, y - rx * 0.2, cx + rx + 1, y + rx * 0.2],
    (X, Y) => (Y < y ? p.wood.light : p.wood.mid),
    p.wood.outline,
  );
  rect(px, p.wood.dark, cx - rx * 0.9, y + rx * 0.16, rx * 1.8, 2);
  // baranda: pasamanos y postes
  for (let X = cx - rx + 2; X <= cx + rx - 2; X++) {
    const yy = Math.round(y - 5 - Math.sqrt(Math.max(0, 1 - ((X - cx) / rx) ** 2)) * rx * 0.06);
    px.set(X, yy, p.marble[3]);
    if ((X - cx) % 6 === 0) rect(px, p.marble[1], X, yy + 1, 1, 4);
  }
  for (let i = 0; i < lanterns; i++)
    lantern(
      px,
      p,
      Math.round(cx - rx * 0.7 + (i * rx * 1.4) / Math.max(1, lanterns - 1)),
      y - 13,
      night,
    );
}

/** Escalera de caracol alrededor de un tronco: peldaños que asoman a un lado y al otro. */
function spiral(px, p, cx, y0, y1, r, step = 11) {
  const half = Math.floor(step / 2);
  for (let y = y1, i = 0; y > y0; y -= Math.max(5, Math.round(step / 2.2)), i++) {
    const side = Math.sin(i * 0.9);
    const x = Math.round(cx + side * r);
    rect(px, p.wood.outline, x - half, y, step, 3);
    rect(px, p.wood.light, x - half + 1, y, step - 2, 1);
    px.set(x + (side > 0 ? half : -half), y - 4, p.marble[3]);
    rect(px, p.marble[1], x + (side > 0 ? half : -half), y - 3, 1, 3);
  }
}

/** Puente colgante entre dos talan: tablas en curva y dos cuerdas. */
function bridge(px, p, x0, y0, x1, y1, sag, night) {
  for (let x = x0; x <= x1; x++) {
    const t = (x - x0) / (x1 - x0);
    const y = Math.round(y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag);
    px.set(x, y, x % 3 ? p.wood.mid : p.wood.outline);
    px.set(x, y + 1, p.wood.outline);
    px.set(x, y - 5, p.rope);
    if (x % 8 === 0) rect(px, p.rope, x, y - 4, 1, 4);
  }
  lantern(px, p, Math.round((x0 + x1) / 2), Math.round((y0 + y1) / 2 + sag - 4), night);
}

/** Flores de elanor (estrellas amarillas) y niphredil (blancas) en el pasto. */
function elanor(px, p, x0, x1, y0, y1, n, seed) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = Math.round(x0 + r() * (x1 - x0));
    const y = Math.round(y0 + r() * (y1 - y0));
    const c = r() < 0.65 ? p.elanor : p.niphr;
    px.set(x, y + 1, p.leaf.mid);
    for (const [dx, dy] of [
      [0, -1],
      [-1, 0],
      [1, 0],
      [-1, 1],
      [1, 1],
    ])
      px.set(x + dx, y + dy, c);
    px.set(x, y, p.goldD);
  }
}

/** Una loma de copas que rellena hasta abajo (forestRidge solo llega al horizonte del lago). */
function hill(px, tones, base, amp, step, seed, light = 1) {
  for (let x = 0; x < W; x++) {
    const top = Math.round(base - amp * (0.5 + 0.5 * Math.sin(x / 37 + seed)));
    for (let y = top; y < H; y++) px.set(x, y, tones.dark);
  }
  for (let x = -8; x < W + 10; x += step) {
    const top = Math.round(base - amp * (0.5 + 0.5 * Math.sin(x / 37 + seed)));
    clump(px, tones, x + ((x * 7) % 4), top + 2, step * 0.7, { light, detail: 0.4 });
  }
}

/** El prado: una loma de pasto con matas y briznas más claras. */
function grass(px, p, y0, seed, light = 1) {
  hill(px, p.leaf, y0, 4, 7, seed, light);
  for (let y = y0 + 6; y < H; y++)
    for (let x = 0; x < W; x++) {
      const h = hash(x, y, seed);
      if (h < 0.08) px.set(x, y, p.leaf.light);
      else if (h < 0.16) px.set(x, y, p.leaf.mid);
    }
}

// ------------------------------------------------------------ portada A: la ciudad en los mallorn

function titleCity(mode) {
  const night = mode === 'night';
  const p = ex(mode);
  const px = new Pix();
  sky(px, p, night, [0, 22, 46, 70], {
    sun: [250, 58],
    moon: [254, 34],
    clouds: night
      ? []
      : [
          [80, 30, 40],
          [190, 20, 28],
        ],
  });
  hill(px, p.far2, 118, 18, 9, 3, 1);
  for (const [x, top, w] of [
    [24, 40, 6],
    [120, 54, 5],
    [300, 44, 6],
    [214, 62, 4],
  ])
    mallorn(px, { ...p, silver: p.far2, gleaf: p.far2 }, x, 130, top, w, { light: 0.5 });
  hill(px, p.far, 136, 12, 8, 7, 1);
  // los tres mallorn de la ciudad
  mallorn(px, p, 62, 168, 26, 16, { lean: -4 });
  mallorn(px, p, 270, 166, 34, 14, { lean: 5 });
  mallorn(px, p, 166, 176, 10, 26, { lean: 2 });
  spiral(px, p, 168, 64, 160, 16);
  talan(px, p, 60, 96, 24, night);
  talan(px, p, 272, 104, 22, night);
  talan(px, p, 168, 58, 34, night, 3);
  talan(px, p, 166, 120, 28, night);
  bridge(px, p, 84, 92, 136, 116, 6, night);
  bridge(px, p, 196, 116, 252, 100, 5, night);
  // el camino de piedra blanca y el prado
  grass(px, p, 160, 11);
  fillMask(
    px,
    (X, Y) => Y > 162 && Math.abs(X - (166 + (Y - 176) * 2.2)) < 4 + (Y - 162) * 0.9,
    [100, 160, 240, 179],
    (X, Y) => ((X + Y * 3) % 7 < 2 ? p.marble[2] : p.marble[0]),
    p.marble[2],
  );
  elanor(px, p, 0, 320, 164, 178, 50, 4);
  return px;
}

// ------------------------------------------------------------ portada B: la puerta del bosque

// ------------------------------------------------------------ el salón élfico (biblioteca)

const HALL_DOOR = { x: 286, y: 70, w: 30, h: 90 };

function hallBase(mode) {
  const night = mode === 'night';
  const p = ex(mode);
  const px = new Pix();
  sky(px, p, night, [0, 26, 52, 78], {
    sun: [70, 70],
    moon: [252, 40],
    clouds: night ? [] : [[220, 44, 30]],
  });
  hill(px, p.far2, 112, 16, 9, 2, 1);
  for (const [x, top] of [
    [46, 50],
    [110, 60],
    [214, 52],
    [266, 62],
  ])
    mallorn(px, { ...p, silver: p.far2, gleaf: p.far2 }, x, 120, top, 5, { light: 0.4 });
  // el piso de mármol con su mosaico de hoja
  for (let y = 118; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dy = y - 90;
      const f = ((x - 160) / dy) * 6;
      const seam = (f - Math.floor(f)) * (dy / 6) < 1 || (1300 / dy) % 5 < 1400 / (dy * dy) / 5;
      px.set(
        x,
        y,
        seam
          ? p.marble[2]
          : (Math.floor(f) + Math.floor(1300 / dy / 5)) % 2
            ? p.marble[0]
            : p.marble[1],
      );
    }
  fillMask(
    px,
    (X, Y) =>
      ((X - 160) / 46) ** 2 + ((Y - 150) / 12) ** 2 < 1 &&
      ((X - 160) / 42) ** 2 + ((Y - 150) / 10) ** 2 > 0.82,
    [110, 136, 210, 164],
    () => p.gold,
    null,
  );
  fillMask(
    px,
    (X, Y) => Math.abs(Y - 150) < 6 - Math.abs(X - 160) * 0.2 && Math.abs(X - 160) < 26,
    [130, 142, 190, 158],
    (X, Y) => (Y === 150 ? p.goldD : p.leaf.mid),
    null,
  );
  // el estrado y el gran tronco del centro (ahí van los libros)
  for (const [y, w] of [
    [112, 96],
    [118, 120],
  ]) {
    rect(px, p.marble[2], 160 - w / 2, y, w, 6);
    rect(px, p.marble[3], 160 - w / 2, y, w, 1);
  }
  // columnas: troncos vivos, y entre ellas arcos de ramas
  for (const [x, w] of [
    [18, 16],
    [92, 14],
    [228, 14],
    [302, 16],
  ])
    limb(
      px,
      p.silver,
      [
        [x, 180],
        [x, 60],
        [x, -6],
      ],
      w * 0.6,
      w * 0.5,
      x < 160 ? 1 : -1,
    );
  for (const [a, b] of [
    [18, 92],
    [228, 302],
  ]) {
    for (let t = 0; t <= 1; t += 0.01) {
      const x = Math.round(a + (b - a) * t);
      const y = Math.round(40 - Math.sin(t * Math.PI) * 22);
      for (let k = 0; k < 4; k++)
        px.set(x, y + k, k === 0 ? p.silver.light : k === 3 ? p.silver.outline : p.silver.mid);
    }
    lantern(px, p, Math.round((a + b) / 2), 30, night, 2);
  }
  // el techo de hojas doradas
  for (let x = -10; x < W + 10; x += 16) clump(px, p.gleaf, x, 4 + ((x * 7) % 6), 14);
  // bancos, arpa y faroles de pie
  for (const bx of [40, 248]) {
    rect(px, p.wood.outline, bx, 150, 34, 6);
    rect(px, p.wood.light, bx + 1, 150, 32, 2);
    rect(px, p.cushion[0], bx + 2, 147, 30, 3);
    rect(px, p.wood.outline, bx + 3, 156, 2, 6);
    rect(px, p.wood.outline, bx + 29, 156, 2, 6);
  }
  limb(
    px,
    p.wood,
    [
      [112, 150],
      [104, 126],
      [114, 112],
    ],
    2,
    1.5,
    1,
  );
  for (let k = 0; k < 7; k++) rect(px, p.gold, 106 + k * 1, 118 + k * 3 - k, 1, 30 - k * 3);
  lampPost(px, p, 84, 176, 26, night);
  lampPost(px, p, 236, 176, 26, night);
  // la escalera de caracol a la derecha (sube a tu talan)
  spiral(px, p, 302, 60, 168, 12);
  return px;
}

// ------------------------------------------------------------ tu talan (sala propia)

const TALAN_REAL = { x: 118, y: 84, w: 84, h: 36 };
const TALAN_DOOR = { x: 6, y: 92, w: 40, h: 76 };

function talanBase(mode) {
  const night = mode === 'night';
  const p = ex(mode);
  const px = new Pix();
  sky(px, p, night, [0, 30, 60, 88], {
    sun: [236, 92],
    moon: [240, 40],
    clouds: night
      ? []
      : [
          [150, 40, 40],
          [280, 56, 26],
        ],
  });
  // el mar de copas doradas allá abajo y otros mallorn
  for (const [x, top] of [
    [90, 70],
    [200, 80],
    [300, 66],
  ])
    mallorn(px, { ...p, silver: p.far2, gleaf: p.far2 }, x, 130, top, 5, { light: 0.4 });
  for (let x = -10; x < W + 10; x += 14)
    clump(px, p.gleaf, x, 128 + ((x * 5) % 7), 12, { light: 0.6, detail: 0.5 });
  // la plataforma: tablas claras en perspectiva y la baranda blanca en curva
  for (let y = 134; y < H; y++)
    for (let x = 0; x < W; x++) {
      const f = ((x - 170) / (y - 100)) * 8;
      px.set(
        x,
        y,
        (f - Math.floor(f)) * ((y - 100) / 8) < 1
          ? p.wood.outline
          : Math.floor(f) % 2
            ? p.wood.mid
            : p.wood.light,
      );
    }
  for (let x = 40; x < W; x++) {
    const y = Math.round(126 + ((x - 180) / 140) ** 2 * 6);
    rect(px, p.marble[3], x, y, 1, 1);
    px.set(x, y + 1, p.marble[2]);
    if (x % 10 === 0) rect(px, p.marble[1], x, y + 2, 2, 8);
  }
  // el gran tronco a la izquierda, con la escalera que baja al salón
  limb(
    px,
    p.silver,
    [
      [24, 190],
      [26, 90],
      [20, -10],
    ],
    32,
    26,
    1,
  );
  spiral(px, p, 30, 96, 176, 18);
  // la copa encima y una rama que cruza
  limb(
    px,
    p.silver,
    [
      [30, 30],
      [140, 18],
      [260, 8],
    ],
    5,
    2,
    1,
  );
  for (let x = 30; x < W + 10; x += 18) clump(px, p.gleaf, x, 6 + ((x * 3) % 8), 14);
  garland(px, p, 70, 26, 250, 22, 12, night);
  lantern(px, p, 120, 30, night, 2);
  lantern(px, p, 220, 26, night, 2);
  // cojines, escritorio con su farol y flores
  for (const [cx, c] of [
    [244, p.cushion[0]],
    [262, p.rug[1]],
    [280, p.cushion[1]],
  ])
    fillMask(
      px,
      (X, Y) => ((X - cx) / 11) ** 2 + ((Y - 158) / 6) ** 2 < 1,
      [cx - 12, 151, cx + 12, 165],
      () => c,
      p.wood.outline,
    );
  rect(px, p.wood.outline, 64, 140, 40, 4);
  rect(px, p.wood.light, 65, 140, 38, 1);
  for (const lx of [66, 100]) rect(px, p.wood.outline, lx, 144, 2, 18);
  rect(px, p.cream, 72, 136, 12, 4);
  lantern(px, p, 94, 128, night);
  elanor(px, p, 200, 310, 166, 176, 10, 3);
  return px;
}

const sway = (base, mode, time) => {
  const px = base.copy();
  const p = ex(mode);
  if (mode === 'night') fireflies(px, p, 10, 20, 300, 140, time, 26);
  else
    butterflies(
      px,
      p,
      [
        [90, 140],
        [240, 130],
      ],
      time,
    );
  return px;
};

// ------------------------------------------------------------ estanterías (las tres propuestas)

const BOOKC = ['#7b3b4a', '#2f6a5e', '#a8701f', '#3d5f86', '#5e4a7a', '#4f7a52'].map(hex);

function standingBooks(px, p, x0, x1, bottom, h, seed) {
  const r = rng(seed);
  let x = x0;
  while (x < x1 - 3) {
    const w = 3 + Math.floor(r() * 2);
    const bh = h - Math.floor(r() * 4);
    const c = BOOKC[Math.floor(r() * BOOKC.length)];
    rect(px, p.inner.outline, x, bottom - bh, w + 1, bh);
    rect(px, c, x + 1, bottom - bh + 1, w - 1, bh - 1);
    px.set(x + 1, bottom - bh + 3, p.gold);
    x += w + 1;
  }
}

/** Huecos tallados en el tronco: arcos con libros; uno iluminado por luciérnagas. */
function trunkNiches(px, p, cx, top, rows, night, lit = 1) {
  for (let i = 0; i < rows; i++) {
    const y = top + i * 18;
    const inside = (X, Y) =>
      Y >= y &&
      Y < y + 15 &&
      Math.abs(X + 0.5 - cx) < 11 &&
      (Y > y + 5 || Math.hypot(X + 0.5 - cx, (Y - y - 5) * 2) < 11);
    fillMask(
      px,
      inside,
      [cx - 12, y - 1, cx + 12, y + 16],
      (X, Y) => (Y < y + 4 ? p.inner.mid : p.inner.dark),
      p.inner.outline,
    );
    rect(px, p.gold, cx - 11, y + 15, 22, 1);
    standingBooks(px, p, cx - 9, cx + 9, y + 14, 9, i * 7 + 3);
    if (i === lit) {
      halo(px, p.glow, cx, y + 8, 14);
      for (const [dx, dy] of [
        [-6, 3],
        [5, 2],
        [0, 6],
        [7, 9],
      ])
        px.set(cx + dx, y + dy, p.firefly);
    }
  }
}

// ------------------------------------------------------------ las salas, con su estantería

function talanWithRoots(mode) {
  const px = talanBase(mode);
  const p = ex(mode);
  mainShelf(px, p, TALAN_REAL, mode === 'night');
  // arpa y macetas
  limb(
    px,
    p.wood,
    [
      [232, 160],
      [226, 128],
      [238, 118],
    ],
    2,
    1.5,
    1,
  );
  for (let k = 0; k < 7; k++) rect(px, p.gold, 228 + k, 126 + k, 1, 30 - k * 3);
  for (const x of [206, 300]) {
    planter(px, p, x, 174);
  }
  return px;
}

// ------------------------------------------------------------ viñetas (opciones para elegir)

// ------------------------------------------------------------ más bosque (ronda 2)

/** Mezcla un juego de tonos con el color del cielo: más lejos, más claro (sin bruma). */
function fade(tones, sky, k) {
  return Object.fromEntries(
    Object.entries(tones).map(([n, c]) => [
      n,
      c.map((v, i) => Math.round(v * (1 - k) + sky[i] * k)),
    ]),
  );
}

/** Una fila de mallorn a una distancia (k: 0 cerca, 1 se funde con el cielo). */
function treeRow(
  px,
  p,
  { y, n, k, wMin, wMax, hMin, hMax, seed, x0 = -10, x1 = W + 10, skip = null },
) {
  const r = rng(seed);
  const sky = p.sky[3];
  const tp = { ...p, silver: fade(p.silver, sky, k), gleaf: fade(p.gleaf, sky, k) };
  for (let i = 0; i < n; i++) {
    const x = Math.round(x0 + ((i + r() * 0.6) / n) * (x1 - x0));
    if (skip && x > skip[0] && x < skip[1]) continue;
    const w = wMin + r() * (wMax - wMin);
    mallorn(px, tp, x, y, y - (hMin + r() * (hMax - hMin)), w, {
      lean: (r() - 0.5) * 6,
      light: 1 - k * 0.5,
    });
  }
}

/** Troncos y copas que enmarcan los bordes de la escena, y hojas colgando arriba. */
function frameTrees(px, p, { left = true, right = true, top = true } = {}) {
  if (left) {
    limb(
      px,
      p.silver,
      [
        [-2, 190],
        [6, 90],
        [0, -10],
      ],
      16,
      12,
      1,
    );
  }
  if (right) {
    limb(
      px,
      p.silver,
      [
        [322, 190],
        [314, 90],
        [320, -10],
      ],
      16,
      12,
      -1,
    );
  }
  if (top) {
    for (let x = -10; x < 90; x += 13) clump(px, p.gleaf, x, 6 + ((x * 7) % 9), 13);
    for (let x = 240; x < W + 12; x += 13) clump(px, p.gleaf, x, 6 + ((x * 5) % 9), 13);
    for (const vx of [30, 52, 268, 290])
      for (let y = 14; y < 40 + (vx % 20); y++)
        if (y % 3)
          px.set(
            vx + Math.round(Math.sin(y / 4) * 1.5),
            y,
            y % 6 === 0 ? p.gleaf.light : p.gleaf.mid,
          );
  }
}

/** Helechos y matas al pie (primer plano). */
function ferns(px, p, y, seed) {
  const r = rng(seed);
  for (let x = -6; x < W + 6; x += 9 + Math.floor(r() * 8)) {
    if (x > 100 && x < 220) continue;
    clump(px, p.leaf, x, y + Math.round(r() * 6), 6 + r() * 4, { detail: 0.6 });
  }
}

const _city = titleCity;

/** Dibuja una escena encima de un fondo de bosque (las filas lejanas van primero). */
function layered(base, back, front) {
  return (mode) => {
    const p = ex(mode);
    const scene = base(mode);
    const bg = new Pix();
    bg.d.set(scene.d);
    back?.(bg, p, mode);
    // lo que la escena pintó encima del cielo se respeta: solo se rellena donde había cielo
    const skyOnly = new Pix();
    sky(skyOnly, p, mode === 'night', SKYBANDS[base.name] ?? [0, 24, 48, 74], { clouds: [] });
    for (let i = 0; i < W * H; i++) {
      const k = i * 4;
      const isSky = [0, 1, 2].every((c) => Math.abs(scene.d[k + c] - skyOnly.d[k + c]) < 2);
      if (!isSky) for (let c = 0; c < 3; c++) bg.d[k + c] = scene.d[k + c];
    }
    front?.(bg, p, mode);
    return bg;
  };
}
const SKYBANDS = {
  titleCity: [0, 22, 46, 70],
  titleGate: [0, 24, 48, 74],
  hallWithNiches: [0, 26, 52, 78],
  talanWithRoots: [0, 30, 60, 88],
};

const cityMore = layered(
  _city,
  (px, p) => {
    treeRow(px, p, { y: 118, n: 16, k: 0.7, wMin: 3, wMax: 5, hMin: 50, hMax: 80, seed: 3 });
    treeRow(px, p, { y: 140, n: 9, k: 0.45, wMin: 6, wMax: 9, hMin: 70, hMax: 110, seed: 7 });
  },
  (px, p) => {
    frameTrees(px, p);
    ferns(px, p, 172, 5);
  },
);

// ------------------------------------------------------------ ronda 3: salas con B y C, compañeros y talleres

// ------------------------------------------------------------ salas: raíces (C) y huecos (B) juntos

const HALL_REAL = { x: 116, y: 64, w: 88, h: 40 };

function hallC(mode) {
  const night = mode === 'night';
  const p = ex(mode);
  const px = hallBase(mode);
  // dos troncos con huecos tallados (B) entre las columnas
  for (const cx of [55, 265]) {
    limb(
      px,
      p.silver,
      [
        [cx, 182],
        [cx, 60],
        [cx - 2, -10],
      ],
      16,
      13,
      cx < 160 ? 1 : -1,
    );
    trunkNiches(px, p, cx, 50, 3, night, cx < 160 ? 0 : 2);
    for (let y = 40; y < 170; y++)
      if (Math.sin(y / 5 + cx) > 0.5)
        px.set(cx + 14 + Math.round(Math.sin(y / 3) * 2), y, y % 6 ? p.leaf.mid : p.niphr);
  }
  // al centro, sobre el estrado, el hueco enmarcado en raíces: ahí van los libros reales
  mainShelf(px, p, HALL_REAL, night);
  return px;
}

function talanBC(mode) {
  const px = talanWithRoots(mode);
  const p = ex(mode);
  trunkNiches(px, p, 26, 36, 2, mode === 'night', 0);
  return px;
}

const hall4 = layered(
  hallC,
  (px, p) => {
    treeRow(px, p, { y: 112, n: 16, k: 0.7, wMin: 3, wMax: 5, hMin: 40, hMax: 70, seed: 21 });
    treeRow(px, p, { y: 120, n: 9, k: 0.45, wMin: 6, wMax: 8, hMin: 60, hMax: 90, seed: 23 });
  },
  (px, p) => ferns(px, p, 174, 3),
);
SKYBANDS.hallC = [0, 26, 52, 78];
SKYBANDS.talanBC = [0, 30, 60, 88];
const talan4 = layered(
  talanBC,
  (px, p) => {
    treeRow(px, p, {
      y: 128,
      n: 12,
      k: 0.65,
      wMin: 4,
      wMax: 6,
      hMin: 40,
      hMax: 70,
      seed: 31,
      x0: 50,
    });
    treeRow(px, p, {
      y: 132,
      n: 5,
      k: 0.35,
      wMin: 8,
      wMax: 11,
      hMin: 70,
      hMax: 100,
      seed: 33,
      x0: 80,
    });
  },
  (px, p) => {
    limb(
      px,
      p.silver,
      [
        [322, 190],
        [314, 100],
        [320, -10],
      ],
      14,
      10,
      -1,
    );
    for (let x = 250; x < W + 10; x += 12) clump(px, p.gleaf, x, 40 + ((x * 3) % 10), 11);
  },
);

// ------------------------------------------------------------ compañeros (rehechos con más cuidado)

/** Una parte del cuerpo: elipse (girable) con tres tonos según la luz (arriba a la izquierda). */
function part(px, t, cx, cy, rx, ry, ang = 0, outline = true) {
  const ca = Math.cos(ang),
    sa = Math.sin(ang);
  const inside = (x, y) => {
    const dx = x + 0.5 - cx,
      dy = y + 0.5 - cy;
    const u = dx * ca + dy * sa,
      v = -dx * sa + dy * ca;
    return (u / rx) ** 2 + (v / ry) ** 2 < 1;
  };
  const R = Math.max(rx, ry) + 1;
  fillMask(
    px,
    inside,
    [cx - R, cy - R, cx + R, cy + R],
    (x, y) => {
      const v = -((x + 0.5 - cx) / rx) * 0.5 - ((y + 0.5 - cy) / ry) * 0.85;
      return v > 0.45 ? t.light : v < -0.45 ? t.dark : t.mid;
    },
    outline ? t.outline : null,
  );
}
function eye(px, x, y, big = false) {
  const k = hex('#1c2430');
  rect(px, k, x, y, 2, big ? 3 : 2);
  px.set(x, y, hex('#ffffff'));
  if (big) px.set(x + 1, y + 2, hex('#3a4a6a'));
}

// ------------------------------------------------------------ talleres con más detalle (200 × 52)

// ------------------------------------------------------------ el retoño de mallorn (compañero)

/**
 * El retoño: una criaturita-planta chibi. Cuerpo redondo de corteza plateada, carita con
 * ojos grandes, dos hojas doradas como orejas y un brote arriba; brazos de hojita y
 * raicitas por pies. `mood`: 'idle' | 'happy' (florece, brazos arriba) | 'sad' (se marchita).
 */
function sprout(mode, frame = 0, mood = 'idle') {
  const px = new Pix(28, 30);
  // Siempre con los colores de día: de noche brilla por su cuenta (en la app, con CSS).
  const p = ex('day');
  const happy = mood === 'happy';
  const sad = mood === 'sad';
  const bob = frame % 2;
  const leafT = sad ? fade(p.gleaf, p.bark.mid, 0.45) : p.gleaf;
  // raicitas
  for (const [x, d] of [
    [10, -1],
    [17, 1],
  ]) {
    rect(px, p.bark.outline, x, 25, 2, 3);
    px.set(x + d, 28, p.bark.outline);
    px.set(x + d * 2, 28, p.bark.mid);
  }
  // brazos de hojita
  const armY = happy ? 13 : sad ? 22 : 19 - bob;
  part(px, p.leaf, 5, armY, 3.4, 1.8, happy ? -0.9 : sad ? 0.6 : -0.3);
  part(px, p.leaf, 23, armY, 3.4, 1.8, happy ? 0.9 : sad ? -0.6 : 0.3);
  // el cuerpo de corteza plateada, con dos vetas
  part(px, p.silver, 14, 18 + (sad ? 1 : 0), 8.2, 8);
  px.set(9, 15, p.silver.light);
  px.set(10, 14, p.silver.light);
  rect(px, p.silver.dark, 19, 13, 1, 3);
  // la carita
  const ey = 17 + (sad ? 1 : 0);
  if (sad) {
    rect(px, hex('#1c2430'), 10, ey + 1, 3, 1);
    rect(px, hex('#1c2430'), 15, ey + 1, 3, 1);
  } else if (happy) {
    for (const ex0 of [10, 15]) {
      px.set(ex0, ey + 1, hex('#1c2430'));
      px.set(ex0 + 1, ey, hex('#1c2430'));
      px.set(ex0 + 2, ey + 1, hex('#1c2430'));
    }
  } else {
    eye(px, 10, ey, true);
    eye(px, 16, ey, true);
  }
  px.set(8, ey + 3, hex('#f2a8b0'));
  px.set(9, ey + 3, hex('#f2a8b0'));
  px.set(19, ey + 3, hex('#f2a8b0'));
  px.set(20, ey + 3, hex('#f2a8b0'));
  if (!sad) {
    px.set(13, ey + 4, hex('#7a4a3a'));
    px.set(14, ey + 4, hex('#7a4a3a'));
  }
  // el tallo, las dos hojas-orejas y el brote (o la flor)
  rect(px, p.leaf.dark, 14, 7 + (sad ? 2 : 0), 1, 4);
  const droop = sad ? 0.9 : 0;
  const flap = bob ? 0.12 : 0;
  part(px, leafT, 8, 8 + (sad ? 4 : 0), 5.4, 2.4, -0.45 - flap + droop);
  part(px, leafT, 20, 8 + (sad ? 4 : 0), 5.4, 2.4, 0.45 + flap - droop);
  px.set(6, 7 + (sad ? 4 : 0), leafT.hl);
  if (happy) {
    for (const [dx, dy] of [
      [0, -2],
      [-2, 0],
      [2, 0],
      [0, 2],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      px.set(14 + dx, 4 + dy, p.niphr);
    px.set(14, 4, p.elanor);
    for (const [x, y] of [
      [4, 4],
      [24, 3],
      [2, 12],
      [26, 11],
    ])
      px.set(x, y, p.gold);
  } else if (!sad) {
    part(px, p.leaf, 14, 5 + bob, 1.8, 2.6);
    px.set(14, 3 + bob, p.leaf.hl);
  }
  return px;
}

// ------------------------------------------------------------ la estantería real: un hueco enmarcado en raíces

/**
 * Donde van los libros reales: un hueco oscuro de una fila, enmarcado por dos raíces vivas
 * que se arquean arriba con musgo y flores, y una raíz por tabla. Las repisas de raíces y
 * los huecos de los troncos que la rodean llevan libros dibujados (son decoración).
 */
function mainShelf(px, p, s, night) {
  rect(px, p.inner.outline, s.x - 1, s.y - 1, s.w + 2, s.h + 2);
  for (let y = s.y; y < s.y + s.h; y++)
    for (let x = s.x; x < s.x + s.w; x++)
      px.set(x, y, (x - s.x) % 12 === 0 ? p.inner.mid : p.inner.dark);
  limb(
    px,
    p.bark,
    [
      [s.x - 6, s.y + s.h + 8],
      [s.x - 4, s.y + 10],
      [s.x + 10, s.y - 6],
      [s.x + s.w / 2, s.y - 9],
    ],
    3.6,
    2.4,
    1,
  );
  limb(
    px,
    p.bark,
    [
      [s.x + s.w + 6, s.y + s.h + 8],
      [s.x + s.w + 4, s.y + 10],
      [s.x + s.w - 10, s.y - 6],
      [s.x + s.w / 2, s.y - 9],
    ],
    3.6,
    2.4,
    -1,
  );
  limb(
    px,
    p.bark,
    [
      [s.x - 8, s.y + s.h + 2],
      [s.x + s.w / 2, s.y + s.h + 4],
      [s.x + s.w + 8, s.y + s.h + 1],
    ],
    2.6,
    2.4,
    1,
  );
  for (let x = s.x - 6; x < s.x + s.w + 8; x += 8)
    clump(px, p.leaf, x, s.y - 9 + Math.abs(x - s.x - s.w / 2) * 0.12, 4.5, { detail: 0.5 });
  elanor(px, p, s.x - 4, s.x + s.w + 4, s.y - 14, s.y - 8, 9, 5);
  for (let y = s.y + 4; y < s.y + s.h; y += 5) {
    px.set(s.x - 6 + (y % 2), y, p.leaf.light);
    px.set(s.x + s.w + 5 - (y % 2), y, p.leaf.light);
  }
  if (night) halo(px, p.glow, s.x + s.w / 2, s.y + s.h / 2, 30);
}

// ------------------------------------------------------------ el tronco con la escalera (el paso entre salas)

function trunkBase(mode) {
  const night = mode === 'night';
  const p = ex(mode);
  const px = new Pix();
  sky(px, p, night, [0, 40, 90, 140], {
    moon: [270, 30],
    clouds: night
      ? []
      : [
          [60, 50, 40],
          [250, 110, 30],
        ],
  });
  treeRow(px, p, { y: 200, n: 12, k: 0.7, wMin: 4, wMax: 6, hMin: 190, hMax: 210, seed: 41 });
  treeRow(px, p, {
    y: 200,
    n: 6,
    k: 0.45,
    wMin: 8,
    wMax: 10,
    hMin: 190,
    hMax: 210,
    seed: 43,
    skip: [110, 210],
  });
  limb(
    px,
    p.silver,
    [
      [160, 200],
      [158, 90],
      [162, -20],
    ],
    34,
    32,
    1,
  );
  for (let y = 4; y < H; y += 3) px.set(146 + ((y * 7) % 5), y, p.silver.light);
  for (const [y, d] of [
    [30, -1],
    [100, 1],
    [150, -1],
  ]) {
    limb(
      px,
      p.silver,
      [
        [160 + d * 20, y + 10],
        [160 + d * 70, y],
        [160 + d * 120, y - 8],
      ],
      6,
      2,
      d,
    );
    for (let k = 0; k < 4; k++) clump(px, p.gleaf, 160 + d * (70 + k * 18), y - 6 - (k % 2) * 4, 9);
  }
  spiral(px, p, 160, -4, 186, 30, 24);
  for (const y of [40, 110, 170]) lantern(px, p, 160 + (y % 2 ? 30 : -30), y, night, 2);
  for (let y = 0; y < H; y++)
    if (Math.sin(y / 6) > 0.3)
      px.set(186 + Math.round(Math.sin(y / 4) * 2), y, y % 5 ? p.leaf.mid : p.niphr);
  return px;
}

// ------------------------------------------------------------ las escenas

/**
 * Cada escena: cómo se dibuja (una vez por modo), qué se repinta encima en cada paso y,
 * en coordenadas de la escena, dónde van los libros reales (`shelf`) y la escalera de
 * caracol (`door`). `focus` es el punto que queda a la vista cuando la pantalla recorta.
 */
export const SCENES = {
  title: { base: cityMore, frame: sway, focus: [0.52, 0.5] },
  monastery: { base: hall4, frame: sway, shelf: HALL_REAL, door: HALL_DOOR, focus: [0.5, 0.5] },
  study: { base: talan4, frame: sway, shelf: TALAN_REAL, door: TALAN_DOOR, focus: [0.4, 0.5] },
  trunk: { base: trunkBase, frame: null, focus: [0.5, 0.5] },
};

/** El retoño de mallorn (el compañero), como lienzo: bosque.js lo pasa a SVG. */
export { sprout };
