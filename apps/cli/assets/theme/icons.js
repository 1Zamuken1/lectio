// Lectio · íconos de la interfaz (docs/lectio-temas.md). En los mundos de pixel art, íconos
// dibujados en una cuadrícula de 12×12; en el Clásico, íconos de línea. Toman el color del
// texto (currentColor), así que cada tema los pinta con sus propios tokens.
//
//   LectioIcons.icon('play')  → <span class="icon" data-icon="play"> con el SVG del mundo
//   LectioIcons.set(el, 'pause') cambia el ícono de un elemento ya creado
//
// Al cambiar de mundo se vuelven a dibujar todos.
(() => {
  'use strict';

  /** Cuadrículas de 12×12: X = píxel pintado. */
  const PIXEL = {
    play: [
      '............',
      '...X........',
      '...XX.......',
      '...XXX......',
      '...XXXX.....',
      '...XXXXX....',
      '...XXXXX....',
      '...XXXX.....',
      '...XXX......',
      '...XX.......',
      '...X........',
      '............',
    ],
    pause: [
      '............',
      '..XXX..XXX..',
      '..XXX..XXX..',
      '..XXX..XXX..',
      '..XXX..XXX..',
      '..XXX..XXX..',
      '..XXX..XXX..',
      '..XXX..XXX..',
      '..XXX..XXX..',
      '..XXX..XXX..',
      '..XXX..XXX..',
      '............',
    ],
    prev: [
      '............',
      '.XX......X..',
      '.XX.....XX..',
      '.XX....XXX..',
      '.XX...XXXX..',
      '.XX..XXXXX..',
      '.XX..XXXXX..',
      '.XX...XXXX..',
      '.XX....XXX..',
      '.XX.....XX..',
      '.XX......X..',
      '............',
    ],
    rewind: [
      '............',
      '.....X....X.',
      '....XX...XX.',
      '...XXX..XXX.',
      '..XXXX.XXXX.',
      '.XXXXXXXXXX.',
      '.XXXXXXXXXX.',
      '..XXXX.XXXX.',
      '...XXX..XXX.',
      '....XX...XX.',
      '.....X....X.',
      '............',
    ],
    sun: [
      '.....XX.....',
      '.X...XX...X.',
      '..X......X..',
      '....XXXX....',
      '...XXXXXX...',
      'XX.XXXXXX.XX',
      'XX.XXXXXX.XX',
      '...XXXXXX...',
      '....XXXX....',
      '..X......X..',
      '.X...XX...X.',
      '.....XX.....',
    ],
    moon: [
      '....XXXX....',
      '..XXXX......',
      '.XXXX.......',
      '.XXX........',
      'XXXX........',
      'XXXX........',
      'XXXX........',
      'XXXXX.......',
      '.XXXXX....X.',
      '.XXXXXXXXXX.',
      '..XXXXXXXX..',
      '....XXXX....',
    ],
    settings: [
      '.....XX.....',
      '.XX.XXXX.XX.',
      '.XXXXXXXXXX.',
      '..XXX..XXX..',
      '.XXX....XXX.',
      'XXX......XXX',
      'XXX......XXX',
      '.XXX....XXX.',
      '..XXX..XXX..',
      '.XXXXXXXXXX.',
      '.XX.XXXX.XX.',
      '.....XX.....',
    ],
    review: [
      '............',
      '............',
      '....XXXX....',
      '..XX....XX..',
      '.X...XX...X.',
      'X...XXXX...X',
      'X...XXXX...X',
      '.X...XX...X.',
      '..XX....XX..',
      '....XXXX....',
      '............',
      '............',
    ],
    menu: [
      '............',
      '.XXXXXXXXXX.',
      '.XXXXXXXXXX.',
      '............',
      '............',
      '.XXXXXXXXXX.',
      '.XXXXXXXXXX.',
      '............',
      '............',
      '.XXXXXXXXXX.',
      '.XXXXXXXXXX.',
      '............',
    ],
    home: [
      '.....XX.....',
      '....XXXX....',
      '...XXXXXX...',
      '..XXXXXXXX..',
      '.XXXXXXXXXX.',
      'XXXXXXXXXXXX',
      '.XX......XX.',
      '.XX......XX.',
      '.XX..XX..XX.',
      '.XX..XX..XX.',
      '.XX..XX..XX.',
      '.XXXXXXXXXX.',
    ],
    voice: [
      '............',
      '.....X......',
      '....XX...X..',
      '...XXX....X.',
      'XXXXXX..X..X',
      'XXXXXX...X.X',
      'XXXXXX...X.X',
      'XXXXXX..X..X',
      '...XXX....X.',
      '....XX...X..',
      '.....X......',
      '............',
    ],
    close: [
      '............',
      '.XX......XX.',
      '.XXX....XXX.',
      '..XXX..XXX..',
      '...XXXXXX...',
      '....XXXX....',
      '....XXXX....',
      '...XXXXXX...',
      '..XXX..XXX..',
      '.XXX....XXX.',
      '.XX......XX.',
      '............',
    ],
  };
  const mirror = (grid) => grid.map((row) => [...row].reverse().join(''));
  PIXEL.next = mirror(PIXEL.prev);
  PIXEL.forward = mirror(PIXEL.rewind);

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
  };

  function pixelSvg(grid) {
    let d = '';
    grid.forEach((row, y) => {
      for (const match of row.matchAll(/X+/g))
        d += `M${match.index} ${y}h${match[0].length}v1h-${match[0].length}z`;
    });
    return `<svg viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><path d="${d}" fill="currentColor"/></svg>`;
  }

  function lineSvg(body) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
  }

  const pixelWorld = () => {
    const world = document.documentElement.dataset.world;
    return world !== undefined && world !== 'clasico';
  };

  function draw(element) {
    const name = element.dataset.icon;
    element.innerHTML = pixelWorld()
      ? PIXEL[name]
        ? pixelSvg(PIXEL[name])
        : ''
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

  function set(element, name) {
    if (!element || element.dataset.icon === name) return;
    element.dataset.icon = name;
    draw(element);
  }

  function paint(root = document) {
    for (const element of root.querySelectorAll('.icon[data-icon]')) draw(element);
  }

  // theme.js se carga después, en el mismo <script>: se engancha al terminar de cargar.
  queueMicrotask(() => window.LectioTheme?.onChange(() => paint()));

  window.LectioIcons = { icon, set, paint };
})();
