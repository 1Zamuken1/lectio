/**
 * Íconos de la PWA: un libro abierto en pixel art sobre azul tinta (frontend §2.4).
 * Se dibujan desde la cuadrícula de abajo, sin dependencias: `pnpm --filter @lectio/web icons`
 * escribe los PNG y el SVG en `public/icons/`. Los colores son los del Scriptorium.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';

const COLORS = {
  o: '#1c2233', // contorno (tintero)
  p: '#f2e4c4', // página
  s: '#d6bf94', // sombra junto al lomo
  t: '#8c7657', // renglones
  g: '#d9a441', // tapa
  G: '#a8792a', // canto de la tapa
  r: '#9e2b25', // cinta
};
const BACKGROUND = '#2f4f7a'; // azul tinta

// Página izquierda y derecha (11 columnas cada una); el lomo es la costura "oo" del medio.
const LEFT = [
  '.ooooooooo.',
  'gopppppppso',
  'goptttttpso',
  'gopppppppso',
  'goptttttpso',
  'gopppppppso',
  'goptttpppso',
  'gopppppppso',
  'goptttttpso',
  'gopppppppso',
  'goptttttpso',
  'gopppppppso',
  'goooooooooo',
  'GGGGGGGGGGG',
  '...........',
  '...........',
];
const RIGHT = [
  '.ooooooooo.',
  'ospppppppog',
  'osptttttpog',
  'ospppppppog',
  'osptttttpog',
  'ospppppppog',
  'osptttttpog',
  'ospppppppog',
  'osptttpppog',
  'ospppppppog',
  'osptttttpog',
  'ospppprrpog',
  'oooooorroog',
  'GGGGGGrrGGG',
  '......rr...',
  '......r....',
];
const ART = LEFT.map((row, y) => row + RIGHT[y]);
const ART_W = ART[0].length;
const ART_H = ART.length;
if (ART.some((row) => row.length !== ART_W)) throw new Error('Filas de distinto largo');

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Un PNG de `size` px con el dibujo a `scale` px por pixel, centrado. */
function png(size, scale) {
  const w = ART_W * scale;
  const h = ART_H * scale;
  const ox = Math.floor((size - w) / 2);
  const oy = Math.floor((size - h) / 2);
  const bg = rgb(BACKGROUND);
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    const line = y * (size * 3 + 1);
    raw[line] = 0; // sin filtro
    for (let x = 0; x < size; x++) {
      const ax = Math.floor((x - ox) / scale);
      const ay = Math.floor((y - oy) / scale);
      const inside = x >= ox && y >= oy && ax < ART_W && ay < ART_H;
      const cell = inside ? ART[ay][ax] : '.';
      const color = cell === '.' ? bg : rgb(COLORS[cell]);
      raw.set(color, line + 1 + x * 3);
    }
  }
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bits por canal
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** El favicon: el mismo dibujo en SVG, un rect por pixel, sobre un cuadrado redondeado. */
function svg() {
  const pad = 2;
  const side = ART_W + pad * 2;
  const oy = Math.floor((side - ART_H) / 2);
  const rects = [];
  ART.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      if (cell !== '.') {
        rects.push(
          `<rect x="${x + pad}" y="${y + oy}" width="1" height="1" fill="${COLORS[cell]}"/>`,
        );
      }
    }),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" shape-rendering="crispEdges"><rect width="${side}" height="${side}" rx="4" fill="${BACKGROUND}"/>${rects.join('')}</svg>\n`;
}

// El "maskable" deja el dibujo dentro del círculo seguro (80 % del lado).
const ICONS = [
  ['icon-192.png', 192, 8],
  ['icon-512.png', 512, 20],
  ['maskable-192.png', 192, 5],
  ['maskable-512.png', 512, 14],
  ['apple-touch-icon.png', 180, 7],
];

const dir = new URL('../public/icons/', import.meta.url);
mkdirSync(dir, { recursive: true });
for (const [name, size, scale] of ICONS) writeFileSync(new URL(name, dir), png(size, scale));
writeFileSync(new URL('favicon.svg', dir), svg());
console.log(`Íconos en public/icons/ (${ICONS.length} PNG + favicon.svg)`);
