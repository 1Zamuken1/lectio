// Lectio · escenas del Solarpunk (docs/lectio-temas.md §7.8). El mismo estilo y el mismo
// motor que el Bosque: 320×180, colores sólidos, contornos de color (nunca negros), objetos
// grandes. Mañana dorada de día; de noche, la ciudad encendida. Cada escena se dibuja una
// vez por modo y lo que se mueve (autos voladores, aerogeneradores, el tren, el teleférico,
// el globo, los veleros, las abejas) se repinta encima en pasos, solo donde se ve la ciudad.
// La base lleva colgada su vista de la ciudad (`view`) para saber dónde se ve.

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

export const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

export function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function rng(seed) {
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
    sky: ['#86c6ec', '#9fd3f0', '#b9e0f1', '#d4eaee', '#ecebd2', '#fbe2a6', '#ffd78a'],
    cloud: ['#ffffff', '#fbe6bf', '#e9c99a'],
    sun: '#fff8dc',
    sunRing: '#ffdf7e',
    mountain: { outline: '#8db0cc', dark: '#a7c4dc', mid: '#bdd5e8', light: '#d6e6f2' },
    hill: { outline: '#5e9a62', dark: '#79b36c', mid: '#94c87c', light: '#b3db8e', hl: '#cce89c' },
    tower: {
      outline: '#7d99b6',
      shade: '#b7cfe6',
      mid: '#e3edf6',
      warm: '#fff4d8',
      light: '#ffffff',
    },
    far: {
      outline: '#a3bfd8',
      shade: '#c9ddee',
      mid: '#e2edf6',
      warm: '#f6efdc',
      light: '#f8fbfd',
    },
    glass: ['#5d9fcf', '#86c4e8', '#d2f0fb'],
    farGlass: '#a9cde6',
    lit: ['#ffc46a', '#ffe2a0'],
    leaf: { outline: '#2b5a3a', dark: '#3e7c44', mid: '#5aa64a', light: '#86c957', hl: '#bce27a' },
    farLeaf: ['#7fbf6e', '#a5d68a'],
    water: ['#4b9ccc', '#7ac3e6', '#c6ecfa'],
    solar: {
      frame: '#eef4f9',
      edge: '#8aa4bd',
      cell: '#3c6ea8',
      cellL: '#6b9dd2',
      glint: '#d8eeff',
    },
    sunY: '#ffc83a',
    sunYD: '#e0961a',
    sunYL: '#ffe58a',
    wall: '#f4eee2',
    wallShade: '#e2d9c8',
    wallOutline: '#b9ad97',
    floor: ['#c39f6e', '#d6b683', '#e7cc9c', '#f5e1b6'],
    floorLine: '#a8865a',
    deck: ['#efe2c6', '#e2d1ad', '#c9b087', '#fbf2dc'],
    white: { outline: '#8ea3b8', dark: '#c7d5e2', mid: '#e8eff5', light: '#ffffff' },
    metal: { outline: '#6f8297', dark: '#a6b5c4', mid: '#cfdae4', light: '#f1f5f9' },
    cyan: '#36c2e6',
    cyanL: '#a6ecfa',
    cyanD: '#1f8fb8',
    screen: '#16304c',
    screenL: '#1d3a5a',
    panelGlass: ['#9fd6ee', '#c4e8f6', '#e8f8fd'],
    cushion: ['#ffc83a', '#e0961a', '#4fb6dc', '#2c8cb6'],
    lamp: '#ffe7a6',
    lampCore: '#fffaf0',
    glow: '#ffd27a',
    shadow: '#5f7f9c',
    car: ['#ffffff', '#36c2e6', '#ffc83a', '#7d99b6'],
    tomato: '#e8543a',
    petal: '#ffc83a',
    petalD: '#e0961a',
    seed: '#7a4a24',
    bee: ['#ffc83a', '#3a3a52'],
    rug: ['#7cc8e6', '#a8dcf0', '#ffc83a', '#5aaed6'],
    curtain: ['#fffaf0', '#f3ead6', '#e2d3b6', '#b9a888'],
    cat: ['#ee9a4c', '#c8702a', '#f8c48e', '#8a4a1a'],
    blush: '#ff9a8a',
    lavender: ['#9a7ae0', '#c4a8f4'],
    pouf: ['#f0785a', '#c8583c', '#ffa88a'],
    spines: [
      '#e8743b',
      '#3f8fc4',
      '#f2c13a',
      '#5aa64a',
      '#d9577a',
      '#7a6ad0',
      '#2fa89a',
      '#ffffff',
    ],
    star: '#f4f6ff',
  },
  night: {
    sky: ['#0b1331', '#101b40', '#16244e', '#1d2e5c', '#26396a', '#304578', '#3c5284'],
    cloud: ['#2b3b66', '#233158', '#1c284a'],
    moon: '#f2f4fa',
    moonRing: '#a6b6d6',
    mountain: { outline: '#141f3a', dark: '#1a2746', mid: '#1f2e52', light: '#26375e' },
    hill: { outline: '#0c1a24', dark: '#11252e', mid: '#163038', light: '#1d3c44', hl: '#244a50' },
    tower: {
      outline: '#0f1730',
      shade: '#1b2644',
      mid: '#253352',
      warm: '#2e3e60',
      light: '#3a4c70',
    },
    far: {
      outline: '#162142',
      shade: '#1d2a4c',
      mid: '#223156',
      warm: '#27385e',
      light: '#2e4066',
    },
    glass: ['#162644', '#1f3658', '#36557e'],
    farGlass: '#1f3054',
    lit: ['#ffb84a', '#ffdc8a'],
    leaf: { outline: '#0a1a1a', dark: '#12302c', mid: '#1b453a', light: '#275e4a', hl: '#357656' },
    farLeaf: ['#173a36', '#1f4a40'],
    water: ['#13274a', '#1e3b66', '#4a6a9a'],
    solar: {
      frame: '#3c4a6a',
      edge: '#1c2640',
      cell: '#16244a',
      cellL: '#24386a',
      glint: '#5a76b0',
    },
    sunY: '#e8b23a',
    sunYD: '#b07a1a',
    sunYL: '#ffd27a',
    wall: '#5a4c54',
    wallShade: '#43384a',
    wallOutline: '#2a2232',
    floor: ['#4a3a36', '#5c4840', '#6e564a', '#8a6a54'],
    floorLine: '#33282a',
    deck: ['#4a4658', '#3e3a4c', '#2c2a3a', '#5a5468'],
    white: { outline: '#1c2234', dark: '#3a4256', mid: '#525c74', light: '#6c7890' },
    metal: { outline: '#1a2030', dark: '#363f54', mid: '#4e5a72', light: '#6c7a94' },
    cyan: '#4fd8f2',
    cyanL: '#b4f6ff',
    cyanD: '#2a8cb0',
    screen: '#0e1c34',
    screenL: '#152642',
    panelGlass: ['#1c3050', '#284468', '#3a5a86'],
    cushion: ['#d8a030', '#a8701a', '#2f86a8', '#1e5e7c'],
    lamp: '#ffcf6b',
    lampCore: '#fff0c0',
    glow: '#ffbf55',
    shadow: '#05080f',
    car: ['#6c7890', '#4fd8f2', '#ffcf6b', '#1c2234'],
    tomato: '#a83a2a',
    petal: '#c8922a',
    petalD: '#8a5c1a',
    seed: '#3a2416',
    bee: null,
    rug: ['#2a5a72', '#346a84', '#c8922a', '#1e4a60'],
    curtain: ['#8a7c7c', '#73666c', '#5e525c', '#3a3040'],
    cat: ['#a8642e', '#80461c', '#c4844a', '#4a2410'],
    blush: '#a85a5a',
    lavender: ['#5a4a8e', '#7a66b0'],
    pouf: ['#a8503a', '#7a3426', '#c4704e'],
    spines: [
      '#a8502a',
      '#2c6690',
      '#b08a2a',
      '#3c7a3a',
      '#9a3c58',
      '#544a96',
      '#1f7a70',
      '#6c7890',
    ],
    star: '#f2f5ff',
  },
};

const PALETTES = {};

export function palette(mode) {
  if (PALETTES[mode]) return PALETTES[mode];
  const conv = (v) =>
    typeof v === 'string'
      ? hex(v)
      : v === null
        ? null
        : Array.isArray(v)
          ? v.map(hex)
          : Object.fromEntries(Object.entries(v).map(([k, c]) => [k, hex(c)]));
  return (PALETTES[mode] = Object.fromEntries(
    Object.entries(PAL[mode]).map(([k, v]) => [k, conv(v)]),
  ));
}

// ------------------------------------------------------------ piezas básicas

export function fillMask(px, inside, box, shade, outline) {
  const [x0, y0, x1, y1] = box.map(Math.round);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      px.set(x, y, edge && outline ? outline : shade(x, y));
    }
}

export function rect(px, c, x, y, w, h) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px.set(x + i, y + j, c);
}

/** Un rectángulo de esquinas redondeadas (función de "adentro"). */
export const rr = (x0, y0, x1, y1, r) => (x, y) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x;
  const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
  return Math.hypot(x - cx, y - cy) <= r + 0.2;
};

const ellipse = (cx, cy, rx, ry) => (x, y) =>
  Math.pow((x + 0.5 - cx) / rx, 2) + Math.pow((y + 0.5 - cy) / ry, 2) < 1;

/** Halo sólido de dos anillos (lámparas de noche). */
export function halo(px, c, cx, cy, r) {
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d < r) px.blend(x, y, c, d < r * 0.55 ? 0.2 : 0.1);
    }
}

function floorShadow(px, pal, cx, cy, rx, ry, a = 0.3) {
  for (let y = cy - ry; y <= cy + ry; y++)
    for (let x = cx - rx; x <= cx + rx; x++)
      if (Math.pow((x - cx) / rx, 2) + Math.pow((y - cy) / ry, 2) < 1)
        px.blend(x, y, pal.shadow, a);
}

const LEAF_GLYPH = ['..ll', '.lhl', 'lll.', 'd...'];

/** Grumo de hojas, el mismo del Bosque (borde dentado y hojitas dibujadas). */
export function clump(px, tones, cx, cy, r, { light = 1, outline = true, detail = 1 } = {}) {
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
  if (detail > 0) {
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
            if (!at(x, y) || !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1))
              return;
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
  }
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (!at(x, y)) continue;
      const edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
      px.set(x, y, edge && outline ? tones.outline : tone[(y - y0) * bw + (x - x0)]);
    }
}

/** Hoja de monstera: un corazón con cortes laterales que llegan al borde y su nervio. */
function bigLeaf(px, tones, cx, cy, r, ang) {
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const local = (x, y) => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    return [dx * ca + dy * sa, -dx * sa + dy * ca];
  };
  const inside = (x, y) => {
    const [u, v] = local(x, y);
    // corazón: más ancho cerca del tallo (u < 0), en punta hacia afuera (u > 0)
    const t = (u + r) / (2 * r);
    if (t < 0 || t > 1) return false;
    const half = r * 0.78 * Math.sin(Math.PI * Math.pow(t, 0.75)) + (t < 0.12 ? r * 0.25 : 0);
    if (Math.abs(v) > half) return false;
    if (t < 0.08 && Math.abs(v) < r * 0.18) return false; // la muesca del tallo
    // cortes: franjas finas que salen del borde hacia el nervio
    const k = (t * 4.2) % 1;
    if (t > 0.25 && t < 0.9 && Math.abs(v) > half * 0.45 && k < 0.16) return false;
    return true;
  };
  fillMask(
    px,
    inside,
    [cx - r - 2, cy - r - 2, cx + r + 2, cy + r + 2],
    (x, y) => {
      const [u, v] = local(x, y);
      if (Math.abs(v) < 0.7 && u > -r * 0.85) return tones.dark;
      return v < 0 ? (u > r * 0.2 ? tones.hl : tones.light) : tones.mid;
    },
    tones.outline,
  );
}

/** Un tallo continuo entre dos puntos (curva suave). */
function stem(px, c, x0, y0, x1, y1, bend = 0) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5);
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    px.set(x0 + (x1 - x0) * t + Math.sin(t * Math.PI) * bend, y0 + (y1 - y0) * t, c);
  }
}

function sky(px, pal, night, bands, { sun, moon, clouds = [], stars = 70 }) {
  for (let y = 0; y < px.h; y++) {
    let b = 0;
    bands.forEach((v, i) => {
      if (y >= v) b = i;
    });
    for (let x = 0; x < px.w; x++) px.set(x, y, pal.sky[Math.min(b, pal.sky.length - 1)]);
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
    for (let i = 0; i < stars; i++) {
      const sx = Math.floor(r() * px.w);
      const sy = Math.floor(r() * bands[4]);
      px.set(sx, sy, pal.star);
      if (r() < 0.12) {
        px.blend(sx + 1, sy, pal.star, 0.4);
        px.blend(sx - 1, sy, pal.star, 0.4);
        px.blend(sx, sy + 1, pal.star, 0.4);
        px.blend(sx, sy - 1, pal.star, 0.4);
      }
    }
    if (moon) {
      disc(moon[0], moon[1], 8, 10, pal.moon, pal.moonRing);
      px.set(moon[0] - 3, moon[1] - 2, pal.moonRing);
      px.set(moon[0] + 2, moon[1] + 3, pal.moonRing);
      px.set(moon[0] + 3, moon[1] - 3, pal.moonRing);
    }
  } else if (sun) {
    // un anillo de luz escalonado alrededor del sol bajo de la mañana
    for (let y = -18; y <= 18; y++)
      for (let x = -18; x <= 18; x++) {
        const d = Math.hypot(x, y);
        if (d < 17 && d >= 11) px.blend(sun[0] + x, sun[1] + y, pal.sunRing, 0.3);
      }
    disc(sun[0], sun[1], 8, 11, pal.sun, pal.sunRing);
  }
  for (const [cx, cy, w] of clouds) cloud(px, pal, cx, cy, w);
}

/** Nube redonda de base plana (sol por debajo, dorado de mañana). */
function cloud(px, pal, cx, cy, w) {
  const puffs = [];
  const n = Math.max(2, Math.round(w / 9));
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const r = 4 + Math.sin(t * Math.PI) * (w / 7);
    puffs.push([cx - w / 2 + t * w, cy - r * 0.4, r]);
  }
  const inside = (x, y) =>
    y <= cy + 3 && puffs.some(([px0, py, r]) => Math.hypot(x + 0.5 - px0, y + 0.5 - py) < r);
  for (let y = Math.floor(cy - w / 3); y <= cy + 3; y++)
    for (let x = Math.floor(cx - w / 2 - 6); x <= cx + w / 2 + 6; x++) {
      if (!inside(x, y)) continue;
      const c = y >= cy + 2 ? pal.cloud[2] : y >= cy ? pal.cloud[1] : pal.cloud[0];
      px.set(x, y, c);
    }
}

// ------------------------------------------------------------ la ciudad

/** Un rascacielos blanco: cúpula, ahusado o escalonado; terrazas verdes y ventanas. */
function tower(px, pal, o) {
  const t = o.far ? pal.far : pal.tower;
  const { x, w, top, bottom, kind = 'dome', seed = 1, night } = o;
  const cx = x + w / 2;
  const hw = w / 2;
  const h = bottom - top;
  const half = (Y) => {
    if (kind === 'taper') return hw * Math.min(1, 0.28 + ((Y - top) / h) * 2.4);
    if (kind === 'step') {
      const k = (Y - top) / h;
      return hw * (k < 0.22 ? 0.56 : k < 0.45 ? 0.78 : 1);
    }
    if (kind === 'dome' && Y < top + hw) {
      const dy = top + hw - Y - 0.5;
      return Math.sqrt(Math.max(0, hw * hw - dy * dy));
    }
    if (kind === 'leaf') {
      // ancho en la mitad, angosto arriba y abajo: una hoja de pie
      const k = (Y - top) / h;
      return hw * (k < 0.5 ? 0.25 + 1.5 * k : 1 - (k - 0.5) * 0.5);
    }
    return hw;
  };
  const inside = (X, Y) => Y >= top && Y <= bottom && Math.abs(X + 0.5 - cx) < half(Y);
  fillMask(
    px,
    inside,
    [x - 2, top, x + w + 2, bottom],
    (X, Y) => {
      const r = (X + 0.5 - cx) / Math.max(1, half(Y));
      return r < -0.38 ? t.warm : r > 0.42 ? t.shade : t.mid;
    },
    t.outline,
  );
  // la aguja o el aerogenerador de la azotea
  if (o.spire) {
    rect(px, t.outline, Math.round(cx), top - o.spire, 1, o.spire);
    px.set(Math.round(cx), top - o.spire - 1, night ? pal.lit[1] : pal.sunY);
  }
  const r = rng(seed);
  const gx = o.far ? 3 : 4;
  const gy = o.far ? 4 : 5;
  const start = kind === 'dome' ? top + Math.ceil(hw * 0.7) : top + 3;
  for (let Y = start; Y < bottom - 1; Y += gy) {
    const hy = half(Y);
    for (let X = Math.ceil(cx - hy) + 2; X + (o.far ? 1 : 2) < cx + hy - 1; X += gx) {
      const cw = o.far ? 2 : 3;
      let ok = true;
      for (let i = 0; i < cw; i++) if (!inside(X + i, Y) || !inside(X + i, Y + 1)) ok = false;
      if (!ok) continue;
      const lit = night && r() < (o.far ? 0.3 : 0.45);
      const shadeSide = X + 1 - cx > hy * 0.42;
      let c;
      if (night) c = lit ? pal.lit[r() < 0.3 ? 1 : 0] : pal.glass[0];
      else if (o.far) c = pal.farGlass;
      else c = shadeSide ? pal.glass[0] : pal.glass[1];
      rect(px, c, X, Y, cw, o.far ? 1 : 2);
      if (!night && !o.far && X + 1 - cx < -hy * 0.38) px.set(X, Y, pal.glass[2]);
    }
  }
  // terrazas verdes: una cornisa y plantas encima, con lianas que cuelgan
  if (o.green) {
    for (let Y = top + (o.greenStart ?? 12); Y < bottom - 4; Y += o.green) {
      const hy = half(Y);
      const xa = Math.round(cx - hy - 2);
      const wa = Math.round(hy * 2 + 4);
      rect(px, t.light, xa, Y - 1, wa, 1);
      rect(px, t.outline, xa, Y, wa, 1);
      if (o.far) {
        for (let X = xa + 1; X < xa + wa - 1; X++)
          if (hash(X, Y, seed) < 0.7) px.set(X, Y - 2, pal.farLeaf[hash(X, Y, 2) < 0.5 ? 0 : 1]);
        continue;
      }
      for (let X = xa + 2; X < xa + wa - 1; X += 4)
        clump(px, pal.leaf, X + Math.round(r() * 2), Y - 3, 2.6, { detail: 0 });
      for (let X = xa + 1; X < xa + wa; X += 3)
        if (r() < 0.45) {
          const len = 2 + Math.floor(r() * 4);
          for (let k = 1; k <= len; k++)
            px.set(X, Y + k, k === len ? pal.leaf.light : pal.leaf.mid);
        }
    }
  }
}

function ridge(px, tones, base, amp, seed, freq = 0.03) {
  const top = (x) =>
    Math.round(
      base -
        amp *
          (0.55 + 0.3 * Math.sin(x * freq + seed) + 0.15 * Math.sin(x * freq * 2.7 + seed * 1.7)),
    );
  for (let x = 0; x < W; x++) {
    const t = top(x);
    const rising = top(x + 2) < t;
    for (let y = t; y < H; y++) {
      const c =
        y === t ? tones.outline : y < t + 3 ? (rising ? tones.mid : tones.light) : tones.dark;
      px.set(x, y, c === tones.dark && y < t + 8 ? tones.mid : c);
    }
  }
}

function turbineMast(px, pal, x, bottom, h) {
  const m = pal.metal;
  for (let y = bottom - h; y < bottom; y++) {
    px.set(x, y, m.light);
    px.set(x + 1, y, m.dark);
  }
  rect(px, m.outline, x - 1, bottom - h - 1, 4, 3);
  rect(px, m.light, x, bottom - h, 2, 1);
}

function turbineBlades(px, pal, x, hubY, len, ang, ok) {
  const c = pal.metal.light;
  const o = pal.metal.dark;
  for (let k = 0; k < 3; k++) {
    const a = ang + (k * Math.PI * 2) / 3;
    for (let s = 1; s <= len; s++) {
      const bx = Math.round(x + 0.5 + Math.cos(a) * s);
      const by = Math.round(hubY + Math.sin(a) * s * 0.9);
      if (ok(bx, by)) px.set(bx, by, s > len - 2 ? o : c);
    }
  }
  if (ok(x, hubY)) px.set(x, hubY, pal.sunY);
}

/**
 * La vista de la ciudad (cielo, montañas, cerros con aerogeneradores, torres blancas). Se
 * dibuja una vez por modo y variante; devuelve además las máscaras de "fondo" (lo que queda
 * detrás de las torres: ahí giran las aspas) y de "medio" (detrás de las torres cercanas:
 * ahí pasa el tren).
 */
function cityView(mode, v) {
  const night = mode === 'night';
  const pal = palette(mode);
  const px = new Pix();
  sky(px, pal, night, v.bands, {
    sun: v.sun,
    moon: v.moon,
    clouds: night ? v.clouds.slice(0, 2) : v.clouds,
  });
  if (!night)
    for (const [bx, by] of v.birds ?? []) {
      px.set(bx, by, pal.tower.outline);
      px.set(bx - 1, by - 1, pal.tower.outline);
      px.set(bx + 1, by - 1, pal.tower.outline);
    }
  ridge(px, pal.mountain, v.horizon - 6, 22, 1.3, 0.022);
  ridge(px, pal.hill, v.horizon + 4, 10, 4.1, 0.05);
  if (v.water) {
    const [w0, w1] = v.water;
    for (let y = w0; y < w1; y++)
      for (let x = 0; x < W; x++)
        px.set(
          x,
          y,
          y === w0
            ? pal.water[2]
            : (x * 7 + y * 13) % 23 === 0
              ? pal.water[2]
              : y < w0 + 4
                ? pal.water[1]
                : pal.water[0],
        );
    if (v.sun && !night)
      for (let y = w0 + 1; y < w1; y += 2)
        for (let x = v.sun[0] - 6; x < v.sun[0] + 6; x++) if ((x + y) % 3) px.set(x, y, pal.sunYL);
  }
  for (const [tx, h] of v.turbines) turbineMast(px, pal, tx, v.horizon + 2, h);
  const bgSnap = px.copy();
  for (const t of v.far) tower(px, pal, { ...t, far: true, night });
  for (const t of v.mid) tower(px, pal, { ...t, night });
  for (const t of v.supertrees ?? []) supertree(px, pal, t.x, t.top, t.bottom, night);
  if (v.rail) {
    rect(px, pal.metal.outline, 0, v.rail + 3, W, 1);
    rect(px, pal.metal.light, 0, v.rail + 2, W, 1);
    for (let x = 6; x < W; x += 22) rect(px, pal.metal.dark, x, v.rail + 4, 2, 8);
  }
  const midSnap = px.copy();
  for (const r of v.roofs ?? []) neighborRoof(px, pal, r, night);
  for (const t of v.near) tower(px, pal, { ...t, night });
  for (const b of v.bridges ?? []) {
    rect(px, pal.tower.outline, b.x0, b.y - 1, b.x1 - b.x0, 6);
    rect(px, pal.tower.mid, b.x0, b.y, b.x1 - b.x0, 4);
    for (let x = b.x0 + 1; x < b.x1 - 1; x += 3)
      rect(
        px,
        night ? (hash(x, b.y) < 0.5 ? pal.lit[0] : pal.glass[0]) : pal.glass[1],
        x,
        b.y + 1,
        2,
        2,
      );
    for (let x = b.x0; x < b.x1; x += 4) clump(px, pal.leaf, x + 2, b.y - 2, 2.4, { detail: 0 });
  }
  for (const c of v.cables ?? []) cable(px, pal, ...c);
  const same = (a, b, i) =>
    a.d[i] === b.d[i] && a.d[i + 1] === b.d[i + 1] && a.d[i + 2] === b.d[i + 2];
  const bg = new Uint8Array(W * H);
  const mid = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    bg[i] = same(px, bgSnap, i * 4) ? 1 : 0;
    mid[i] = same(px, midSnap, i * 4) ? 1 : 0;
  }
  return { px, bg, mid };
}

// ------------------------------------------------------------ lo que se mueve

/** Un auto volador: cápsula blanca con cabina celeste y el brillo amarillo de abajo. */
function flyingCar(px, pal, x, y, dir, night, ok) {
  const put = (dx, dy, c) => {
    const X = Math.round(x + dx * dir);
    const Y = Math.round(y + dy);
    if (ok(X, Y)) px.set(X, Y, c);
  };
  const [body, glass, glow, line] = pal.car;
  for (let dx = -3; dx <= 3; dx++) put(dx, 0, body);
  for (let dx = -2; dx <= 2; dx++) put(dx, 1, line);
  for (let dx = -1; dx <= 2; dx++) put(dx, -1, glass);
  put(-3, -1, line);
  put(-2, 2, glow);
  put(2, 2, glow);
  if (night) {
    put(4, 0, pal.lit[1]);
    put(5, 0, pal.lit[1]);
    put(-4, 0, pal.tomato);
  }
}

function lanes(px, pal, lanes, time, night, ok) {
  lanes.forEach(([y, speed, n, dir], li) => {
    for (let k = 0; k < n; k++) {
      const span = W + 40;
      const off = (k / n) * span + li * 37;
      const p = (((time * speed + off) % span) + span) % span;
      const x = dir > 0 ? p - 20 : W + 20 - p;
      flyingCar(px, pal, x, y + Math.round(Math.sin(time * 2 + k) * 0.6), dir, night, ok);
    }
  });
}

function train(px, pal, y, time, night, ok) {
  const len = 46;
  const span = W + len * 2;
  const x0 = ((time * 22) % span) - len;
  const m = pal.white;
  for (let x = 0; x < len; x++) {
    const X = Math.round(x0 + x);
    const nose = x > len - 5 ? x - (len - 5) : 0;
    for (let dy = -5 + nose; dy <= 1; dy++) {
      const Y = y + dy;
      if (!ok(X, Y)) continue;
      const window = dy === -3 && x % 4 !== 0 && x < len - 4 && x > 1;
      px.set(
        X,
        Y,
        dy === -5 + nose || dy === 1
          ? m.outline
          : window
            ? night
              ? pal.lit[1]
              : pal.glass[1]
            : dy === -1
              ? pal.cyan
              : m.light,
      );
    }
  }
}

function bees(px, pal, spots, time) {
  if (!pal.bee) return;
  spots.forEach(([bx, by], i) => {
    const x = Math.round(bx + Math.sin(time * 1.7 + i * 2.1) * 9);
    const y = Math.round(by + Math.sin(time * 2.9 + i) * 4);
    px.set(x, y, pal.bee[0]);
    px.set(x + 1, y, pal.bee[1]);
    if (Math.floor(time * 8 + i) % 2) px.set(x, y - 1, pal.cyanL);
  });
}

/** La máscara de lo que se ve de la ciudad en la escena terminada. */
function visibleMask(base, view) {
  const m = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const k = i * 4;
    m[i] =
      base.d[k] === view.d[k] && base.d[k + 1] === view.d[k + 1] && base.d[k + 2] === view.d[k + 2]
        ? 1
        : 0;
  }
  return m;
}

const at = (m) => (x, y) => x >= 0 && y >= 0 && x < W && y < H && m[y * W + x] === 1;
const both = (a, b) => (x, y) => x >= 0 && y >= 0 && x < W && y < H && a[y * W + x] && b[y * W + x];

// ------------------------------------------------------------ el interior del apartamento

function wallAndCeiling(px, pal, night) {
  rect(px, pal.wall, 0, 0, W, H);
  rect(px, pal.wallShade, 0, 0, W, 7);
  rect(px, pal.wallOutline, 0, 7, W, 1);
  rect(px, night ? pal.lamp : pal.cyanL, 0, 8, W, 1);
}

function woodFloor(px, pal, top) {
  for (let y = top; y < H; y++) {
    const row = Math.floor((y - top) / 5);
    const seamY = (y - top) % 5 === 0;
    for (let x = 0; x < W; x++) {
      const off = (row * 37) % 60;
      const seamX = (x + off) % 60 === 0;
      const tone = (row + Math.floor((x + off) / 60)) % 3;
      px.set(x, y, seamY || seamX ? pal.floorLine : pal.floor[tone === 0 ? 1 : tone === 1 ? 2 : 1]);
    }
  }
  rect(px, pal.wallOutline, 0, top - 2, W, 1);
  rect(px, pal.white.light, 0, top - 1, W, 1);
}

function pot(px, pal, cx, bottom, w, h, color) {
  const m = color ?? pal.white;
  fillMask(
    px,
    (x, y) =>
      y >= bottom - h && y < bottom && Math.abs(x + 0.5 - cx) < w / 2 - (y - (bottom - h)) * 0.12,
    [cx - w / 2 - 1, bottom - h, cx + w / 2 + 1, bottom],
    (x) => (x < cx - w / 6 ? m.light : x > cx + w / 5 ? m.dark : m.mid),
    m.outline,
  );
  rect(px, m.outline, Math.round(cx - w / 2), bottom - h, w, 1);
  rect(px, pal.sunY, Math.round(cx - w / 2) + 1, bottom - h + 2, w - 2, 1);
}

function flowersAt(px, pal, x, y, n, seed, colors) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const fx = Math.round(x + (r() - 0.5) * 22);
    const fy = Math.round(y + (r() - 0.5) * 6);
    const c = colors[Math.floor(r() * colors.length)];
    px.set(fx, fy, c);
    px.set(fx - 1, fy, c);
    px.set(fx + 1, fy, c);
    px.set(fx, fy - 1, c);
    px.set(fx, fy + 1, c);
    px.set(fx, fy, pal.sunYL);
  }
}

function lampShade(px, pal, cx, y, night, r = 10) {
  fillMask(
    px,
    (x, Y) => Y >= y && Y <= y + 6 && Math.abs(x + 0.5 - cx) < r * (0.55 + ((Y - y) / 6) * 0.45),
    [cx - r - 1, y, cx + r + 1, y + 6],
    (x) => (x < cx - 2 ? pal.white.light : pal.white.mid),
    pal.white.outline,
  );
  rect(px, night ? pal.lampCore : pal.lamp, Math.round(cx - r + 2), y + 7, r * 2 - 3, 1);
  rect(px, pal.sunY, Math.round(cx - r + 3), y + 2, r * 2 - 5, 1);
  if (night) halo(px, pal.glow, cx, y + 8, 22);
}

/** La puerta futurista: arco de esquinas redondas, vidrio celeste y una costura de luz. */
function slidingDoor(px, pal, d, night) {
  const f = pal.white;
  fillMask(
    px,
    rr(d.x - 3, d.y - 3, d.x + d.w + 2, d.y + d.h, 10),
    [d.x - 4, d.y - 4, d.x + d.w + 3, d.y + d.h],
    () => f.light,
    f.outline,
  );
  const glass = rr(d.x, d.y, d.x + d.w - 1, d.y + d.h - 1, 8);
  const mid = d.x + Math.floor(d.w / 2);
  fillMask(
    px,
    glass,
    [d.x, d.y, d.x + d.w, d.y + d.h],
    (x, y) => {
      const k = (x - d.x + (y - d.y) * 0.35) % 14;
      return k < 2 ? pal.panelGlass[2] : x < mid ? pal.panelGlass[1] : pal.panelGlass[0];
    },
    pal.white.outline,
  );
  for (let y = d.y + 2; y < d.y + d.h - 1; y++) {
    px.set(mid - 1, y, pal.white.outline);
    px.set(mid, y, pal.cyan);
  }
  const by = d.y + Math.round(d.h * 0.52);
  rect(px, pal.white.outline, d.x + d.w + 4, by - 3, 5, 7);
  rect(px, pal.cyan, d.x + d.w + 5, by - 2, 3, 5);
  px.set(d.x + d.w + 6, by, pal.cyanL);
  if (night) {
    halo(px, pal.cyan, d.x + d.w + 6, by, 6);
  }
}

// ------------------------------------------------------------ la portada: el apartamento

const TITLE_WIN = { x0: 66, y0: 12, x1: 306, y1: 130, r: 18 };
const TITLE_VIEW = {
  horizon: 92,
  bands: [0, 16, 30, 44, 58, 72, 84],
  sun: [112, 46],
  moon: [196, 30],
  clouds: [
    [180, 28, 34],
    [266, 46, 26],
    [96, 22, 20],
  ],
  birds: [
    [150, 40],
    [158, 36],
    [165, 42],
  ],
  turbines: [
    [128, 20],
    [206, 16],
    [292, 22],
  ],
  far: [
    { x: 70, w: 10, top: 64, bottom: 100, kind: 'dome', seed: 1, green: 8 },
    { x: 98, w: 8, top: 70, bottom: 100, kind: 'flat', seed: 2 },
    { x: 140, w: 12, top: 58, bottom: 100, kind: 'taper', seed: 3, green: 9 },
    { x: 176, w: 9, top: 66, bottom: 100, kind: 'dome', seed: 4 },
    { x: 220, w: 12, top: 60, bottom: 100, kind: 'step', seed: 5, green: 10 },
    { x: 258, w: 10, top: 68, bottom: 100, kind: 'dome', seed: 6 },
    { x: 296, w: 12, top: 62, bottom: 100, kind: 'taper', seed: 7, green: 9 },
  ],
  mid: [
    { x: 76, w: 16, top: 54, bottom: 124, kind: 'step', seed: 11, green: 13 },
    { x: 118, w: 14, top: 48, bottom: 124, kind: 'dome', seed: 12, green: 12, spire: 6 },
    { x: 192, w: 16, top: 52, bottom: 124, kind: 'leaf', seed: 13, green: 12 },
    { x: 276, w: 18, top: 50, bottom: 124, kind: 'dome', seed: 14, green: 13 },
  ],
  rail: 104,
  near: [
    { x: 92, w: 24, top: 70, bottom: 150, kind: 'dome', seed: 21, green: 14 },
    { x: 150, w: 30, top: 30, bottom: 150, kind: 'taper', seed: 22, green: 15, spire: 8 },
    { x: 226, w: 36, top: 22, bottom: 150, kind: 'dome', seed: 23, green: 14, greenStart: 26 },
  ],
  bridges: [{ x0: 180, x1: 226, y: 70 }],
  cables: [[66, 56, 306, 40]],
};

function titleBase(mode) {
  const night = mode === 'night';
  const pal = palette(mode);
  const view = cityView(mode, TITLE_VIEW);
  const px = new Pix();
  wallAndCeiling(px, pal, night);
  ceilingLights(px, pal, [34, 120, 200, 282], night);
  wainscot(px, pal, 112, 144);
  const w = TITLE_WIN;
  const glass = rr(w.x0 + 3, w.y0 + 3, w.x1 - 3, w.y1 - 3, w.r - 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (glass(x, y)) {
        const i = (y * W + x) * 4;
        px.set(x, y, [view.px.d[i], view.px.d[i + 1], view.px.d[i + 2]]);
      }
  // el marco del ventanal (blanco, grueso, esquinas redondas) y dos parteluces finos
  const frame = rr(w.x0, w.y0, w.x1, w.y1, w.r);
  for (let y = w.y0; y <= w.y1; y++)
    for (let x = w.x0; x <= w.x1; x++) {
      if (!frame(x, y) || glass(x, y)) continue;
      const edge = !frame(x - 1, y) || !frame(x + 1, y) || !frame(x, y - 1) || !frame(x, y + 1);
      const inner = glass(x - 1, y) || glass(x + 1, y) || glass(x, y - 1) || glass(x, y + 1);
      px.set(
        x,
        y,
        edge || inner
          ? pal.white.outline
          : y < w.y0 + 2 || x < w.x0 + 2
            ? pal.white.light
            : pal.white.mid,
      );
    }
  for (const mx of [146, 226])
    for (let y = w.y0 + 2; y < w.y1 - 1; y++) {
      px.set(mx - 1, y, pal.white.outline);
      px.set(mx, y, pal.white.light);
      px.set(mx + 1, y, pal.white.mid);
      px.set(mx + 2, y, pal.white.outline);
    }
  // reflejos en el vidrio (de día)
  if (!night)
    for (const [sx, sy] of [
      [80, 22],
      [160, 22],
      [240, 22],
    ])
      for (let k = 0; k < 18; k++) {
        if (glass(sx + k, sy + k)) px.blend(sx + k, sy + k, pal.glass[2], 0.45);
        if (glass(sx + k + 3, sy + k)) px.blend(sx + k + 3, sy + k, pal.glass[2], 0.3);
      }
  // cortinas de gasa recogidas a los lados del ventanal
  curtainRod(px, pal, 58, 314, 9);
  curtain(px, pal, 58, 10, 126, 30, 1);
  curtain(px, pal, 314, 10, 126, 30, -1);
  // cuadro a la izquierda: un sol sobre un cerro
  fillMask(
    px,
    rr(12, 22, 52, 52, 3),
    [11, 21, 53, 53],
    (x, y) => (y > 42 ? pal.hill.mid : pal.sky[2]),
    pal.white.outline,
  );
  rect(px, pal.white.light, 13, 23, 39, 1);
  for (let y = 26; y < 40; y++)
    for (let x = 26; x < 42; x++) if (Math.hypot(x - 33, y - 34) < 5) px.set(x, y, pal.sunY);
  for (let x = 13; x < 52; x++) px.set(x, 42 + Math.round(Math.sin(x / 6) * 2), pal.hill.outline);
  wallShelf(px, pal, 6, 70, 50);
  // el piso y la luz que entra
  woodFloor(px, pal, 144);
  if (!night)
    for (let y = 144; y < H; y++) {
      const shift = (y - 144) * 0.9;
      for (let x = Math.round(98 + shift); x < 300 + shift; x++) {
        const mullion = [146, 226].some((m) => Math.abs(x - (m + shift)) < 2);
        if (mullion) continue;
        const i = (y * W + x) * 4;
        if (x >= W) continue;
        const cur = [px.d[i], px.d[i + 1], px.d[i + 2]];
        const fl = pal.floor;
        const same = (c) => c[0] === cur[0] && c[1] === cur[1] && c[2] === cur[2];
        px.set(x, y, same(pal.floorLine) ? fl[1] : same(fl[1]) ? fl[2] : fl[3]);
      }
    }
  if (!night)
    leafShadows(
      px,
      pal,
      [
        [246, 150, 3],
        [268, 157, 4],
        [292, 167, 3],
        [304, 152, 3],
      ],
      (x, y) => y >= 146 && x >= 98 + (y - 144) * 0.9 && x < 300 + (y - 144) * 0.9,
    );
  // la jardinera bajo el ventanal
  const pl = pal.white;
  fillMask(
    px,
    rr(60, 124, 312, 146, 3),
    [59, 123, 313, 147],
    (x, y) => (y < 127 ? pl.light : y > 142 ? pl.dark : pl.mid),
    pl.outline,
  );
  rect(px, pal.cyan, 64, 140, 244, 1);
  for (let x = 68; x < 308; x += 9)
    clump(px, pal.leaf, x + (x % 3), 120 + ((x * 7) % 4), 6 + ((x * 3) % 3), { detail: 0.5 });
  flowersAt(px, pal, 104, 116, 6, 3, [pal.sunY, pal.white.light]);
  flowersAt(px, pal, 196, 114, 7, 4, [pal.sunY, pal.cushion[2]]);
  flowersAt(px, pal, 276, 116, 6, 5, [pal.white.light, pal.sunY]);
  for (const [hx, kind] of [
    [86, 0],
    [122, 1],
    [210, 2],
    [242, 0],
    [292, 1],
    [184, 2],
  ])
    (kind === 0 ? herbs : kind === 1 ? daisies : grasses)(px, pal, hx, 122, hx);
  // un limonero chico entre las plantas de la jardinera
  stem(px, pal.floorLine, 160, 124, 160, 104, 0);
  clump(px, pal.leaf, 160, 100, 9, { detail: 1 });
  for (const [lx, ly] of [
    [155, 99],
    [163, 96],
    [158, 105],
    [166, 103],
  ]) {
    px.set(lx, ly, pal.sunY);
    px.set(lx + 1, ly, pal.sunY);
    px.set(lx, ly + 1, pal.sunYD);
    px.set(lx + 1, ly + 1, pal.sunY);
  }
  for (let x = 72; x < 306; x += 14) {
    const len = 4 + ((x * 13) % 7);
    for (let k = 0; k < len; k++)
      px.set(
        x + Math.round(Math.sin(k / 2) * 1),
        127 + k,
        k % 3 === 0 ? pal.leaf.light : pal.leaf.mid,
      );
  }
  // la monstera en su maceta, a la izquierda
  pot(px, pal, 30, 170, 26, 18);
  for (const [lx, ly, r, a] of [
    [20, 118, 12, -2.4],
    [42, 112, 13, -0.7],
    [30, 98, 12, -1.6],
    [14, 138, 10, -2.9],
    [46, 134, 11, -0.2],
  ]) {
    stem(px, pal.leaf.dark, 30, 154, lx, ly, (lx - 30) * 0.15);
    bigLeaf(px, pal.leaf, lx, ly, r, a);
  }
  rugStrip(px, pal, 76, 250, 168, 180);
  vacuum(px, pal, 66, 173);
  // el sofá visto de espaldas, con dos cojines
  fillMask(
    px,
    rr(118, 132, 140, 150, 4),
    [117, 131, 141, 151],
    (x) => (x < 126 ? pal.cushion[0] : pal.cushion[0]),
    pal.cushion[1],
  );
  fillMask(
    px,
    rr(186, 134, 206, 150, 4),
    [185, 133, 207, 151],
    (x, y) => ((x + y) % 4 === 0 ? pal.cushion[3] : pal.cushion[2]),
    pal.cushion[3],
  );
  for (let x = 121; x < 139; x += 3) px.set(x, 135, pal.sunYL);
  floorShadow(px, pal, 162, 176, 74, 5);
  const sofa = rr(96, 144, 230, 178, 9);
  fillMask(
    px,
    sofa,
    [95, 143, 231, 179],
    (x, y) =>
      y < 148
        ? pal.white.light
        : y > 170
          ? pal.white.dark
          : (x - 96) % 34 === 0
            ? pal.white.dark
            : pal.white.mid,
    pal.white.outline,
  );
  rect(px, pal.cyan, 104, 168, 118, 1);
  // capitoné, ribete y sombra baja del sofá
  rect(px, pal.white.light, 104, 145, 118, 1);
  for (let x = 113; x < 222; x += 17) {
    px.set(x, 154, pal.white.outline);
    px.set(x, 162, pal.white.outline);
    px.set(x + 1, 155, pal.white.dark);
    px.set(x + 1, 163, pal.white.dark);
  }
  rect(px, pal.white.dark, 104, 173, 118, 2);
  for (const ax of [88, 216])
    fillMask(
      px,
      rr(ax, 140, ax + 22, 178, 8),
      [ax - 1, 139, ax + 23, 179],
      (x, y) => (y < 145 ? pal.white.light : x < ax + 6 ? pal.white.light : pal.white.mid),
      pal.white.outline,
    );
  fillMask(
    px,
    (x, y) => x >= 168 && x <= 196 && y >= 143 && y <= 160 + ((x * 3) % 4 === 0 ? 1 : 0),
    [167, 142, 197, 162],
    (x, y) => ((x + y) % 4 === 0 ? pal.cushion[1] : y < 146 ? pal.sunYL : pal.cushion[0]),
    pal.cushion[1],
  );
  cat(px, pal, 152, 141, 1);
  // la mesita redonda con libros y una taza
  floorShadow(px, pal, 262, 176, 16, 3);
  rect(px, pal.metal.outline, 261, 146, 3, 28);
  rect(px, pal.metal.light, 262, 146, 1, 28);
  fillMask(
    px,
    ellipse(262, 145, 17, 4),
    [244, 140, 280, 150],
    (x, y) => (y < 145 ? pal.white.light : pal.white.mid),
    pal.white.outline,
  );
  rect(px, pal.metal.outline, 252, 173, 21, 2);
  [pal.spines[1], pal.spines[2], pal.spines[0]].forEach((c, i) => {
    rect(px, pal.white.outline, 250 + i, 139 - i * 3, 16 - i * 2, 3);
    rect(px, c, 251 + i, 140 - i * 3, 14 - i * 2, 1);
  });
  rect(px, pal.white.outline, 270, 136, 6, 6);
  rect(px, pal.white.light, 271, 137, 4, 4);
  px.set(276, 138, pal.white.outline);
  px.set(277, 139, pal.white.outline);
  if (!night) {
    px.set(272, 134, pal.white.mid);
    px.set(273, 132, pal.white.mid);
  }
  // la lámpara de arco: base, un arco continuo y la pantalla sobre la mesita
  rect(px, pal.metal.outline, 292, 171, 18, 4);
  rect(px, pal.metal.light, 293, 171, 16, 1);
  const P = [
    [301, 171],
    [303, 30],
    [258, 26],
    [258, 90],
  ];
  const arc = (t) => {
    const u = 1 - t;
    const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    return [0, 1].map((i) => Math.round(k.reduce((acc, w, j) => acc + w * P[j][i], 0)));
  };
  for (let k = 0; k <= 500; k++) {
    const [x, y] = arc(k / 500);
    if (y > 88) {
      px.set(x - 1, y, pal.metal.outline);
      px.set(x, y, pal.metal.light);
      px.set(x + 1, y, pal.metal.outline);
    } else {
      px.set(x, y - 1, pal.metal.outline);
      px.set(x, y, pal.metal.light);
      px.set(x, y + 1, pal.metal.outline);
    }
  }
  const [lx, ly] = arc(1);
  lampShade(px, pal, lx, ly, night, 11);
  px.view = view;
  return px;
}

function titleFrame(base, mode, time) {
  const night = mode === 'night';
  const pal = palette(mode);
  const px = base.copy();
  const vis = (base.vis ??= visibleMask(base, base.view.px));
  const v = TITLE_VIEW;
  const behind = both(vis, base.view.bg);
  for (const [i, [tx, h]] of v.turbines.entries())
    turbineBlades(px, pal, tx, v.horizon + 2 - h, 6, time * 0.9 + i, behind);
  balloon(px, pal, 80 + ((time * 2.5) % 260), 30, behind);
  train(px, pal, v.rail + 1, time, night, both(vis, base.view.mid));
  gondolas(px, pal, v.cables[0], time, night, at(vis));
  lanes(
    px,
    pal,
    [
      [62, 18, 2, 1],
      [84, 26, 2, -1],
      [40, 12, 1, -1],
    ],
    time,
    night,
    at(vis),
  );
  return px;
}

// ------------------------------------------------------------ la terraza (biblioteca)

const ROOF_VIEW = {
  horizon: 90,
  bands: [0, 14, 28, 42, 56, 68, 80],
  sun: [64, 38],
  moon: [236, 28],
  clouds: [
    [150, 24, 44],
    [266, 18, 30],
    [28, 30, 22],
    [212, 46, 20],
  ],
  birds: [
    [112, 34],
    [120, 30],
    [127, 36],
  ],
  water: [94, 104],
  turbines: [
    [36, 14],
    [140, 12],
    [292, 16],
  ],
  far: [
    { x: 54, w: 9, top: 70, bottom: 95, kind: 'dome', seed: 31 },
    { x: 84, w: 11, top: 64, bottom: 95, kind: 'taper', seed: 32, green: 9 },
    { x: 118, w: 9, top: 72, bottom: 95, kind: 'step', seed: 33 },
    { x: 164, w: 12, top: 62, bottom: 95, kind: 'dome', seed: 34, green: 9 },
    { x: 194, w: 9, top: 70, bottom: 95, kind: 'taper', seed: 35 },
    { x: 226, w: 11, top: 66, bottom: 95, kind: 'leaf', seed: 36, green: 9 },
    { x: 262, w: 10, top: 72, bottom: 95, kind: 'dome', seed: 37 },
  ],
  mid: [
    { x: 66, w: 16, top: 50, bottom: 122, kind: 'step', seed: 41, green: 12, spire: 5 },
    { x: 100, w: 14, top: 60, bottom: 122, kind: 'dome', seed: 42, green: 12 },
    { x: 140, w: 18, top: 40, bottom: 122, kind: 'leaf', seed: 43, green: 13 },
    { x: 178, w: 14, top: 56, bottom: 122, kind: 'dome', seed: 44, green: 12 },
    { x: 206, w: 18, top: 44, bottom: 122, kind: 'taper', seed: 45, green: 13, spire: 7 },
  ],
  rail: 98,
  supertrees: [
    { x: 127, top: 72, bottom: 122 },
    { x: 167, top: 80, bottom: 122 },
  ],
  cables: [[30, 40, 250, 30]],
  roofs: [
    { x0: -4, x1: 50, top: 110, seed: 1 },
    { x0: 58, x1: 118, top: 106, seed: 2 },
    { x0: 170, x1: 232, top: 108, seed: 3 },
    { x0: 240, x1: 300, top: 104, seed: 4 },
  ],
  near: [
    { x: 4, w: 30, top: 12, bottom: 130, kind: 'dome', seed: 51, green: 14, greenStart: 24 },
    { x: 244, w: 32, top: 8, bottom: 130, kind: 'taper', seed: 52, green: 15, spire: 9 },
  ],
  bridges: [
    { x0: 34, x1: 66, y: 58 },
    { x0: 224, x1: 244, y: 52 },
  ],
};

const ROOF_SHELF = { x0: 116, x1: 204, y0: 96, y1: 114 };
const ROOF_DOOR = { x: 290, y: 104, w: 22, h: 50 };
const ROOF_VP = { x: 160, y: 40 };

/** Las azoteas vecinas, más abajo: paneles solares, árboles y una piscina. */
function neighborRoof(px, pal, r, night) {
  const t = pal.tower;
  fillMask(
    px,
    (x, y) => x >= r.x0 && x <= r.x1 && y >= r.top && y < H,
    [r.x0, r.top, r.x1, H - 1],
    (x) => (x < r.x0 + 4 ? t.warm : x > r.x1 - 6 ? t.shade : t.mid),
    t.outline,
  );
  const rnd = rng(r.seed * 17);
  for (let y = r.top + 6; y < H; y += 5)
    for (let x = r.x0 + 3; x < r.x1 - 3; x += 4) {
      const lit = night && rnd() < 0.4;
      rect(px, night ? (lit ? pal.lit[0] : pal.glass[0]) : pal.glass[1], x, y, 3, 2);
    }
  const s = pal.solar;
  let x = r.x0 + 2;
  while (x < r.x1 - 6) {
    const kind = rnd();
    if (kind < 0.55) {
      for (let k = 0; k < 10 && x + k < r.x1 - 2; k++) {
        px.set(x + k, r.top - 3, k % 3 === 0 ? s.frame : s.cellL);
        px.set(x + k + 1, r.top - 2, k % 3 === 0 ? s.frame : s.cell);
        px.set(x + k + 1, r.top - 1, s.edge);
      }
      x += 12;
    } else if (kind < 0.85) {
      clump(px, pal.leaf, x + 4, r.top - 5, 4.5, { detail: 0 });
      x += 10;
    } else {
      rect(px, t.outline, x, r.top - 2, 12, 2);
      rect(px, pal.water[1], x + 1, r.top - 2, 10, 1);
      px.set(x + 3, r.top - 2, pal.water[2]);
      x += 14;
    }
  }
}

function roofDeck(px, pal, top) {
  const K = 6;
  for (let y = top; y < H; y++) {
    const dy = y - ROOF_VP.y;
    for (let x = 0; x < W; x++) {
      const f = ((x - ROOF_VP.x) / dy) * K;
      const col = Math.floor(f);
      const seam = (f - col) * (dy / K) < 1;
      const z = 1600 / dy;
      const row = Math.floor(z / 4);
      const rowSeam = (z / 4) % 1 < 1600 / (dy * dy) / 4;
      const tone = (col + row) % 2 ? pal.deck[0] : pal.deck[1];
      px.set(x, y, seam || rowSeam ? pal.deck[2] : tone);
    }
  }
}

/** El balcón: baranda de vidrio con pasamanos blanco y una jardinera corrida al pie. */
function balcony(px, pal, night) {
  const m = pal.white;
  const top = 114;
  const base = 128;
  for (let y = top + 2; y < base; y++)
    for (let x = 0; x < W; x++) {
      if ((x + (y - top)) % 30 < 2 && y < base - 2) px.blend(x, y, pal.panelGlass[2], 0.55);
      else px.blend(x, y, pal.panelGlass[1], 0.14);
    }
  rect(px, m.outline, 0, top, W, 1);
  rect(px, m.light, 0, top + 1, W, 1);
  rect(px, m.outline, 0, top + 2, W, 1);
  for (let x = 14; x < W; x += 50) {
    rect(px, m.outline, x - 1, top + 2, 3, base - top - 2);
    rect(px, m.light, x, top + 2, 1, base - top - 2);
    if (night) {
      px.set(x, top - 1, pal.lit[1]);
      halo(px, pal.glow, x, top - 1, 7);
    }
  }
  fillMask(
    px,
    (x, y) => y >= base && y <= base + 7,
    [0, base, W - 1, base + 7],
    (x, y) => (y === base + 1 ? m.light : m.mid),
    m.outline,
  );
  rect(px, pal.cyan, 0, base + 5, W, 1);
  for (let x = 2; x < W; x += 7)
    clump(px, pal.leaf, x + (x % 3), base - 2 + ((x * 5) % 3), 4 + ((x * 3) % 2), { detail: 0.5 });
  flowersAt(px, pal, 40, base - 4, 7, 21, [pal.sunY, pal.white.light]);
  flowersAt(px, pal, 200, base - 4, 6, 22, [pal.cushion[2], pal.sunY]);
  flowersAt(px, pal, 284, base - 4, 5, 23, [pal.white.light, pal.sunY]);
  for (let x = 6; x < W; x += 11) {
    const len = 3 + ((x * 13) % 5);
    for (let k = 0; k < len; k++) px.set(x, base + 2 + k, k % 2 ? pal.leaf.light : pal.leaf.mid);
  }
}

/**
 * El panel de la biblioteca: un atril-proyector blanco sobre el piso, con la cara de
 * vidrio oscuro donde brillan las ranuras de los libros (las pone la app) y la línea
 * del emisor arriba, de donde sale el holograma.
 */
function holoConsole(px, pal, s, night) {
  const m = pal.white;
  const cx = Math.round((s.x0 + s.x1) / 2);
  floorShadow(px, pal, cx, 158, 26, 3);
  // el pie: una columna fina y una base redonda
  fillMask(
    px,
    (x, y) => y >= s.y1 + 4 && y <= 156 && Math.abs(x + 0.5 - cx) < 4 + Math.max(0, y - 150) * 0.4,
    [cx - 8, s.y1 + 4, cx + 8, 157],
    (x) => (x < cx - 1 ? m.light : m.mid),
    m.outline,
  );
  fillMask(
    px,
    ellipse(cx, 156, 20, 3.4),
    [cx - 21, 152, cx + 21, 160],
    (x, y) => (y < 156 ? m.light : m.mid),
    m.outline,
  );
  rect(px, pal.cyan, cx - 14, 157, 29, 1);
  // la placa: marco blanco delgado con el vidrio oscuro y el emisor arriba
  fillMask(
    px,
    rr(s.x0 - 5, s.y0 - 6, s.x1 + 5, s.y1 + 4, 4),
    [s.x0 - 6, s.y0 - 7, s.x1 + 6, s.y1 + 5],
    (x, y) => (y < s.y0 - 3 ? m.light : x > s.x1 + 2 ? m.dark : m.mid),
    m.outline,
  );
  rect(px, pal.cyan, s.x0 - 1, s.y0 - 5, s.x1 - s.x0 + 3, 1);
  for (let x = s.x0 + 4; x <= s.x1 - 2; x += 11) px.set(x, s.y0 - 4, night ? pal.cyanL : pal.cyanD);
  fillMask(
    px,
    rr(s.x0 - 2, s.y0 - 2, s.x1 + 2, s.y1 + 1, 2),
    [s.x0 - 3, s.y0 - 3, s.x1 + 3, s.y1 + 2],
    (x) => ((x - s.x0) % 8 === 0 ? pal.screenL : pal.screen),
    m.outline,
  );
  rect(px, pal.sunY, s.x1 - 1, s.y1 + 2, 3, 1);
  if (night) halo(px, pal.cyan, cx, s.y0 - 5, 12);
}

function roofPavilion(px, pal, night) {
  const m = pal.white;
  fillMask(
    px,
    rr(280, 84, 340, 160, 12),
    [279, 83, W, 161],
    (x) => (x < 284 ? m.light : m.mid),
    m.outline,
  );
  for (let x = 284; x < W; x += 6) clump(px, pal.leaf, x, 82, 5, { detail: 0.5 });
  rect(px, night ? pal.cyan : pal.cyanL, 286, 92, 34, 1);
  slidingDoor(px, pal, ROOF_DOOR, night);
  bookSign(px, pal, 291, 93, night);
  // paneles en el techo y una enredadera que sube por la pared
  for (let x = 288; x < W; x += 10) {
    rect(px, pal.solar.edge, x, 78, 9, 1);
    rect(px, pal.solar.cell, x + 1, 79, 7, 2);
  }
  for (let y = 158; y > 96; y--) {
    const x = 282 + Math.round(Math.sin(y / 5) * 1.5);
    px.set(x, y, pal.leaf.dark);
    if (y % 5 === 0) clump(px, pal.leaf, x + (y % 10 ? 2 : -1), y, 2.4, { detail: 0 });
  }
}

function roofBase(mode) {
  const night = mode === 'night';
  const pal = palette(mode);
  const view = cityView(mode, ROOF_VIEW);
  const px = view.px.copy();
  balcony(px, pal, night);
  roofDeck(px, pal, 136);
  holoConsole(px, pal, ROOF_SHELF, night);
  roofPavilion(px, pal, night);
  lightPole(px, pal, 6, 152, 92);
  bulbGarland(px, pal, 6, 58, 282, 82, 9, night);
  beehive(px, pal, 94, 158);
  for (const [sx, hy, lean] of [
    [18, 100, -2],
    [36, 92, 1],
    [56, 106, 3],
  ])
    sunflower(px, pal, sx, hy, 150, lean);
  raisedBed(px, pal, 6, 88, 152, 172);
  for (const lx of [20, 50, 76]) {
    rect(px, pal.white.outline, lx, 143, 1, 7);
    rect(px, pal.white.light, lx - 2, 141, 5, 3);
  }
  wateringCan(px, pal, 92, 177);
  stripeRug(px, pal, 176, 240, 162, 176);
  bistroSet(px, pal, 206, 140, night);
  floorLantern(px, pal, 128, 172, night);
  floorLantern(px, pal, 190, 178, night);
  lounger(px, pal, 236, 150);
  px.view = view;
  return px;
}

/** Un dirigible solar que cruza despacio, detrás de las torres. */
function airship(px, pal, x, y, night, ok) {
  const m = pal.white;
  for (let dy = -4; dy <= 4; dy++)
    for (let dx = -14; dx <= 14; dx++) {
      if ((dx / 14) ** 2 + (dy / 4.6) ** 2 >= 1) continue;
      const edge = (dx / 13) ** 2 + (dy / 3.6) ** 2 >= 1;
      const X = Math.round(x + dx);
      const Y = y + dy;
      if (!ok(X, Y)) continue;
      px.set(
        X,
        Y,
        edge ? m.outline : dy < -1 ? (dx % 3 === 0 ? pal.solar.frame : pal.solar.cell) : m.light,
      );
    }
  for (let dx = -3; dx <= 3; dx++)
    if (ok(Math.round(x + dx), y + 6))
      px.set(Math.round(x + dx), y + 6, night ? pal.lit[1] : m.mid);
}

function roofFrame(base, mode, time) {
  const night = mode === 'night';
  const pal = palette(mode);
  const px = base.copy();
  const vis = (base.vis ??= visibleMask(base, base.view.px));
  const v = ROOF_VIEW;
  const behind = both(vis, base.view.bg);
  for (const [i, [tx, h]] of v.turbines.entries())
    turbineBlades(px, pal, tx, v.horizon + 2 - h, 6, time * 0.8 + i * 2, behind);
  airship(px, pal, ((time * 4) % (W + 60)) - 30, 30, night, behind);
  balloon(px, pal, 300 - ((time * 2) % 220), 50, behind);
  for (const [i, bx] of [128, 152, 176].entries())
    sailboat(px, pal, bx + Math.round(Math.sin(time * 0.3 + i) * 5), 101, time, behind);
  gondolas(px, pal, v.cables[0], time, night, at(vis), 4);
  train(px, pal, v.rail + 1, time * 0.8, night, both(vis, base.view.mid));
  lanes(
    px,
    pal,
    [
      [40, 16, 2, 1],
      [62, 24, 3, -1],
      [80, 20, 2, 1],
    ],
    time,
    night,
    at(vis),
  );
  bees(
    px,
    pal,
    [
      [34, 96],
      [54, 106],
      [40, 140],
      [102, 128],
      [110, 136],
    ],
    time,
  );
  return px;
}

function sunflower(px, pal, x, headY, bottom, lean) {
  for (let y = headY + 4; y < bottom; y++) {
    const sx = Math.round(x + ((y - bottom) / (headY - bottom)) * lean);
    px.set(sx, y, pal.leaf.dark);
    px.set(sx + 1, y, pal.leaf.mid);
    if ((y - headY) % 11 === 5) {
      clump(px, pal.leaf, sx + (y % 2 ? 4 : -3), y, 3, { detail: 0 });
    }
  }
  const hx = x + lean;
  for (let a = 0; a < 12; a++) {
    const ang = (a * Math.PI) / 6;
    for (let s = 4; s <= 7; s++)
      px.set(
        hx + Math.round(Math.cos(ang) * s),
        headY + Math.round(Math.sin(ang) * s * 0.9),
        s === 7 ? pal.petalD : pal.petal,
      );
  }
  for (let y = -4; y <= 4; y++)
    for (let xx = -4; xx <= 4; xx++)
      if (xx * xx + y * y <= 14)
        px.set(hx + xx, headY + y, (xx + y) % 2 ? pal.seed : pal.floorLine);
}

function raisedBed(px, pal, x0, x1, top, bottom) {
  const wd = pal.floor;
  rect(px, pal.floorLine, x0, top, x1 - x0, bottom - top);
  rect(px, wd[2], x0 + 1, top + 1, x1 - x0 - 2, 2);
  for (let y = top + 4; y < bottom - 1; y += 4) rect(px, wd[1], x0 + 1, y, x1 - x0 - 2, 3);
  rect(px, pal.seed, x0 + 2, top - 2, x1 - x0 - 4, 2);
  for (let x = x0 + 6; x < x1 - 4; x += 10) {
    clump(px, pal.leaf, x, top - 6, 5, { detail: 0.5 });
    if ((x / 10) % 2 < 1) {
      px.set(x - 2, top - 6, pal.tomato);
      px.set(x + 2, top - 8, pal.tomato);
      px.set(x + 1, top - 4, pal.tomato);
    }
  }
}

function lounger(px, pal, x, y) {
  floorShadow(px, pal, x + 24, y + 26, 28, 4);
  const m = pal.white;
  fillMask(
    px,
    (X, Y) => {
      const t = (X - x) / 48;
      if (t < 0 || t > 1) return false;
      const seat = y + 14 - Math.max(0, (0.35 - t) * 34);
      return Y >= seat && Y <= seat + 6;
    },
    [x - 1, y - 2, x + 49, y + 24],
    (X, Y) => (Y % 7 === 0 ? m.light : m.mid),
    m.outline,
  );
  fillMask(
    px,
    rr(x + 4, y + 2, x + 16, y + 9, 3),
    [x + 3, y + 1, x + 17, y + 10],
    () => pal.cushion[0],
    pal.cushion[1],
  );
  for (const lx of [x + 8, x + 42]) rect(px, pal.metal.outline, lx, y + 18, 2, 7);
}

// ------------------------------------------------------------ tu rincón (el mismo apartamento)

const STUDY_WIN = { x0: 12, y0: 16, x1: 98, y1: 134, r: 14 };
const STUDY_VIEW = {
  horizon: 100,
  bands: [0, 22, 40, 56, 70, 84, 94],
  sun: [40, 52],
  moon: [70, 36],
  clouds: [
    [64, 30, 24],
    [24, 70, 16],
  ],
  birds: [],
  turbines: [
    [32, 16],
    [84, 18],
  ],
  far: [
    { x: 16, w: 9, top: 72, bottom: 106, kind: 'dome', seed: 51, green: 8 },
    { x: 46, w: 11, top: 66, bottom: 106, kind: 'taper', seed: 52 },
    { x: 78, w: 9, top: 74, bottom: 106, kind: 'step', seed: 53, green: 9 },
  ],
  mid: [
    { x: 24, w: 16, top: 56, bottom: 128, kind: 'leaf', seed: 54, green: 12 },
    { x: 64, w: 18, top: 50, bottom: 128, kind: 'dome', seed: 55, green: 12, spire: 5 },
  ],
  rail: 108,
  near: [{ x: 4, w: 22, top: 30, bottom: 150, kind: 'dome', seed: 56, green: 14 }],
  bridges: [],
};
const STUDY_SHELF = { x0: 128, x1: 216, y0: 66, y1: 88 };
const STUDY_DOOR = { x: 286, y: 58, w: 26, h: 92 };

/**
 * El panel de tus libros: una franja de vidrio oscuro empotrada en la pared, con marco
 * blanco y su luz de cornisa, parte de la casa (no un mueble agregado). Las ranuras de
 * luz las pone la app; el holograma se proyecta hacia la pared de arriba.
 */
function wallPanel(px, pal, s, night) {
  const m = pal.white;
  // el rebaje en la pared (sombra arriba, luz abajo) para que se lea empotrado
  rect(px, pal.wallShade, s.x0 - 7, s.y0 - 7, s.x1 - s.x0 + 15, s.y1 - s.y0 + 15);
  rect(px, pal.wallOutline, s.x0 - 7, s.y0 - 7, s.x1 - s.x0 + 15, 1);
  rect(px, pal.white.light, s.x0 - 7, s.y1 + 7, s.x1 - s.x0 + 15, 1);
  fillMask(
    px,
    rr(s.x0 - 5, s.y0 - 5, s.x1 + 5, s.y1 + 5, 3),
    [s.x0 - 6, s.y0 - 6, s.x1 + 6, s.y1 + 6],
    (x, y) => (y < s.y0 - 2 ? m.light : m.mid),
    m.outline,
  );
  fillMask(
    px,
    rr(s.x0 - 1, s.y0 - 1, s.x1 + 1, s.y1 + 1, 2),
    [s.x0 - 2, s.y0 - 2, s.x1 + 2, s.y1 + 2],
    (x, y) => ((x - s.x0) % 8 === 0 || (y - s.y0) % 8 === 0 ? pal.screenL : pal.screen),
    m.outline,
  );
  // el emisor arriba y el piloto del costado
  rect(px, pal.cyan, s.x0 + 2, s.y0 - 4, s.x1 - s.x0 - 3, 1);
  for (let x = s.x0 + 6; x < s.x1 - 2; x += 12) px.set(x, s.y0 - 3, night ? pal.cyanL : pal.cyanD);
  rect(px, pal.sunY, s.x1 + 2, s.y1 - 1, 2, 2);
  if (night) halo(px, pal.cyan, (s.x0 + s.x1) / 2, s.y0 - 3, 14);
}

/** Una maceta colgada del techo, con lianas que caen. */
function hangingPlanter(px, pal, x, y, seed) {
  for (let k = 9; k < y; k++) px.set(x, k, pal.metal.outline);
  fillMask(
    px,
    (X, Y) => Y >= y && Y <= y + 7 && Math.hypot((X + 0.5 - x) / 8, (Y + 0.5 - y) / 7) < 1,
    [x - 9, y, x + 9, y + 8],
    (X) => (X < x - 2 ? pal.white.light : pal.white.mid),
    pal.white.outline,
  );
  rect(px, pal.sunY, x - 6, y + 2, 13, 1);
  clump(px, pal.leaf, x, y - 3, 6, { detail: 0.5 });
  const r = rng(seed);
  for (let v = 0; v < 5; v++) {
    const vx = x - 7 + v * 3.5;
    const len = 10 + Math.floor(r() * 18);
    for (let k = 0; k < len; k++) {
      const X = Math.round(vx + Math.sin(k / 3 + v) * 1.2);
      px.set(X, y + 5 + k, pal.leaf.dark);
      if (k % 4 === 2) {
        px.set(X + 1, y + 5 + k, pal.leaf.light);
        px.set(X - 1, y + 6 + k, pal.leaf.mid);
      }
    }
  }
}

function sideboard(px, pal, x0, x1, top, bottom) {
  const m = pal.white;
  floorShadow(px, pal, (x0 + x1) / 2, bottom + 1, (x1 - x0) / 2 + 4, 3);
  fillMask(
    px,
    rr(x0, top, x1, bottom - 4, 3),
    [x0 - 1, top - 1, x1 + 1, bottom - 3],
    (x, y) => (y < top + 2 ? m.light : m.mid),
    m.outline,
  );
  const n = 3;
  for (let i = 1; i < n; i++)
    rect(px, m.outline, Math.round(x0 + ((x1 - x0) * i) / n), top + 3, 1, bottom - top - 8);
  for (let i = 0; i < n; i++) {
    const cx = Math.round(x0 + ((x1 - x0) * (i + 0.5)) / n);
    rect(px, pal.sunYD, cx - 3, top + 8, 7, 1);
  }
  rect(px, pal.cyan, x0 + 2, bottom - 6, x1 - x0 - 3, 1);
  for (const lx of [x0 + 4, x1 - 5]) rect(px, pal.metal.outline, lx, bottom - 4, 2, 4);
}

/** La base de carga del robot y un velador de hongo. */
function sideboardTop(px, pal, x, top, night) {
  fillMask(
    px,
    ellipse(x, top - 1, 9, 2.4),
    [x - 10, top - 4, x + 10, top + 1],
    () => pal.metal.mid,
    pal.metal.outline,
  );
  rect(px, pal.cyan, x - 6, top - 2, 13, 1);
  // velador
  const lx = x + 40;
  rect(px, pal.metal.outline, lx - 1, top - 10, 3, 10);
  fillMask(
    px,
    (X, Y) =>
      Y >= top - 18 &&
      Y <= top - 10 &&
      Math.hypot((X + 0.5 - lx) / 8, (Y + 0.5 - (top - 10)) / 8) < 1,
    [lx - 9, top - 19, lx + 9, top - 9],
    (X) => (X < lx ? pal.white.light : pal.white.mid),
    pal.white.outline,
  );
  if (night) halo(px, pal.glow, lx, top - 9, 16);
  // una pila de libros
  [pal.spines[4], pal.spines[1], pal.spines[2]].forEach((c, i) => {
    rect(px, pal.white.outline, x - 34 + i, top - 3 - i * 3, 16 - i * 2, 3);
    rect(px, c, x - 33 + i, top - 2 - i * 3, 14 - i * 2, 1);
  });
}

function eggChair(px, pal, cx, cy, night) {
  const m = pal.white;
  for (let y = 8; y < cy - 30; y++) px.set(cx, y, y % 2 ? pal.metal.outline : pal.metal.dark);
  floorShadow(px, pal, cx, 166, 20, 4);
  fillMask(
    px,
    ellipse(cx, cy, 22, 31),
    [cx - 23, cy - 32, cx + 23, cy + 32],
    (x) => (x < cx - 12 ? m.light : x > cx + 14 ? m.dark : m.mid),
    m.outline,
  );
  fillMask(
    px,
    (x, y) => ellipse(cx + 4, cy + 4, 15, 23)(x, y),
    [cx - 12, cy - 20, cx + 20, cy + 28],
    (x, y) => (y > cy + 8 ? pal.cushion[0] : night ? pal.wallShade : pal.panelGlass[1]),
    m.outline,
  );
  fillMask(
    px,
    ellipse(cx + 1, cy + 2, 6, 5),
    [cx - 6, cy - 4, cx + 8, cy + 8],
    () => pal.cushion[2],
    pal.cushion[3],
  );
  rect(px, pal.cushion[1], cx - 8, cy + 8, 26, 1);
  rect(px, pal.cyan, cx - 18, cy + 24, 6, 1);
}

function studyBase(mode) {
  const night = mode === 'night';
  const pal = palette(mode);
  const view = cityView(mode, STUDY_VIEW);
  const px = new Pix();
  wallAndCeiling(px, pal, night);
  wainscot(px, pal, 114, 146);
  wallClock(px, pal, 274, 38, 8);
  const w = STUDY_WIN;
  const glass = rr(w.x0 + 3, w.y0 + 3, w.x1 - 3, w.y1 - 3, w.r - 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (glass(x, y)) {
        const i = (y * W + x) * 4;
        px.set(x, y, [view.px.d[i], view.px.d[i + 1], view.px.d[i + 2]]);
      }
  const frame = rr(w.x0, w.y0, w.x1, w.y1, w.r);
  for (let y = w.y0; y <= w.y1; y++)
    for (let x = w.x0; x <= w.x1; x++) {
      if (!frame(x, y) || glass(x, y)) continue;
      const edge = !frame(x - 1, y) || !frame(x + 1, y) || !frame(x, y - 1) || !frame(x, y + 1);
      const inner = glass(x - 1, y) || glass(x + 1, y) || glass(x, y - 1) || glass(x, y + 1);
      px.set(x, y, edge || inner ? pal.white.outline : pal.white.mid);
    }
  for (let y = w.y0 + 2; y < w.y1 - 1; y++) {
    px.set(55, y, pal.white.outline);
    px.set(56, y, pal.white.light);
    px.set(57, y, pal.white.outline);
  }
  if (!night)
    for (const sx of [20, 62])
      for (let k = 0; k < 16; k++)
        if (glass(sx + k, 26 + k)) px.blend(sx + k, 26 + k, pal.glass[2], 0.45);
  curtainRod(px, pal, 6, 104, 12);
  curtain(px, pal, 6, 13, 130, 22, 1);
  curtain(px, pal, 104, 13, 130, 22, -1);
  trackLights(px, pal, 130, 216, night);
  // el alféizar con macetitas
  fillMask(
    px,
    rr(8, 132, 102, 138, 2),
    [7, 131, 103, 139],
    (x, y) => (y < 134 ? pal.white.light : pal.white.mid),
    pal.white.outline,
  );
  for (const [x, kind] of [
    [22, 0],
    [42, 1],
    [84, 0],
  ]) {
    pot(px, pal, x, 132, 10, 7);
    if (kind) clump(px, pal.leaf, x, 121, 5, { detail: 0 });
    else {
      fillMask(
        px,
        rr(x - 2, 115, x + 2, 125, 2),
        [x - 3, 114, x + 3, 126],
        () => pal.leaf.mid,
        pal.leaf.outline,
      );
      px.set(x, 114, pal.cushion[0]);
    }
  }
  woodFloor(px, pal, 146);
  if (!night)
    for (let y = 146; y < H; y++) {
      const shift = (y - 146) * 1.4;
      for (let x = Math.round(16 + shift); x < 96 + shift && x < W; x++) {
        if (Math.abs(x - (56 + shift)) < 2) continue;
        const i = (y * W + x) * 4;
        const cur = [px.d[i], px.d[i + 1], px.d[i + 2]];
        const same = (c) => c[0] === cur[0] && c[1] === cur[1] && c[2] === cur[2];
        px.set(
          x,
          y,
          same(pal.floorLine) ? pal.floor[1] : same(pal.floor[1]) ? pal.floor[2] : pal.floor[3],
        );
      }
    }
  windowSeat(px, pal, 10, 100, 142, 158);
  sunRug(px, pal, 172, 164, 72, 11);
  pouf(px, pal, 148, 164);
  floorBooks(px, pal, 124, 177);
  doorMat(px, pal, 280, 318, 154);
  wallPanel(px, pal, STUDY_SHELF, night);
  hangingPlanter(px, pal, 116, 34, 3);
  hangingPlanter(px, pal, 228, 26, 7);
  sideboard(px, pal, 122, 222, 112, 146);
  sideboardTop(px, pal, 160, 112, night);
  // una planta alta junto a la ventana
  pot(px, pal, 112, 172, 18, 14);
  for (const [lx, ly, r, a] of [
    [104, 132, 9, -2.2],
    [120, 126, 9, -0.9],
    [110, 116, 8, -1.6],
    [124, 146, 7, -0.3],
  ]) {
    stem(px, pal.leaf.dark, 112, 160, lx, ly, (lx - 112) * 0.15);
    bigLeaf(px, pal.leaf, lx, ly, r, a);
  }
  sideTable(px, pal, 220, 140, 162);
  eggChair(px, pal, 254, 112, night);
  cat(px, pal, 258, 121, -1);
  knitThrow(px, pal, 248, 266, 128);
  slidingDoor(px, pal, STUDY_DOOR, night);
  px.view = view;
  return px;
}

function studyFrame(base, mode, time) {
  const night = mode === 'night';
  const pal = palette(mode);
  const px = base.copy();
  const vis = (base.vis ??= visibleMask(base, base.view.px));
  const v = STUDY_VIEW;
  for (const [i, [tx, h]] of v.turbines.entries())
    turbineBlades(px, pal, tx, v.horizon + 2 - h, 5, time * 0.9 + i, both(vis, base.view.bg));
  train(px, pal, v.rail + 1, time * 0.7, night, both(vis, base.view.mid));
  lanes(
    px,
    pal,
    [
      [62, 14, 1, 1],
      [80, 20, 1, -1],
    ],
    time,
    night,
    at(vis),
  );
  return px;
}

// ------------------------------------------------------------ detalles (fase de enriquecimiento)

/** Barra de cortina con remates. */
function curtainRod(px, pal, x0, x1, y) {
  rect(px, pal.metal.outline, x0, y - 1, x1 - x0 + 1, 3);
  rect(px, pal.metal.light, x0, y, x1 - x0 + 1, 1);
  for (const x of [x0 - 2, x1 + 1]) {
    rect(px, pal.metal.outline, x, y - 2, 3, 5);
    px.set(x + 1, y, pal.sunY);
  }
}

/**
 * Cortina de gasa recogida con una cinta: ancha arriba, se angosta en la cinta y se abre
 * abajo. Pliegues verticales en tres tonos. `side` = 1 crece a la derecha de x, -1 a la izquierda.
 */
function curtain(px, pal, x, top, bottom, w, side) {
  const c = pal.curtain;
  const h = bottom - top;
  const tie = top + Math.round(h * 0.56);
  const width = (y) => {
    const t = (y - top) / h;
    if (t < 0.56) return w * (1 - (0.56 * t) / 0.56 + 0.0) * 0.55 + w * 0.45;
    return w * (0.42 + ((t - 0.56) / 0.44) * 0.36);
  };
  const inside = (X, Y) => {
    if (Y < top || Y > bottom) return false;
    const d = (X + 0.5 - x) * side;
    return d >= 0 && d < width(Y);
  };
  fillMask(
    px,
    inside,
    [x - w - 2, top, x + w + 2, bottom],
    (X, Y) => {
      const d = Math.abs(X + 0.5 - x);
      const k = (d / width(Y)) * 5;
      const fold = Math.floor(k * 1.6 + (Y > tie ? (Y - tie) * 0.04 : 0)) % 3;
      return fold === 0 ? c[0] : fold === 1 ? c[1] : c[2];
    },
    c[3],
  );
  // la cinta
  const tw = Math.round(width(tie));
  for (let k = 0; k < tw + 2; k++) {
    px.set(x + side * k, tie, pal.cushion[1]);
    px.set(x + side * k, tie + 1, pal.cushion[0]);
  }
  px.set(x + side * (tw + 2), tie + 2, pal.cushion[0]);
  px.set(x + side * (tw + 3), tie + 3, pal.cushion[1]);
  // dobladillo
  for (let X = 0; X < width(bottom); X++) px.set(x + side * X, bottom, c[3]);
}

/** Una gata naranja hecha un ovillo, durmiendo (dos orejitas y la cola alrededor). */
function cat(px, pal, x, y, face = 1) {
  const k = pal.cat;
  fillMask(
    px,
    ellipse(x, y, 9, 4.4),
    [x - 10, y - 5, x + 10, y + 5],
    (X, Y) => (Y < y - 1 ? k[2] : (X + Y) % 5 === 0 ? k[1] : k[0]),
    k[3],
  );
  const hx = x + face * 6;
  fillMask(
    px,
    ellipse(hx, y - 2, 4, 3.4),
    [hx - 5, y - 6, hx + 5, y + 2],
    (X, Y) => (Y < y - 3 ? k[2] : k[0]),
    k[3],
  );
  for (const ex of [hx - 3, hx + 2]) {
    px.set(ex, y - 6, k[3]);
    px.set(ex + 1, y - 6, k[3]);
    px.set(ex, y - 5, k[1]);
    px.set(ex + 1, y - 5, k[0]);
  }
  // ojos cerrados y nariz
  px.set(hx - 2, y - 2, k[3]);
  px.set(hx - 1, y - 2, k[3]);
  px.set(hx + 1, y - 2, k[3]);
  px.set(hx + 2, y - 2, k[3]);
  px.set(hx, y - 1, pal.blush ?? k[1]);
  // la cola que da la vuelta por delante
  for (let t = 0; t < 12; t++)
    px.set(
      x - face * 8 + face * t,
      y + 4 - Math.round(Math.sin((t / 11) * Math.PI) * 1),
      t % 4 === 0 ? k[1] : k[0],
    );
  px.set(x - face * 9, y + 3, k[3]);
  // rayas del lomo
  for (const dx of [-4, -1, 2]) {
    px.set(x + dx, y - 3, k[1]);
    px.set(x + dx + 1, y - 4, k[1]);
  }
}

/** Repisa flotante con florero, libros y una figurita de robot. */
function wallShelf(px, pal, x, y, w) {
  rect(px, pal.white.outline, x, y, w, 3);
  rect(px, pal.white.light, x + 1, y, w - 2, 1);
  rect(px, pal.wallShade, x + 2, y + 3, w - 4, 1);
  // florero con dos flores
  fillMask(
    px,
    rr(x + 3, y - 7, x + 8, y - 1, 2),
    [x + 2, y - 8, x + 9, y],
    () => pal.cushion[2],
    pal.cushion[3],
  );
  stem(px, pal.leaf.dark, x + 5, y - 7, x + 3, y - 14, 0);
  stem(px, pal.leaf.dark, x + 6, y - 7, x + 9, y - 12, 0);
  flowersAt(px, pal, x + 3, y - 15, 1, 41, [pal.sunY]);
  px.set(x + 9, y - 13, pal.white.light);
  px.set(x + 10, y - 13, pal.white.light);
  px.set(x + 9, y - 14, pal.white.light);
  // libros de pie y uno acostado
  [pal.spines[0], pal.spines[1], pal.spines[3], pal.spines[5]].forEach((c, i) => {
    const bh = 8 + (i % 2);
    rect(px, pal.white.outline, x + 13 + i * 3, y - bh, 3, bh);
    rect(px, c, x + 14 + i * 3, y - bh + 1, 1, bh - 1);
    px.set(x + 14 + i * 3, y - bh + 2, pal.sunYL);
  });
  rect(px, pal.white.outline, x + 26, y - 3, 10, 3);
  rect(px, pal.spines[2], x + 27, y - 2, 8, 1);
  // la figurita: Tuerca en miniatura
  rect(px, pal.white.outline, x + w - 9, y - 6, 7, 6);
  rect(px, pal.white.light, x + w - 8, y - 5, 5, 3);
  rect(px, pal.cyan, x + w - 7, y - 4, 3, 1);
  rect(px, pal.metal.dark, x + w - 9, y - 1, 7, 1);
  px.set(x + w - 7, y - 8, pal.white.outline);
  px.set(x + w - 4, y - 8, pal.white.outline);
  px.set(x + w - 7, y - 7, pal.cyan);
  px.set(x + w - 4, y - 7, pal.cyan);
}

/** Robot aspiradora redondo con su luz. */
function vacuum(px, pal, x, y) {
  floorShadow(px, pal, x, y + 2, 9, 2);
  fillMask(
    px,
    ellipse(x, y, 8, 3.2),
    [x - 9, y - 4, x + 9, y + 4],
    (X, Y) => (Y < y ? pal.white.light : pal.white.mid),
    pal.white.outline,
  );
  rect(px, pal.cyan, x - 2, y - 1, 5, 1);
  px.set(x + 6, y, pal.sunY);
}

/** Sombras de hojas dentro del rayo de sol del piso. */
function leafShadows(px, pal, spots, inLight) {
  for (const [cx, cy, r] of spots)
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r * 2; x <= cx + r * 2; x++) {
        const d = Math.hypot((x - cx) / 2, y - cy);
        const lobe = Math.sin(Math.atan2(y - cy, (x - cx) / 2) * 5) * 0.25 + 0.75;
        if (d < r * lobe && inLight(x, y)) px.set(x, y, pal.floor[2]);
      }
}

/** Mesa redonda de bistró con tetera y tazas, y dos sillas de alambre blanco. */
function bistroSet(px, pal, x, y, night) {
  floorShadow(px, pal, x, y + 22, 24, 4);
  const m = pal.white;
  const chair = (cx, dir) => {
    for (let k = 0; k < 14; k++) px.set(cx + dir * 4, y + 2 + k, m.outline);
    fillMask(
      px,
      rr(cx - 6, y, cx + 6, y + 9, 5),
      [cx - 7, y - 1, cx + 7, y + 10],
      (X, Y) => ((X + Y) % 3 === 0 ? m.light : pal.panelGlass[1]),
      m.outline,
    );
    rect(px, m.outline, cx - 6, y + 12, 13, 2);
    rect(px, pal.cushion[2], cx - 5, y + 11, 11, 1);
    for (const lx of [cx - 5, cx + 5]) rect(px, m.outline, lx, y + 14, 1, 9);
  };
  chair(x - 20, -1);
  chair(x + 20, 1);
  rect(px, pal.metal.outline, x - 1, y + 10, 3, 13);
  rect(px, pal.metal.outline, x - 7, y + 22, 15, 2);
  fillMask(
    px,
    ellipse(x, y + 9, 15, 3.4),
    [x - 16, y + 5, x + 16, y + 13],
    (X, Y) => (Y < y + 9 ? m.light : m.mid),
    m.outline,
  );
  // tetera, dos tazas y un platito con limones
  fillMask(
    px,
    ellipse(x - 3, y + 4, 4, 3.4),
    [x - 8, y, x + 2, y + 8],
    (X, Y) => (Y < y + 3 ? pal.sunYL : pal.sunY),
    pal.sunYD,
  );
  px.set(x + 2, y + 3, pal.sunYD);
  px.set(x + 3, y + 2, pal.sunYD);
  px.set(x - 3, y, pal.sunYD);
  for (const tx of [x + 6, x - 11]) {
    rect(px, m.outline, tx, y + 5, 4, 3);
    rect(px, m.light, tx + 1, y + 5, 2, 1);
  }
  px.set(x + 9, y + 6, m.outline);
  if (!night) {
    px.set(x - 3, y - 2, m.mid);
    px.set(x - 2, y - 4, m.mid);
  }
}

/** Colmena de cajas de madera clara con techito, sobre patas. */
function beehive(px, pal, x, bottom) {
  for (const lx of [x + 1, x + 12]) rect(px, pal.floorLine, lx, bottom - 6, 2, 6);
  for (let i = 0; i < 3; i++) {
    const y = bottom - 6 - (i + 1) * 7;
    rect(px, pal.floorLine, x - 1, y, 17, 7);
    rect(px, i % 2 ? pal.sunY : pal.sunYL, x, y + 1, 15, 5);
    rect(px, pal.sunYD, x, y + 5, 15, 1);
    rect(px, pal.floorLine, x + 6, y + 4, 3, 1);
  }
  const roofY = bottom - 6 - 3 * 7 - 4;
  fillMask(
    px,
    (X, Y) =>
      Y >= roofY && Y < roofY + 4 && Math.abs(X + 0.5 - (x + 7.5)) < 10 - (roofY + 4 - Y) * 0.6,
    [x - 3, roofY, x + 18, roofY + 4],
    () => pal.white.mid,
    pal.white.outline,
  );
  rect(px, pal.sunY, x + 2, bottom - 15, 11, 1);
}

/** Regadera de lata en el piso. */
function wateringCan(px, pal, x, y) {
  fillMask(
    px,
    rr(x, y - 6, x + 8, y, 2),
    [x - 1, y - 7, x + 9, y + 1],
    (X, Y) => (Y < y - 3 ? pal.cyanL : pal.cyan),
    pal.cyanD,
  );
  for (let k = 0; k < 5; k++) px.set(x + 9 + k, y - 3 - k, pal.cyanD);
  px.set(x + 14, y - 8, pal.cyanD);
  px.set(x + 15, y - 8, pal.cyanD);
  for (let k = 0; k < 5; k++) px.set(x + 1 + k, y - 9 + (k === 0 || k === 4 ? 1 : 0), pal.cyanD);
}

/** Poste fino con capucha solar (sostiene la guirnalda). */
function lightPole(px, pal, x, bottom, h) {
  rect(px, pal.white.outline, x - 1, bottom - h, 3, h);
  rect(px, pal.white.light, x, bottom - h, 1, h);
  rect(px, pal.white.outline, x - 3, bottom - 2, 7, 2);
  rect(px, pal.solar.edge, x - 4, bottom - h - 2, 9, 1);
  rect(px, pal.solar.cell, x - 3, bottom - h - 1, 7, 1);
}

/** Guirnalda de focos de colores entre dos puntos. */
function bulbGarland(px, pal, x0, y0, x1, y1, sag, night) {
  const cols = [pal.sunY, pal.cyanL, pal.white.light, pal.cushion[0]];
  let n = 0;
  for (let x = x0; x <= x1; x++) {
    const t = (x - x0) / (x1 - x0);
    const y = Math.round(y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag);
    px.set(x, y, pal.metal.outline);
    if ((x - x0) % 9 === 4) {
      const c = night ? pal.lit[n % 2] : cols[n % cols.length];
      px.set(x, y + 1, c);
      px.set(x, y + 2, c);
      px.set(x - 1, y + 2, c);
      px.set(x + 1, y + 2, c);
      px.set(x, y + 3, c);
      if (night) halo(px, pal.glow, x, y + 2, 5);
      n++;
    }
  }
}

/** Árbol solar (como los superárboles): tronco de enrejado verde y copa de paneles. */
function supertree(px, pal, x, top, bottom, night) {
  const t = pal.tower;
  for (let y = top + 6; y < bottom; y++) {
    const k = (y - top - 6) / (bottom - top - 6);
    const hw = Math.round(2 + (1 - k) * 5 * (k < 0.5 ? 1 : 0.6) + (k > 0.85 ? (k - 0.85) * 20 : 0));
    for (let x0 = -hw; x0 <= hw; x0++) {
      const edge = Math.abs(x0) === hw;
      const lattice = (x0 + y) % 4 === 0 || (x0 - y) % 4 === 0;
      px.set(
        x + x0,
        y,
        edge ? t.outline : lattice ? pal.leaf.mid : night ? t.shade : pal.leaf.dark,
      );
    }
  }
  fillMask(
    px,
    ellipse(x, top + 4, 11, 3.6),
    [x - 12, top, x + 12, top + 8],
    (X, Y) => (Y < top + 4 ? (X % 3 === 0 ? pal.solar.frame : pal.solar.cellL) : pal.solar.cell),
    t.outline,
  );
  for (let X = x - 9; X <= x + 9; X += 3) px.set(X, top + 8, pal.leaf.light);
  if (night) {
    px.set(x, top + 2, pal.lit[1]);
    halo(px, pal.cyan, x, top + 4, 8);
  }
}

/** Un cable de teleférico (las cabinas se mueven en el cuadro). */
function cable(px, pal, x0, y0, x1, y1) {
  for (let x = x0; x <= x1; x++) {
    const t = (x - x0) / (x1 - x0);
    px.set(x, Math.round(y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * 4), pal.metal.outline);
  }
}

function cableY(c, x) {
  const t = (x - c[0]) / (c[2] - c[0]);
  return Math.round(c[1] + (c[3] - c[1]) * t + Math.sin(t * Math.PI) * 4);
}

function gondolas(px, pal, c, time, night, ok, n = 3) {
  const span = c[2] - c[0];
  for (let k = 0; k < n; k++) {
    const x = Math.round(c[0] + ((time * 6 + (k * span) / n) % span));
    const y = cableY(c, x);
    const put = (X, Y, col) => ok(X, Y) && px.set(X, Y, col);
    put(x, y + 1, pal.metal.outline);
    put(x, y + 2, pal.metal.outline);
    for (let dy = 3; dy <= 7; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const edge = Math.abs(dx) === 3 || dy === 3 || dy === 7;
        put(
          x + dx,
          y + dy,
          edge
            ? pal.white.outline
            : dy === 5
              ? night
                ? pal.lit[1]
                : pal.glass[1]
              : pal.white.light,
        );
      }
    put(x - 1, y + 7, pal.sunY);
  }
}

/** Globo aerostático a rayas amarillas y blancas. */
function balloon(px, pal, x, y, ok) {
  const put = (X, Y, col) => ok(X, Y) && px.set(X, Y, col);
  for (let dy = -6; dy <= 6; dy++)
    for (let dx = -6; dx <= 6; dx++) {
      const yy = dy > 2 ? dy * 1.5 : dy;
      if (dx * dx + yy * yy > 36) continue;
      const edge = dx * dx + yy * yy > 26;
      put(x + dx, y + dy, edge ? pal.sunYD : Math.abs(dx) % 4 < 2 ? pal.sunY : pal.white.light);
    }
  put(x - 2, y + 8, pal.metal.outline);
  put(x + 2, y + 8, pal.metal.outline);
  for (let dx = -2; dx <= 2; dx++) {
    put(x + dx, y + 10, pal.floorLine);
    put(x + dx, y + 11, pal.floorLine);
  }
}

/** Velerito blanco que se mece en la bahía. */
function sailboat(px, pal, x, y, time, ok) {
  const put = (X, Y, col) => ok(X, Y) && px.set(X, Y, col);
  const bob = Math.round(Math.sin(time * 2 + x) * 0.6);
  for (let dx = -3; dx <= 3; dx++) put(x + dx, y + bob, pal.white.outline);
  for (let dx = -2; dx <= 2; dx++) put(x + dx, y + 1 + bob, pal.white.mid);
  for (let dy = 1; dy <= 5; dy++) {
    put(x, y - dy + bob, pal.white.outline);
    for (let dx = 1; dx <= Math.round((6 - dy) * 0.7); dx++)
      put(x + dx, y - dy + bob, pal.white.light);
  }
  put(x - 1, y - 3 + bob, pal.sunY);
}

/** Cartel holográfico con un libro abierto (sobre la puerta de la biblioteca). */
function bookSign(px, pal, x, y, night) {
  fillMask(
    px,
    rr(x, y, x + 20, y + 8, 2),
    [x - 1, y - 1, x + 21, y + 9],
    () => pal.screen,
    pal.white.outline,
  );
  const c = night ? pal.cyanL : pal.cyan;
  for (let k = 0; k < 6; k++) {
    px.set(x + 4 + k, y + 3 + (k === 5 ? 1 : 0), c);
    px.set(x + 16 - k, y + 3 + (k === 5 ? 1 : 0), c);
    px.set(x + 4 + k, y + 5, c);
    px.set(x + 16 - k, y + 5, c);
  }
  px.set(x + 10, y + 4, c);
  px.set(x + 10, y + 5, c);
  px.set(x + 4, y + 4, c);
  px.set(x + 16, y + 4, c);
  if (night) halo(px, pal.cyan, x + 10, y + 4, 9);
}

/** Banco bajo la ventana con colchoneta y cojines. */
function windowSeat(px, pal, x0, x1, top, bottom) {
  const m = pal.white;
  fillMask(
    px,
    rr(x0, top + 4, x1, bottom, 2),
    [x0 - 1, top + 3, x1 + 1, bottom + 1],
    (x, y) => (y < top + 7 ? m.light : m.mid),
    m.outline,
  );
  for (let x = x0 + 14; x < x1 - 4; x += 20) rect(px, m.outline, x, top + 8, 1, bottom - top - 9);
  fillMask(
    px,
    rr(x0 + 1, top, x1 - 1, top + 5, 2),
    [x0, top - 1, x1, top + 6],
    (x, y) => (y < top + 2 ? pal.rug[1] : pal.rug[0]),
    pal.rug[3],
  );
  fillMask(
    px,
    rr(x0 + 4, top - 8, x0 + 16, top + 1, 3),
    [x0 + 3, top - 9, x0 + 17, top + 2],
    () => pal.cushion[0],
    pal.cushion[1],
  );
  fillMask(
    px,
    rr(x1 - 18, top - 7, x1 - 6, top + 1, 3),
    [x1 - 19, top - 8, x1 - 5, top + 2],
    (x, y) => ((x + y) % 4 === 0 ? pal.cushion[3] : pal.cushion[2]),
    pal.cushion[3],
  );
  // un libro abierto sobre la colchoneta
  const bx = Math.round((x0 + x1) / 2) - 5;
  rect(px, m.outline, bx, top - 2, 11, 2);
  rect(px, m.light, bx + 1, top - 2, 4, 1);
  rect(px, m.light, bx + 6, top - 2, 4, 1);
  rect(px, pal.spines[4], bx, top, 11, 1);
}

/** Puf tejido redondo. */
function pouf(px, pal, x, y) {
  floorShadow(px, pal, x, y + 5, 12, 2);
  fillMask(
    px,
    ellipse(x, y, 11, 6),
    [x - 12, y - 7, x + 12, y + 7],
    (X, Y) => ((X * 2 + Y) % 5 === 0 ? pal.pouf[1] : Y < y - 2 ? pal.pouf[2] : pal.pouf[0]),
    pal.pouf[1],
  );
}

/** Pila de libros en el piso con una taza encima. */
function floorBooks(px, pal, x, bottom) {
  [pal.spines[6], pal.spines[0], pal.spines[1], pal.spines[4]].forEach((c, i) => {
    const w = 16 - (i % 2) * 3;
    const off = (i % 2) * 2;
    rect(px, pal.white.outline, x + off, bottom - (i + 1) * 3, w, 3);
    rect(px, c, x + off + 1, bottom - (i + 1) * 3 + 1, w - 2, 1);
    rect(px, pal.white.light, x + off + w - 3, bottom - (i + 1) * 3 + 1, 2, 1);
  });
  rect(px, pal.white.outline, x + 5, bottom - 18, 5, 6);
  rect(px, pal.white.light, x + 6, bottom - 17, 3, 4);
  rect(px, pal.cyan, x + 6, bottom - 15, 3, 1);
  px.set(x + 10, bottom - 16, pal.white.outline);
}

/** Focos de riel en el techo. */
function trackLights(px, pal, x0, x1, night) {
  rect(px, pal.metal.outline, x0, 9, x1 - x0, 2);
  for (let x = x0 + 8; x < x1 - 4; x += 22) {
    rect(px, pal.metal.outline, x, 11, 4, 4);
    rect(px, pal.metal.light, x + 1, 11, 2, 3);
    px.set(x + 1, 15, night ? pal.lampCore : pal.lamp);
    px.set(x + 2, 15, night ? pal.lampCore : pal.lamp);
    if (night) halo(px, pal.glow, x + 2, 16, 6);
  }
}

/** Mesita auxiliar con un té y una plantita. */
function sideTable(px, pal, x, top, bottom) {
  floorShadow(px, pal, x, bottom, 9, 2);
  rect(px, pal.metal.outline, x - 1, top + 2, 2, bottom - top - 2);
  fillMask(
    px,
    ellipse(x, top + 1, 9, 2.4),
    [x - 10, top - 2, x + 10, top + 4],
    (X, Y) => (Y <= top ? pal.white.light : pal.white.mid),
    pal.white.outline,
  );
  rect(px, pal.metal.outline, x - 5, bottom - 1, 11, 1);
  rect(px, pal.white.outline, x - 6, top - 4, 4, 4);
  rect(px, pal.sunYL, x - 5, top - 3, 2, 2);
  pot(px, pal, x + 4, top, 6, 4);
  clump(px, pal.leaf, x + 4, top - 6, 3.2, { detail: 0 });
}

/** Alfombra con un sol de rayos. */
function sunRug(px, pal, cx, cy, rx, ry) {
  for (let y = cy - ry; y <= cy + ry; y++)
    for (let x = cx - rx; x <= cx + rx; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const r = Math.sqrt(nx * nx + ny * ny);
      if (r >= 1) continue;
      const a = Math.atan2(ny, nx);
      let c;
      if (r > 0.92) c = pal.rug[3];
      else if (r > 0.8)
        c = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 32) % 2 ? pal.rug[2] : pal.rug[1];
      else if (r > 0.42) c = Math.floor(r * 10) % 2 ? pal.rug[0] : pal.rug[1];
      else if (r > 0.34) c = pal.sunYD;
      else c = pal.rug[2];
      px.set(x, y, c);
    }
}

/** Manta tejida colgando del borde de la silla huevo. */
function knitThrow(px, pal, x0, x1, y0) {
  for (let x = x0; x <= x1; x++) {
    const len = 7 + Math.round(Math.sin((x - x0) / 3) * 1.5);
    for (let k = 0; k < len; k++)
      px.set(
        x,
        y0 + k,
        k === len - 1 ? pal.pouf[1] : (x + k) % 4 === 0 ? pal.pouf[1] : pal.pouf[2],
      );
    if (x % 2 === 0) px.set(x, y0 + len, pal.pouf[1]);
  }
}

/** Felpudo frente a la puerta. */
function doorMat(px, pal, x0, x1, y) {
  for (let yy = y; yy < y + 4; yy++)
    for (let x = x0 + (yy - y); x < x1 - (yy - y); x++)
      px.set(x, yy, (x + yy) % 3 === 0 ? pal.floorLine : pal.floor[0]);
}

/** Zócalo de tablas en la parte baja de la pared (solo pinta donde todavía es pared). */
function wainscot(px, pal, y0, y1) {
  const isWall = (x, y) => {
    const i = (y * W + x) * 4;
    return px.d[i] === pal.wall[0] && px.d[i + 1] === pal.wall[1] && px.d[i + 2] === pal.wall[2];
  };
  for (let y = y0; y < y1; y++)
    for (let x = 0; x < W; x++) {
      if (!isWall(x, y)) continue;
      if (y === y0) px.set(x, y, pal.wallOutline);
      else if (y === y0 + 1) px.set(x, y, pal.white.light);
      else if (x % 14 === 0) px.set(x, y, pal.wallShade);
      else if (x % 14 === 1) px.set(x, y, pal.white.light);
    }
}

/** Luces empotradas en el techo. */
function ceilingLights(px, pal, xs, night) {
  for (const x of xs) {
    rect(px, pal.wallOutline, x - 3, 3, 7, 3);
    rect(px, night ? pal.lampCore : pal.white.light, x - 2, 4, 5, 1);
    if (night) halo(px, pal.glow, x, 6, 8);
  }
}

/** Alfombra tejida rectangular con borde de rombos (asoma bajo el sofá). */
function rugStrip(px, pal, x0, x1, y0, y1) {
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const edge = y === y0 || x === x0 || x === x1 - 1;
      const border = y < y0 + 3 || x < x0 + 3 || x > x1 - 4;
      const diamond = Math.abs(((x - x0) % 8) - 4) + Math.abs(((y - y0) % 8) - 4) < 3;
      px.set(x, y, edge ? pal.rug[3] : border ? pal.rug[2] : diamond ? pal.rug[0] : pal.rug[1]);
    }
}

/** Espigas de lavanda, margaritas y pastos altos para variar una jardinera. */
function herbs(px, pal, x, base, seed) {
  const r = rng(seed);
  for (let i = 0; i < 4; i++) {
    const sx = x + Math.round((r() - 0.5) * 10);
    const h = 8 + Math.floor(r() * 7);
    for (let k = 0; k < h; k++) px.set(sx, base - k, pal.leaf.dark);
    for (let k = h - 5; k < h; k++) {
      px.set(sx - 1, base - k, pal.lavender[k % 2]);
      px.set(sx + 1, base - k, pal.lavender[(k + 1) % 2]);
    }
    px.set(sx, base - h, pal.lavender[0]);
  }
}

function daisies(px, pal, x, base, seed) {
  const r = rng(seed);
  for (let i = 0; i < 3; i++) {
    const sx = x + Math.round((r() - 0.5) * 12);
    const h = 6 + Math.floor(r() * 6);
    for (let k = 0; k < h; k++) px.set(sx, base - k, pal.leaf.mid);
    const y = base - h;
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
    ])
      px.set(sx + dx, y + dy, pal.white.light);
    px.set(sx, y, pal.sunY);
  }
}

function grasses(px, pal, x, base, seed) {
  const r = rng(seed);
  for (let i = 0; i < 6; i++) {
    const h = 6 + Math.floor(r() * 10);
    const lean = (r() - 0.5) * 6;
    for (let k = 0; k < h; k++)
      px.set(
        x + i * 2 + Math.round((lean * k) / h),
        base - k,
        k > h * 0.6 ? pal.leaf.light : pal.leaf.mid,
      );
  }
}

/** Reloj de pared redondo, minimalista. */
function wallClock(px, pal, x, y, r) {
  fillMask(
    px,
    (X, Y) => Math.hypot(X + 0.5 - x, Y + 0.5 - y) < r,
    [x - r - 1, y - r - 1, x + r + 1, y + r + 1],
    () => pal.white.light,
    pal.white.outline,
  );
  for (let a = 0; a < 12; a++) {
    const ang = (a * Math.PI) / 6;
    px.set(
      x + Math.round(Math.cos(ang) * (r - 2)),
      y + Math.round(Math.sin(ang) * (r - 2)),
      a % 3 === 0 ? pal.sunYD : pal.white.dark,
    );
  }
  for (let k = 0; k < r - 3; k++) px.set(x, y - k, pal.white.outline);
  for (let k = 0; k < r - 2; k++)
    px.set(x + Math.round(k * 0.7), y + Math.round(k * 0.4), pal.white.outline);
  px.set(x, y, pal.cyan);
}

/** Farolito solar de piso. */
function floorLantern(px, pal, x, bottom, night) {
  rect(px, pal.white.outline, x - 3, bottom - 9, 7, 9);
  rect(px, night ? pal.lampCore : pal.lamp, x - 2, bottom - 8, 5, 5);
  rect(px, pal.white.light, x - 2, bottom - 3, 5, 2);
  rect(px, pal.solar.cell, x - 3, bottom - 10, 7, 1);
  if (night) halo(px, pal.glow, x, bottom - 6, 10);
}

/** Alfombra exterior a rayas. */
function stripeRug(px, pal, x0, x1, y0, y1) {
  for (let y = y0; y < y1; y++)
    for (let x = x0 + (y1 - y); x < x1 - (y1 - y) * 0.2; x++)
      px.set(
        x,
        y,
        y === y0 ? pal.rug[3] : Math.floor((x - x0) / 4) % 2 ? pal.white.light : pal.rug[0],
      );
}

// ------------------------------------------------------------ las escenas

export const SCENES = {
  title: { base: titleBase, frame: titleFrame, focus: [0.6, 0.5] },
  monastery: {
    base: roofBase,
    frame: roofFrame,
    shelf: {
      x: ROOF_SHELF.x0,
      y: ROOF_SHELF.y0,
      w: ROOF_SHELF.x1 - ROOF_SHELF.x0,
      h: ROOF_SHELF.y1 - ROOF_SHELF.y0,
    },
    door: ROOF_DOOR,
    focus: [0.5, 0.5],
  },
  study: {
    base: studyBase,
    frame: studyFrame,
    shelf: {
      x: STUDY_SHELF.x0,
      y: STUDY_SHELF.y0,
      w: STUDY_SHELF.x1 - STUDY_SHELF.x0,
      h: STUDY_SHELF.y1 - STUDY_SHELF.y0,
    },
    door: STUDY_DOOR,
    focus: [0.5, 0.5],
  },
};
