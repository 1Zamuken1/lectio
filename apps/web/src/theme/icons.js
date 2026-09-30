// Lectio · íconos de la interfaz (docs/lectio-temas.md).
//
// - Scriptorium: íconos de manuscrito iluminado, dibujados en píxeles de 16×16 con cuatro
//   tintas (k = tinta, r = bermellón, g = oro, w = brillo). Cada tinta es una variable de
//   CSS (--ic-ink, --ic-red, --ic-gold, --ic-light), así que el tema los recolorea: sobre
//   un botón activo, por ejemplo, el bermellón pasa a oro. Se diseñaron con
//   apps/cli/.scratch/icons16.mjs, que imprime cada cuadrícula para revisarla.
// - Clásico (y los mundos sin set propio): íconos de línea con currentColor.
//
//   LectioIcons.icon('play')  → <span class="icon" data-icon="play"> con el SVG del mundo
//   LectioIcons.set(el, 'pause') cambia el ícono de un elemento ya creado
//
// Al cambiar de mundo se vuelven a dibujar todos.
// Portado de apps/cli/assets/theme/icons.js como módulo ES (la CLI conserva su copia).
import { Theme } from './theme';

const ILLUMINATED = {
  play: [
    '................',
    '................',
    '.....k..........',
    '.....kk.........',
    '.....krk........',
    '.....krrk.......',
    '..gg.krrrk......',
    '.g...kwrrrk.....',
    '.g.g.kwrrrk.....',
    '..g..krrrk......',
    '.....krrk.......',
    '.....krk........',
    '.....kk.........',
    '.....k..........',
    '................',
    '................',
  ],
  pause: [
    '................',
    '...gggg..gggg...',
    '...kkkk..kkkk...',
    '...kwrk..kwrk...',
    '...kwrk..kwrk...',
    '...kwrk..kwrk...',
    '...kwrk..kwrk...',
    '...kwrk..kwrk...',
    '...kwrk..kwrk...',
    '...kwrk..kwrk...',
    '...kwrk..kwrk...',
    '...kwrk..kwrk...',
    '...kkkk..kkkk...',
    '...gggg..gggg...',
    '................',
    '................',
  ],
  prev: [
    '................',
    '................',
    '..gg........k...',
    '..kk.......kk...',
    '..kk......krk...',
    '..kk.....krrk...',
    '..kk....krrrk...',
    '..kk...kwrrrk...',
    '..kk...kwrrrk...',
    '..kk....krrrk...',
    '..kk.....krrk...',
    '..kk......krk...',
    '..kk.......kk...',
    '..gg........k...',
    '................',
    '................',
  ],
  next: [
    '................',
    '................',
    '...k........gg..',
    '...kk.......kk..',
    '...krk......kk..',
    '...krrk.....kk..',
    '...krrrk....kk..',
    '...krrrwk...kk..',
    '...krrrwk...kk..',
    '...krrrk....kk..',
    '...krrk.....kk..',
    '...krk......kk..',
    '...kk.......kk..',
    '...k........gg..',
    '................',
    '................',
  ],
  rewind: [
    '......r.........',
    '.....rrkkk......',
    '....rrr...kk....',
    '.....rr.....k...',
    '......r......k..',
    '.............k..',
    '.k....k..kkk..k.',
    '.k...kk..k....k.',
    '.k....k..kk...k.',
    '.k....k....k..k.',
    '..k..kkk.kk..k..',
    '..k..........k..',
    '...k........k...',
    '....kk....kk....',
    '......kkkk......',
    '................',
  ],
  forward: [
    '.........r......',
    '......kkkrr.....',
    '....kk...rrr....',
    '...k.....rr.....',
    '..k......r......',
    '..k.............',
    '.k....k..kkk..k.',
    '.k...kk..k....k.',
    '.k....k..kk...k.',
    '.k....k....k..k.',
    '..k..kkk.kk..k..',
    '..k..........k..',
    '...k........k...',
    '....kk....kk....',
    '......kkkk......',
    '................',
  ],
  sun: [
    '.......g........',
    '.......g........',
    '..g....r....g...',
    '...g...r...g....',
    '.....kkkkk......',
    '....kgggggk.....',
    '...kggwgggk.....',
    'ggrrkgwggggkrrgg',
    '...kgggggggk....',
    '...kgggggggk....',
    '....kgggggk.....',
    '.....kkkkk......',
    '...g...r...g....',
    '..g....r....g...',
    '.......g........',
    '.......g........',
  ],
  moon: [
    '................',
    '.............g..',
    '.....kk.....g.g.',
    '...kkgk......g..',
    '...kwgk.........',
    '..kwgk..........',
    '..kwggk.........',
    '.kwgggk.........',
    '.kwgggk.........',
    '..kwgggk........',
    '..kwggggkk...k..',
    '..kwggggggkkkk..',
    '...kggggggggk...',
    '....kkggggkk....',
    '......kkkk......',
    '................',
  ],
  settings: [
    '.......kk.......',
    '...kk.kggk.kk...',
    '..kggkkggkkggk..',
    '..kgggggggggk...',
    '...kgggkkgggk...',
    '.kkggkk..kkggkk.',
    'kgggk..rr..kgggk',
    'kggk..rwwr..kggk',
    'kggk..rwwr..kggk',
    'kgggk..rr..kgggk',
    '.kkggkk..kkggkk.',
    '...kgggkkgggk...',
    '..kgggggggggk...',
    '..kggkkggkkggk..',
    '...kk.kggk.kk...',
    '.......kk.......',
  ],
  review: [
    '................',
    '................',
    '................',
    '.....kkkkkk.....',
    '...kk......kk...',
    '..k....kk....k..',
    '.k....krrk....k.',
    'k....krggrk....k',
    'k....krggrk....k',
    '.k....krrk....k.',
    '..k....kk....k..',
    '...kk......kk...',
    '.....kkkkkk.....',
    '................',
    '................',
    '................',
  ],
  menu: [
    '................',
    '................',
    '..r.............',
    '.rgr.kkkkkkkkkk.',
    '..r.............',
    '................',
    '................',
    '..r.............',
    '.rgr.kkkkkkkkkk.',
    '..r.............',
    '................',
    '................',
    '..r.............',
    '.rgr.kkkkkkkkkk.',
    '..r.............',
    '................',
  ],
  home: [
    '.......g........',
    '......kkk.......',
    '.....krrrk......',
    '....krrrrrk.....',
    '...krrrrrrrk....',
    '..krrrrrrrrrk...',
    '.kkkkkkkkkkkkk..',
    '..kwwwwwwwwwk...',
    '..kwwwkkkwwwk...',
    '..kwwkgggkwwk...',
    '..kwwkg.gkwwk...',
    '..kwwkg.gkwwk...',
    '..kwwkg.gkwwk...',
    '..kkkkkkkkkkk...',
    '................',
    '................',
  ],
  door: [
    '................',
    '.....kkkkkk.....',
    '...kkggggggkk...',
    '..kggrrrrrrggk..',
    '..kgrrrrkrrrgk..',
    '.kgrwrrrkrrrrgk.',
    '.kgrwrrrkrrrrgk.',
    '.kgkkkkkkkkkrgk.',
    '.kgrwrrrkrrrrgk.',
    '.kgrwrrrkrrgrgk.',
    '.kgrwrrrkrrrrgk.',
    '.kgkkkkkkkkkrgk.',
    '.kgrwrrrkrrrrgk.',
    '.kgrwrrrkrrrrgk.',
    'kkkkkkkkkkkkkkkk',
    '................',
  ],
  voice: [
    '................',
    '................',
    '.......k........',
    '......kk....g...',
    '.....krk.....g..',
    '....krrk..g...g.',
    'kkkkrwrk...g..g.',
    'kwwkrwrk...g..g.',
    'kwwkrwrk...g..g.',
    'kkkkrwrk...g..g.',
    '....krrk..g...g.',
    '.....krk.....g..',
    '......kk....g...',
    '.......k........',
    '................',
    '................',
  ],
  volume: [
    '................',
    '................',
    '.............kkk',
    '.............kwk',
    '.............krk',
    '.........kkk.krk',
    '.........kwk.krk',
    '.........krk.krk',
    '.....kkk.krk.krk',
    '.....kwk.krk.krk',
    '.....krk.krk.krk',
    '.kkk.krk.krk.krk',
    '.kwk.krk.krk.krk',
    '.kkk.kkk.kkk.kkk',
    '................',
    '................',
  ],
  'volume-off': [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.........kk...kk',
    '.........krk.krk',
    '..........krkrk.',
    '.....kkk...krk..',
    '.....kwk..krkrk.',
    '.....krk.krk.krk',
    '.kkk.krk.kk...kk',
    '.kwk.krk........',
    '.kkk.kkk........',
    '................',
    '................',
  ],
  // La cuenta (Entrar / Salir): una llave antigua, como la puerta de las salas.
  // Instalar: la flecha baja a la bandeja (el dispositivo).
  install: [
    '................',
    '......kkkk......',
    '......krwk......',
    '......krrk......',
    '......krrk......',
    '......krrk......',
    '...kkkkrrkkkk...',
    '....krrrrrrk....',
    '.....krrrrk.....',
    '......krrk......',
    '.kk....kk....kk.',
    '.kgk........kgk.',
    '.kgkkkkkkkkkkgk.',
    '.kggggggggggggk.',
    '..kkkkkkkkkkkk..',
    '................',
  ],
  key: [
    '................',
    '................',
    '................',
    '..kkkk..........',
    '.kggggk.........',
    'kgwkkggkkkkkkkkk',
    'kgk..kgggggggggk',
    'kgk..kgggggggggk',
    'kggkkggkkkgggkgk',
    '.kggggk..kgkgkgk',
    '..kkkk...kgkkkgk',
    '.........kkk.kkk',
    '................',
    '................',
    '................',
    '................',
  ],
  close: [
    '................',
    '................',
    '..kk........kk..',
    '..krk......krk..',
    '...krk....krk...',
    '....krk..krk....',
    '.....krkkrk.....',
    '......krrk......',
    '......krrk......',
    '.....krkkrk.....',
    '....krk..krk....',
    '...krk....krk...',
    '..krk......krk..',
    '..kk........kk..',
    '................',
    '................',
  ],
};

/** Íconos de línea (24×24) para el Clásico. */
const LINE = {
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
  pause:
    '<rect x="6.5" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none"/>',
  prev: '<path d="M6 5v14"/><path d="M18 5.5v13L8.5 12z" fill="currentColor"/>',
  next: '<path d="M18 5v14"/><path d="M6 5.5v13l9.5-6.5z" fill="currentColor"/>',
  rewind: '<path d="M11 6l-6 6 6 6"/><path d="M19 6l-6 6 6 6"/>',
  forward: '<path d="M13 6l6 6-6 6"/><path d="M5 6l6 6-6 6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  settings:
    '<path d="M4 7h9M19 7h1M4 17h3M13 17h7"/><circle cx="16" cy="7" r="2.5"/><circle cx="10" cy="17" r="2.5"/>',
  review:
    '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  home: '<path d="M4 11l8-6.5 8 6.5"/><path d="M6.5 9.5V19h11V9.5"/><path d="M10.5 19v-5h3v5"/>',
  voice:
    '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  install: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 15v4h16v-4"/>',
  key: '<circle cx="7" cy="12" r="4"/><path d="M11 12h10M17 12v3.5M20 12v4.5"/>',
  // El volumen son barras que suben (el parlante ya es el ícono de la voz).
  volume: '<path d="M5 19v-2M10 19v-5M15 19v-8M20 19V5" stroke-width="3"/>',
  'volume-off':
    '<path d="M5 19v-2M10 19v-5" stroke-width="3"/><path d="M14.5 8.5l6 6M20.5 8.5l-6 6"/>',
  door: '<path d="M6 20V10a6 6 0 0 1 12 0v10"/><path d="M4 20h16"/><path d="M12 4v16"/><circle cx="14.5" cy="13.5" r="0.8" fill="currentColor"/>',
};

const INKS = { k: 'ink', r: 'red', g: 'gold', w: 'light' };

/** Un <path> por tinta, con los píxeles de cada fila unidos en tramos. */
function illuminatedSvg(grid) {
  const paths = {};
  grid.forEach((row, y) => {
    for (const match of row.matchAll(/k+|r+|g+|w+/g)) {
      const ink = INKS[match[0][0]];
      paths[ink] =
        (paths[ink] ?? '') + `M${match.index} ${y}h${match[0].length}v1h-${match[0].length}z`;
    }
  });
  const body = Object.entries(paths)
    .map(([ink, d]) => `<path d="${d}" style="fill:var(--ic-${ink})"/>`)
    .join('');
  return `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${body}</svg>`;
}

function lineSvg(body) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

function draw(element) {
  const name = element.dataset.icon;
  const illuminated = document.documentElement.dataset.world === 'scriptorium';
  element.innerHTML =
    illuminated && ILLUMINATED[name]
      ? illuminatedSvg(ILLUMINATED[name])
      : LINE[name]
        ? lineSvg(LINE[name])
        : '';
}

function icon(name, className = '') {
  const element = document.createElement('span');
  element.className = `icon${className ? ` ${className}` : ''}`;
  element.dataset.icon = name;
  element.setAttribute('aria-hidden', 'true');
  draw(element);
  return element;
}

/** El SVG de un ícono en el mundo activo, para los componentes de React. */
function markup(name) {
  const illuminated = document.documentElement.dataset.world === 'scriptorium';
  return illuminated && ILLUMINATED[name]
    ? illuminatedSvg(ILLUMINATED[name])
    : LINE[name]
      ? lineSvg(LINE[name])
      : '';
}

function set(element, name) {
  if (!element || element.dataset.icon === name) return;
  element.dataset.icon = name;
  draw(element);
}

function paint(root = document) {
  for (const element of root.querySelectorAll('.icon[data-icon]')) draw(element);
}

// theme.js se carga después, en el mismo <script>: se engancha al terminar de cargar.
Theme.onChange(() => paint());

export const Icons = { icon, set, paint, markup };
