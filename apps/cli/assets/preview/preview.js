// Lectio · preview. Cliente sin dependencias: lee los datos embebidos en la página y
// muestra el libro como lo verá el lector, con un "modo revisión" que marca qué se
// narra, qué se omite y qué cambia. El resaltado usa la CSS Custom Highlight API, la
// misma técnica prevista para la app (docs/lectio-frontend.md §4.3).
(() => {
  'use strict';

  const data = JSON.parse(document.getElementById('lectio-data').textContent);
  const CHARS_PER_MINUTE = 900;
  const KIND = {
    narrative: 'narrativa',
    front_matter: 'preliminar',
    back_matter: 'final',
    notes: 'notas',
  };
  const SIGNAL = {
    semantic: 'semántica',
    landmark: 'landmark',
    title: 'título',
    heuristic: 'heurística',
    default: 'por defecto',
  };
  const RULES = {
    S1_page_numbers: 'Números de página',
    S1_line_numbers: 'Números de verso',
    S2_running_headers: 'Encabezados repetidos',
    S2_duplicate_titles: 'Títulos repetidos',
    S3_hidden: 'Elementos ocultos',
    S4_notes: 'Llamadas a nota reescritas',
    N1_noterefs: 'Marcas de nota no narradas',
    N2_dois: 'DOIs',
    N3_urls: 'URLs y correos',
    N4_citations: 'Citas bibliográficas',
    N5_legal: 'ISBN y avisos legales',
  };
  const PRICES = [
    ['Edge TTS (MVP)', 0],
    ['Kokoro · DeepInfra', 0.62],
    ['Azure Speech', 15],
  ];

  // ------------------------------------------------------------ preferencias

  const store = {
    get(key, fallback) {
      try {
        const value = localStorage.getItem(`lectio:${key}`);
        return value === null ? fallback : JSON.parse(value);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(`lectio:${key}`, JSON.stringify(value));
      } catch {
        /* navegación privada: se ignora */
      }
    },
  };

  const firstNarrative = Math.max(
    0,
    data.chapters.findIndex((c) => c.kind === 'narrative'),
  );
  const fromHash = Number((location.hash.match(/^#c(\d+)$/) || [])[1]);
  const state = {
    chapter: Number.isInteger(fromHash) && data.chapters[fromHash] ? fromHash : firstNarrative,
    view: 'book',
    review: store.get('review', false),
    hideAux: store.get('hideAux', false),
    size: store.get('size', 20),
  };

  // ------------------------------------------------------------ voz elegida
  //
  // Cada capítulo trae su audio en cada voz generada (`audios`). `chapter.audio` es el que
  // suena: el de la voz elegida o, si todavía no existe, el de otra voz.

  const voices = {
    selected: data.voices.some((v) => v.id === store.get('voice', null))
      ? store.get('voice', null)
      : (data.defaultVoice ?? data.voices[0]?.id ?? null),
  };

  function applyVoice() {
    for (const chapter of data.chapters) {
      chapter.audio = chapter.audios[voices.selected] ?? Object.values(chapter.audios)[0] ?? null;
    }
  }
  applyVoice();

  // ------------------------------------------------------------ utilidades DOM

  function h(tag, attributes, ...children) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes || {})) {
      if (value === false || value === null || value === undefined) continue;
      if (key === 'class') element.className = value;
      else if (key.startsWith('on')) element.addEventListener(key.slice(2), value);
      else element.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) continue;
      element.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return element;
  }

  const minutes = (chars) => Math.max(1, Math.round(chars / CHARS_PER_MINUTE));
  const chapterMinutes = (chapter) =>
    chapter.audio
      ? Math.max(1, Math.round(chapter.audio.durationMs / 60000))
      : minutes(chapter.characterCount);
  const duration = (mins) =>
    mins < 60
      ? `${mins} min`
      : `${Math.floor(mins / 60)} h ${mins % 60 ? `${mins % 60} min` : ''}`.trim();
  const number = (value) => value.toLocaleString('es', { useGrouping: 'always' });
  const money = (value) =>
    value === 0
      ? 'gratis'
      : `US$ ${value < 0.01 ? '< 0,01' : value.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ------------------------------------------------------------ tema y tamaño

  // El mundo y el modo día/noche los maneja LectioTheme (assets/theme/theme.js).

  function applySize() {
    document.documentElement.style.setProperty('--text-size', `${state.size}px`);
  }

  // ------------------------------------------------------------ estructura

  const app = document.getElementById('app');
  const sidebar = h('nav', { class: 'sidebar', 'aria-label': 'Índice del libro' });
  const main = h('main', { class: 'main', id: 'contenido', tabindex: '-1' });
  const inspector = h('aside', {
    class: 'inspector',
    'aria-label': 'Detalle de la oración',
    hidden: true,
  });
  let popover = null;

  function topbar() {
    const tab = (view, label) =>
      h(
        'button',
        { role: 'tab', 'aria-selected': String(state.view === view), onclick: () => setView(view) },
        label,
      );
    return h(
      'header',
      { class: 'topbar' },
      h(
        'button',
        {
          class: 'tool menu-toggle',
          'aria-label': 'Mostrar índice',
          onclick: () => sidebar.classList.toggle('open'),
        },
        window.LectioIcons ? window.LectioIcons.icon('menu') : '☰',
      ),
      data.library
        ? h(
            'a',
            { class: 'brand', href: data.library, title: 'Volver a la biblioteca' },
            'Lectio',
            h('small', {}, 'preview'),
          )
        : h('div', { class: 'brand' }, 'Lectio', h('small', {}, 'preview')),
      h(
        'div',
        { class: 'tabs', role: 'tablist', 'aria-label': 'Vista' },
        tab('book', 'Libro'),
        tab('report', 'Reporte'),
      ),
      h(
        'div',
        { class: 'tools' },
        h(
          'button',
          {
            class: 'tool',
            'aria-label': 'Achicar texto',
            title: 'Achicar texto',
            onclick: () => setSize(-2),
          },
          'A−',
        ),
        h(
          'button',
          {
            class: 'tool',
            'aria-label': 'Agrandar texto',
            title: 'Agrandar texto',
            onclick: () => setSize(2),
          },
          'A+',
        ),
        window.LectioTheme.modeButton(),
        window.LectioTheme.settingsButton(),
        h(
          'button',
          {
            class: 'tool',
            'aria-pressed': String(state.review),
            title: 'Marca qué se narra, qué se omite y qué cambia',
            onclick: toggleReview,
          },
          window.LectioIcons ? window.LectioIcons.icon('review') : '◉',
          h('span', { class: 'label' }, 'Modo revisión'),
        ),
      ),
    );
  }

  function renderSidebar() {
    const { book, cover } = data;
    const items = [];
    let group = null;

    data.chapters.forEach((chapter, index) => {
      const aux = chapter.kind !== 'narrative';
      if (aux && state.hideAux && index !== state.chapter) return;
      const groupName = chapter.ancestors.join(' › ');
      if (groupName !== group) {
        group = groupName;
        if (groupName) items.push(h('li', { class: 'toc-group', role: 'presentation' }, groupName));
      }
      items.push(
        h(
          'li',
          {},
          h(
            'button',
            { 'aria-current': index === state.chapter ? 'page' : false, onclick: () => go(index) },
            h('span', { class: `toc-title${aux ? ' is-hidden' : ''}` }, chapter.title),
            aux
              ? h(
                  'span',
                  { class: 'kind', title: chapter.classification.evidence },
                  KIND[chapter.kind],
                )
              : h(
                  'span',
                  { class: 'toc-meta', title: chapter.audio ? 'Tiene audio' : null },
                  `${chapter.audio ? '♪ ' : ''}${duration(chapterMinutes(chapter))}`,
                ),
          ),
        ),
      );
    });

    const auxCount = data.chapters.filter((c) => c.kind !== 'narrative').length;
    sidebar.replaceChildren(
      h(
        'div',
        { class: 'book-card' },
        cover ? h('img', { src: cover, alt: '' }) : h('span'),
        h(
          'div',
          {},
          h('h1', {}, book.title || 'Sin título'),
          h('p', {}, book.authors.join(', ') || 'Autor desconocido'),
        ),
      ),
      h('ul', { class: 'toc' }, items),
      companion(),
      auxCount
        ? h(
            'button',
            { class: 'toc-toggle', onclick: toggleAux },
            state.hideAux
              ? `Mostrar las ${auxCount} secciones no narrativas`
              : 'Ocultar las secciones no narrativas',
          )
        : null,
    );
  }

  /** El búho del scriptorium: solo decorativo; el CSS lo oculta en otros mundos. */
  function companion() {
    const Pixel = window.LectioPixel;
    if (!Pixel) return null;
    const slot = h('div', { class: 'companion-slot', 'aria-hidden': 'true' });
    slot.innerHTML = Pixel.owlBadge();
    slot.append(h('span', {}, 'Sabio, el búho, vela tu lectura.'));
    return slot;
  }

  /** Esquineros ornamentales de la página (solo Scriptorium, por CSS). */
  function pageCorners() {
    const Pixel = window.LectioPixel;
    if (!Pixel) return [];
    return ['tl', 'tr', 'bl', 'br'].map((corner) => {
      const node = h('span', { class: `page-corner ${corner}`, 'aria-hidden': 'true' });
      node.innerHTML = Pixel.fleuron();
      return node;
    });
  }

  /** Inicial iluminada en el primer párrafo con texto real (no en epígrafes ni títulos). */
  function illuminate(prose) {
    const first = [...prose.querySelectorAll('p')].find(
      (p) => (p.textContent || '').trim().length > 80 && !p.closest('blockquote, aside, figure'),
    );
    if (first) first.classList.add('illuminated');
  }

  // ------------------------------------------------------------ capítulo

  function renderChapter() {
    const chapter = data.chapters[state.chapter];
    const prose = h('div', { class: 'prose' });
    prose.innerHTML = chapter.html;
    const announcement = chapter.sentences[0] ? narrationOf(chapter, 0, prose) : '';
    for (const img of prose.querySelectorAll('img'))
      img.src = data.resources[img.getAttribute('src')] || '';

    const aux = chapter.kind !== 'narrative';
    const meta = aux
      ? `${KIND[chapter.kind]} · no se narra por defecto · ${chapter.classification.evidence}`
      : `${chapter.audio ? '' : '≈ '}${duration(chapterMinutes(chapter))} de audio · ${number(chapter.sentences.length)} oraciones`;

    const previous = data.chapters[state.chapter - 1];
    const next = data.chapters[state.chapter + 1];
    const navButton = (target, label, chapterAt) =>
      chapterAt
        ? h('button', { onclick: () => go(target) }, h('small', {}, label), chapterAt.title)
        : h('span');

    main.replaceChildren(
      h(
        'article',
        { class: `chapter${state.review ? ' review' : ''}` },
        ...pageCorners(),
        h(
          'header',
          { class: 'chapter-header' },
          chapter.ancestors.length
            ? h('div', { class: 'chapter-ancestors' }, chapter.ancestors.join(' › '))
            : null,
          // Si el capítulo abre con su propio título, el nuestro queda solo para lectores de pantalla.
          h(
            'h2',
            {
              class: opensWithTitle(prose, chapter)
                ? 'chapter-title visually-hidden'
                : 'chapter-title',
            },
            chapter.title,
          ),
          h('div', { class: 'chapter-meta' }, meta),
        ),
        h(
          'div',
          { class: 'announcement' },
          h('strong', {}, 'Anuncio narrado'),
          announcement || '—',
        ),
        h(
          'div',
          { class: 'legend', 'aria-hidden': 'true' },
          h('span', {}, h('s', {}, 'tachado'), ': no se narra'),
          h('span', {}, h('u', {}, 'subrayado'), ': se narra con cambios (clic para ver)'),
        ),
        prose,
        h(
          'nav',
          { class: 'chapter-nav', 'aria-label': 'Capítulos' },
          navButton(state.chapter - 1, '← Anterior', previous),
          navButton(state.chapter + 1, 'Siguiente →', next),
        ),
      ),
    );

    prose.addEventListener('click', onProseClick);
    illuminate(prose);
    applyHighlights(prose, chapter);
    player.current = -1;
    if (player.chapter === state.chapter) requestAnimationFrame(syncToTime);
  }

  function opensWithTitle(prose, chapter) {
    const simplify = (text) =>
      text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
    const first = prose.querySelector('[data-b]');
    if (!first || !/^H[1-6]$/.test(first.tagName)) return false;
    const heading = simplify(first.textContent);
    const title = simplify(chapter.title);
    // Por palabras completas: "i" no debe coincidir dentro de "a vindication".
    const contains = (outer, inner) => ` ${outer} `.includes(` ${inner} `);
    return heading !== '' && title !== '' && (contains(heading, title) || contains(title, heading));
  }

  /** Narración de una oración: null en los datos significa "igual al texto". */
  function narrationOf(chapter, index, prose) {
    const [blockIndex, start, end, narration] = chapter.sentences[index];
    if (narration !== null) return narration;
    const block = prose.querySelectorAll('[data-b]')[blockIndex];
    return block ? block.textContent.slice(start, end) : '';
  }

  /** Rango DOM de [start, end) dentro del texto de un bloque (mismos offsets que el pipeline). */
  function rangeFor(block, start, end) {
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let offset = 0;
    let started = false;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const length = node.textContent.length;
      if (!started && start <= offset + length) {
        range.setStart(node, start - offset);
        started = true;
      }
      if (started && end <= offset + length) {
        range.setEnd(node, end - offset);
        return range;
      }
      offset += length;
    }
    return started ? range : null;
  }

  function applyHighlights(prose, chapter) {
    if (!('highlights' in CSS)) return;
    CSS.highlights.delete('lectio-selected');
    if (!state.review) {
      CSS.highlights.delete('lectio-omitted');
      CSS.highlights.delete('lectio-changed');
      return;
    }
    const blocks = prose.querySelectorAll('[data-b]');
    const omitted = new Highlight();
    const changed = new Highlight();
    for (const [blockIndex, start, end, narration] of chapter.sentences) {
      if (blockIndex < 0 || narration === null) continue;
      const range = blocks[blockIndex] && rangeFor(blocks[blockIndex], start, end);
      if (!range) continue;
      (narration === '' ? omitted : changed).add(range);
    }
    CSS.highlights.set('lectio-omitted', omitted);
    CSS.highlights.set('lectio-changed', changed);
  }

  function onProseClick(event) {
    const noteLink = event.target.closest('a[data-lectio-note]');
    if (noteLink) {
      event.preventDefault();
      showNote(noteLink);
      return;
    }
    if (event.target.closest('a[href]')) return;
    if (state.review) {
      inspectAt(event);
      return;
    }
    const hit = window.getSelection()?.isCollapsed === false ? null : sentenceAtClick(event);
    if (hit) offerListenHere(event, hit.index);
  }

  // ------------------------------------------------------------ inspector (modo revisión)

  function caretAt(event) {
    if (document.caretPositionFromPoint) {
      const position = document.caretPositionFromPoint(event.clientX, event.clientY);
      return position && { node: position.offsetNode, offset: position.offset };
    }
    if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(event.clientX, event.clientY);
      return range && { node: range.startContainer, offset: range.startOffset };
    }
    return null;
  }

  function inspectAt(event) {
    const block = event.target.closest('[data-b]');
    const caret = caretAt(event);
    if (!block || !caret || !block.contains(caret.node)) return;

    // Offset del clic dentro del texto del bloque.
    const range = document.createRange();
    range.selectNodeContents(block);
    range.setEnd(caret.node, caret.offset);
    const offset = range.toString().length;

    const chapter = data.chapters[state.chapter];
    const blockIndex = Number(block.dataset.b);
    const candidates = chapter.sentences
      .map((s, index) => ({ s, index }))
      .filter(({ s }) => s[0] === blockIndex);
    const hit = candidates.find(({ s }) => offset >= s[1] && offset <= s[2]) || candidates[0];
    if (!hit) return;

    const [, start, end, narration] = hit.s;
    const text = block.textContent.slice(start, end);
    const said = narration === null ? text : narration;

    if ('highlights' in CSS) {
      const selected = rangeFor(block, start, end);
      if (selected) CSS.highlights.set('lectio-selected', new Highlight(selected));
    }
    inspector.replaceChildren(
      h(
        'header',
        {},
        h('span', {}, `Oración ${hit.index} · bloque ${blockIndex}`),
        h('button', { class: 'tool', 'aria-label': 'Cerrar', onclick: closeInspector }, '✕'),
      ),
      h(
        'dl',
        {},
        h('dt', {}, 'Texto'),
        h('dd', {}, text),
        h('dt', {}, 'Se narra'),
        said ? h('dd', {}, said) : h('dd', { class: 'silent' }, 'No se narra'),
      ),
      chapter.audio && timeOfSentence(chapter, hit.index) !== null
        ? h(
            'button',
            {
              class: 'tool listen-inline',
              onclick: () => {
                seekTo(timeOfSentence(chapter, hit.index));
                ensureLoaded(true);
              },
            },
            '▶ Escuchar desde aquí',
          )
        : null,
    );
    inspector.hidden = false;
  }

  function closeInspector() {
    inspector.hidden = true;
    if ('highlights' in CSS) CSS.highlights.delete('lectio-selected');
  }

  // ------------------------------------------------------------ notas

  function showNote(link) {
    closeNote();
    const chapter = data.chapters[state.chapter];
    const note = chapter.notes.find((n) => n.id === link.dataset.lectioNote);
    if (!note) return;
    const body = h('div');
    body.innerHTML = note.html;
    popover = h(
      'div',
      { class: 'note-popover', role: 'dialog', 'aria-label': 'Nota' },
      h('span', { class: 'note-label' }, `Nota ${link.textContent.trim()}`),
      body,
    );
    document.body.append(popover);

    const rect = link.getBoundingClientRect();
    const width = popover.offsetWidth;
    const left = Math.min(
      Math.max(12, rect.left + window.scrollX - width / 2),
      window.scrollX + document.documentElement.clientWidth - width - 12,
    );
    popover.style.left = `${left}px`;
    popover.style.top = `${rect.bottom + window.scrollY + 8}px`;
  }

  function closeNote() {
    popover?.remove();
    popover = null;
  }

  document.addEventListener('click', (event) => {
    if (listenChip && !listenChip.contains(event.target) && !event.target.closest('.prose'))
      closeListenChip();
    if (popover && !popover.contains(event.target) && !event.target.closest('a[data-lectio-note]'))
      closeNote();
  });

  // ------------------------------------------------------------ reporte

  function renderReport() {
    const { report } = data;
    const table = (headers, rows) =>
      h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          {},
          h(
            'thead',
            {},
            h(
              'tr',
              {},
              headers.map((label) => h('th', { scope: 'col' }, label)),
            ),
          ),
          h('tbody', {}, rows),
        ),
      );
    const stat = (value, label) =>
      h('div', { class: 'stat' }, h('strong', {}, value), h('span', {}, label));
    const narrative = report.characters.narrative;

    const cleaningRows = Object.entries(report.cleaning)
      .filter(([, v]) => v.semantic + v.heuristic > 0)
      .map(([rule, v]) =>
        h(
          'tr',
          {},
          h('td', {}, RULES[rule] || rule),
          h('td', { class: 'num' }, number(v.semantic)),
          h('td', { class: 'num' }, number(v.heuristic)),
        ),
      );
    const narrationRows = Object.entries(report.narration)
      .filter(([, count]) => count > 0)
      .map(([rule, count]) =>
        h('tr', {}, h('td', {}, RULES[rule] || rule), h('td', { class: 'num' }, number(count))),
      );

    main.replaceChildren(
      h(
        'section',
        { class: 'report' },
        h('h2', {}, 'Resumen'),
        h(
          'div',
          { class: 'stats' },
          stat(
            number(report.chapters.narrative),
            `capítulos narrativos de ${report.chapters.total} secciones`,
          ),
          stat(duration(report.characters.estimatedMinutes), 'de audio estimado'),
          stat(number(narrative), 'caracteres de narración'),
          stat(`${number(report.durationMs)} ms`, 'de procesamiento'),
        ),
        h(
          'p',
          { class: 'fine-print' },
          `Idioma: ${report.language.value} (${report.language.source === 'metadata' ? 'declarado' : 'detectado'}) · índice desde ${report.navSource} · pipeline v${report.pipelineVersion}`,
        ),

        h('h2', {}, 'Costo estimado del audio'),
        table(
          ['Proveedor', 'Libro completo'],
          PRICES.map(([name, perMillion]) =>
            h(
              'tr',
              {},
              h('td', {}, name),
              h('td', { class: 'num' }, money((narrative / 1e6) * perMillion)),
            ),
          ),
        ),
        h(
          'p',
          { class: 'fine-print' },
          'Precios por millón de caracteres de docs/lectio-decision-tts.md; solo capítulos narrativos.',
        ),

        h('h2', {}, 'Clasificación de secciones'),
        table(
          ['#', 'Sección', 'Tipo', 'Señal', 'Evidencia'],
          report.classification.map((c) =>
            h(
              'tr',
              {},
              h('td', { class: 'num' }, c.orderIndex),
              h(
                'td',
                {},
                h(
                  'button',
                  {
                    class: 'tool',
                    style: 'height:auto;padding:.2rem .5rem;text-align:left',
                    onclick: () => {
                      setView('book');
                      go(c.orderIndex);
                    },
                  },
                  c.title,
                ),
              ),
              h('td', {}, KIND[c.kind]),
              h(
                'td',
                { class: c.confidence === 'low' ? 'low' : '' },
                SIGNAL[c.signal] + (c.confidence === 'low' ? ' (baja confianza)' : ''),
              ),
              h('td', {}, c.evidence),
            ),
          ),
        ),

        h('h2', {}, 'Limpieza estructural'),
        cleaningRows.length
          ? table(['Regla', 'Semántica', 'Heurística'], cleaningRows)
          : h('p', { class: 'empty' }, 'No hizo falta limpiar nada.'),

        h('h2', {}, 'Limpieza de narración'),
        narrationRows.length
          ? table(['Regla', 'Coincidencias'], narrationRows)
          : h('p', { class: 'empty' }, 'Sin cambios.'),

        h('h2', {}, 'Advertencias'),
        report.warnings.length
          ? report.warnings.map((w) =>
              h('div', { class: 'warning' }, h('code', {}, w.code), ' ', w.message),
            )
          : h('p', { class: 'empty' }, 'Ninguna.'),
      ),
    );
  }

  // ------------------------------------------------------------ reproductor
  //
  // Una sola etiqueta <audio> para todo el preview. El reproductor sigue al capítulo que
  // se está leyendo; al terminar un capítulo pasa solo al siguiente que tenga audio.
  // Sincronización (docs/lectio-frontend.md §6): tiempo del audio → oración por búsqueda
  // binaria en la alineación, y oración → tiempo para "Escuchar desde aquí".

  const SPEED_PRESETS = [0.5, 0.75, 0.85, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  const MIN_SPEED = 0.5;
  const MAX_SPEED = 3;
  const clampSpeed = (value) =>
    Number.isFinite(value)
      ? Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.round(value * 100) / 100))
      : 1;
  const speedLabel = (value) => `${value.toLocaleString('es', { maximumFractionDigits: 2 })}×`;
  /**
   * Velocidad de cada voz: la que eligió el usuario con ella, o 1×. Cada perfil ya viene
   * a su ritmo natural en 1× (la velocidad va en el MP3).
   */
  const speedFor = (voiceId) => clampSpeed(Number(store.get(`voice-speed:${voiceId}`, 1)));
  /** Hay reproductor si algún capítulo tiene audio o si el servidor local puede generarlo. */
  let hasAudio = data.chapters.some((c) => c.audio);
  const audio = new Audio();
  audio.preload = 'metadata';
  const player = {
    chapter: null,
    current: -1,
    follow: true,
    autoScrolling: false,
    speed: speedFor(voices.selected),
    /**
     * Última oración escuchada de cada capítulo: volver a uno retoma donde ibas. Se guarda
     * la oración y no el segundo, porque cada voz tiene sus propios tiempos.
     */
    positions: new Map(),
    /** Audio cargado en el <audio>: cambia al elegir otra voz. */
    src: null,
    /** Audio cargado (con sus tiempos): durante un cambio de voz, el de la voz anterior. */
    loaded: null,
    /** Hay una voz nueva lista, esperando a que termine la oración que suena. */
    pendingSwitch: false,
    /** Capítulo que debe empezar a sonar apenas termine de generarse. */
    pendingPlay: null,
  };
  const playerBar = h('section', {
    class: 'player',
    'aria-label': 'Reproductor',
    hidden: !hasAudio,
  });
  const followButton = h(
    'button',
    { class: 'follow-return', hidden: true, onclick: resumeFollow },
    '↓ Volver a la oración actual',
  );
  let listenChip = null;
  const ui = {};
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = String(total % 60).padStart(2, '0');
    return hours ? `${hours}:${String(mins).padStart(2, '0')}:${secs}` : `${mins}:${secs}`;
  }

  /** Capítulo con audio más cercano en la dirección indicada, o null. */
  function audioChapter(from, step) {
    for (let i = from + step; i >= 0 && i < data.chapters.length; i += step) {
      if (data.chapters[i].audio) return i;
    }
    return null;
  }

  function renderPlayer() {
    if (!hasAudio) return;
    const chapter = data.chapters[state.chapter];
    const button = (label, text, onclick, extra = {}) =>
      h('button', { class: 'tool', 'aria-label': label, title: label, onclick, ...extra }, text);

    ui.voiceStatus = h('div', { class: 'voice-status', 'aria-live': 'polite' });
    ui.voiceName = h('span', { class: 'voice-name' }, currentVoiceName());
    const voiceIcon = window.LectioIcons ? window.LectioIcons.icon('voice') : '';
    ui.voice = button('Voz del narrador', [voiceIcon, ui.voiceName], toggleVoiceMenu, {
      class: 'tool voice-button',
      'aria-haspopup': 'dialog',
      'aria-expanded': 'false',
    });

    if (!chapter.audio) {
      playerBar.replaceChildren(
        h('div', { class: 'player-empty' }, ...emptyPlayer(chapter), ui.voiceStatus),
      );
      renderVoiceStatus();
      return;
    }

    // Dos pisos: arriba el progreso a todo el ancho; abajo el capítulo, los controles al
    // centro (con ▶ grande) y la velocidad y la voz.
    const Icons = window.LectioIcons;
    const glyph = (name, className) => (Icons ? Icons.icon(name, className) : name);
    const previous = audioChapter(state.chapter, -1);
    const next = audioChapter(state.chapter, 1);
    ui.playIcon = glyph(audio.paused ? 'play' : 'pause', 'big');
    ui.play = button(audio.paused ? 'Reproducir' : 'Pausar', ui.playIcon, togglePlay, {
      class: 'tool play',
    });
    const loaded =
      player.chapter === state.chapter && player.loaded ? player.loaded : chapter.audio;
    ui.current = h('span', { class: 'player-time' }, '0:00');
    ui.total = h('span', { class: 'player-time total' }, formatTime(loaded.durationMs));
    ui.progress = h('input', {
      type: 'range',
      class: 'player-progress',
      min: '0',
      max: String(loaded.durationMs),
      step: '1000',
      value: '0',
      'aria-label': 'Posición en el capítulo',
      oninput: (event) => seekTo(Number(event.target.value)),
    });
    // La perilla es la pluma del tema (en el Clásico, un punto): se dibuja aparte y el
    // <input> invisible encima sigue siendo el control accesible.
    const thumb = h('span', { class: 'progress-thumb', 'aria-hidden': 'true' });
    if (window.LectioPixel) thumb.innerHTML = window.LectioPixel.quill();
    ui.progressWrap = h(
      'div',
      { class: 'progress' },
      h(
        'span',
        { class: 'progress-track', 'aria-hidden': 'true' },
        h('span', { class: 'progress-fill' }),
      ),
      thumb,
      ui.progress,
    );
    ui.speed = button('Velocidad de reproducción', speedLabel(player.speed), toggleSpeedMenu, {
      class: 'tool speed',
      'aria-haspopup': 'dialog',
      'aria-expanded': 'false',
    });
    const skip = (label, name, text, onclick) =>
      button(label, h('span', { class: 'skip' }, glyph(name), h('small', {}, text)), onclick, {
        class: 'tool skip-button',
      });

    playerBar.replaceChildren(
      h('div', { class: 'player-track' }, ui.current, ui.progressWrap, ui.total),
      h(
        'div',
        { class: 'player-deck' },
        h(
          'div',
          { class: 'player-meta' },
          h('span', { class: 'player-title' }, chapter.title),
          h('span', { class: 'player-book' }, data.book.title || ''),
        ),
        h(
          'div',
          { class: 'player-controls' },
          button(
            'Capítulo anterior',
            glyph('prev'),
            () => previous !== null && requestChapter(previous, true),
            { disabled: previous === null },
          ),
          skip('Retroceder 15 segundos', 'rewind', '15', () => seekBy(-15000)),
          ui.play,
          skip('Avanzar 15 segundos', 'forward', '15', () => seekBy(15000)),
          button(
            'Capítulo siguiente',
            glyph('next'),
            () => next !== null && requestChapter(next, true),
            { disabled: next === null },
          ),
        ),
        h('div', { class: 'player-extra' }, ui.speed, ui.voice),
      ),
      ui.voiceStatus,
    );
    ensureLoaded(false);
    syncToTime();
    renderVoiceStatus();
  }

  /** Reproductor de un capítulo sin audio: cómo generarlo, con o sin servidor local. */
  function emptyPlayer(chapter) {
    if (!chapter.narratable) return [h('p', {}, 'Esta sección no tiene texto que narrar.')];
    const voice = voiceById(voices.selected);
    if (api.available && voice?.profile) {
      const job = jobFor(state.chapter, voices.selected);
      return [
        h('p', {}, 'Este capítulo aún no tiene audio.'),
        h(
          'div',
          { class: 'player-empty-actions' },
          job && job.status !== 'error'
            ? null
            : h(
                'button',
                { class: 'generate', onclick: () => generateFromHere() },
                `Generar con ${voice.name} (≈ ${eta(chapter)})`,
              ),
          ui.voice,
        ),
      ];
    }
    return [
      h(
        'p',
        {},
        'Este capítulo aún no tiene audio. Para generarlo desde aquí, abre la biblioteca con ',
        h('code', {}, 'pnpm serve'),
        ', o en una terminal:',
      ),
      h(
        'code',
        {},
        `pnpm lectio narrate <libro>.epub --chapters ${chapter.orderIndex} --voice ${voices.selected ?? 'gonzalo'}`,
      ),
    ];
  }

  /** Carga en el <audio> el capítulo que se está leyendo (sin reproducir). */
  function ensureLoaded(play) {
    const chapter = data.chapters[state.chapter];
    if (!chapter.audio) return false;
    if (player.chapter !== state.chapter) {
      if (player.chapter !== null) player.positions.set(player.chapter, player.current);
      audio.src = chapter.audio.src;
      player.src = chapter.audio.src;
      player.loaded = chapter.audio;
      player.pendingSwitch = false;
      player.speed = speedFor(chapter.audio.voice);
      if (ui.speed) ui.speed.textContent = speedLabel(player.speed);
      const resume = player.positions.get(state.chapter);
      if (resume >= 0) {
        audio.addEventListener(
          'loadedmetadata',
          () => (audio.currentTime = (timeOfSentence(chapter, resume) ?? 0) / 1000),
          { once: true },
        );
      }
      player.chapter = state.chapter;
      player.current = -1;
      setMediaSession(chapter);
    } else if (player.src !== chapter.audio.src) {
      switchSource();
    }
    audio.playbackRate = player.speed;
    if (play) audio.play().catch(() => {});
    return true;
  }

  function togglePlay() {
    if (!ensureLoaded(false)) return;
    if (audio.paused) {
      player.follow = true;
      followButton.hidden = true;
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }

  function playChapter(index) {
    go(index);
    ensureLoaded(true);
  }

  function seekTo(ms) {
    if (!ensureLoaded(false)) return;
    const apply = () => {
      audio.currentTime = Math.max(0, ms) / 1000;
      syncToTime();
    };
    if (audio.readyState >= 1) apply();
    else audio.addEventListener('loadedmetadata', apply, { once: true });
  }

  function seekBy(deltaMs) {
    seekTo(audio.currentTime * 1000 + deltaMs);
  }

  /** `remember`: guardar la elección para esta voz (no cuando solo se aplica la de la voz). */
  function setSpeed(value, remember = true) {
    player.speed = clampSpeed(value);
    if (remember) store.set(`voice-speed:${voices.selected}`, player.speed);
    audio.playbackRate = player.speed;
    if (ui.speed) ui.speed.textContent = speedLabel(player.speed);
    if (speedMenu) {
      speedMenu.querySelector('.speed-value').textContent = speedLabel(player.speed);
      speedMenu.querySelector('input').value = String(player.speed);
      for (const preset of speedMenu.querySelectorAll('[data-speed]')) {
        preset.setAttribute('aria-pressed', String(Number(preset.dataset.speed) === player.speed));
      }
    }
  }

  let speedMenu = null;

  /** Menú de velocidad: valores predefinidos y un control fino, sin tener que recorrer todos. */
  function toggleSpeedMenu() {
    if (speedMenu) return closeSpeedMenu();
    const slider = h('input', {
      type: 'range',
      min: String(MIN_SPEED),
      max: String(MAX_SPEED),
      step: '0.05',
      value: String(player.speed),
      'aria-label': 'Velocidad personalizada',
      oninput: (event) => setSpeed(Number(event.target.value)),
    });
    speedMenu = h(
      'div',
      { class: 'speed-menu', role: 'dialog', 'aria-label': 'Velocidad de reproducción' },
      h(
        'div',
        { class: 'speed-head' },
        h('span', {}, 'Velocidad'),
        h('strong', { class: 'speed-value' }, speedLabel(player.speed)),
      ),
      slider,
      h(
        'div',
        { class: 'speed-scale', 'aria-hidden': 'true' },
        h('span', {}, '0,5×'),
        h('span', {}, '3×'),
      ),
      h(
        'div',
        { class: 'speed-presets' },
        SPEED_PRESETS.map((value) =>
          h(
            'button',
            {
              'data-speed': String(value),
              'aria-pressed': String(value === player.speed),
              onclick: () => setSpeed(value),
            },
            value === 1 ? 'Normal' : speedLabel(value),
          ),
        ),
      ),
    );
    document.body.append(speedMenu);
    const rect = ui.speed.getBoundingClientRect();
    speedMenu.style.right = `${Math.max(12, document.documentElement.clientWidth - rect.right)}px`;
    speedMenu.style.bottom = `${window.innerHeight - rect.top + 10}px`;
    ui.speed.setAttribute('aria-expanded', 'true');
    slider.focus();
  }

  function closeSpeedMenu() {
    speedMenu?.remove();
    speedMenu = null;
    ui.speed?.setAttribute('aria-expanded', 'false');
  }

  document.addEventListener('click', (event) => {
    if (speedMenu && !speedMenu.contains(event.target) && !event.target.closest('.speed'))
      closeSpeedMenu();
  });

  // ------------------------------------------------------------ voces y generación
  //
  // Con el servidor local (`pnpm serve`), elegir una voz sin audio la genera: primero el
  // capítulo actual y, por adelantado, el siguiente. Abierto como archivo, solo se puede
  // elegir entre las voces ya generadas.

  const api = { available: false, jobs: [], timer: null, error: null };
  const orderToIndex = new Map(data.chapters.map((c, i) => [c.orderIndex, i]));
  const voiceById = (id) => data.voices.find((v) => v.id === id);
  const bookPath = `/api/books/${encodeURIComponent(data.slug)}`;
  /** Capítulos ya pedidos por adelantado con cada voz, para no repetir la solicitud. */
  const prefetched = new Set();
  /** Caracteres por segundo al generar (medido: ~25.000 caracteres en ~110 s). */
  const CHARS_PER_SECOND = 230;

  function currentVoiceName() {
    return voiceById(voices.selected)?.name ?? data.chapters[state.chapter].audio?.label ?? 'Voz';
  }

  function eta(chapter) {
    const seconds = Math.max(5, Math.round(chapter.characterCount / CHARS_PER_SECOND / 5) * 5);
    return seconds < 90 ? `${seconds} s` : `${Math.round(seconds / 60)} min`;
  }

  function nextNarratable(from) {
    for (let i = from + 1; i < data.chapters.length; i++) {
      const chapter = data.chapters[i];
      if (chapter.kind === 'narrative' && chapter.narratable) return i;
    }
    return null;
  }

  /** Trabajo pendiente (o fallido) de un capítulo con una voz. */
  function jobFor(index, voice) {
    const order = data.chapters[index].orderIndex;
    return api.jobs.find((j) => j.chapter === order && j.voice === voice && j.status !== 'done');
  }

  async function detectApi() {
    if (!location.protocol.startsWith('http') || !data.slug) return;
    try {
      const response = await fetch(`${bookPath}/audio`);
      if (!response.ok) return;
      api.available = true;
      mergeAudio(await response.json());
      await pollJobs();
    } catch {
      return; // sin servidor: solo las voces ya generadas
    }
    refreshPlayerAvailability();
    renderSidebar();
    renderPlayer();
  }

  function mergeAudio({ chapters }) {
    for (const [order, audios] of Object.entries(chapters)) {
      const index = orderToIndex.get(Number(order));
      if (index !== undefined) data.chapters[index].audios = audios;
    }
    applyVoice();
  }

  function refreshPlayerAvailability() {
    hasAudio = api.available || data.chapters.some((c) => c.audio);
    playerBar.hidden = !hasAudio;
    app.querySelector('.layout')?.classList.toggle('has-player', hasAudio);
  }

  /** Cambia el audio del capítulo que suena por el de la voz elegida, en la misma oración. */
  /**
   * Cambia el audio del capítulo que suena por el de la voz elegida. Si está sonando, no
   * corta a mitad de oración: espera a que empiece la siguiente y sigue desde ahí con la
   * voz nueva. En pausa, cambia al momento en la misma oración.
   */
  function switchSource() {
    const index = player.chapter;
    const chapter = index === null ? null : data.chapters[index];
    if (!chapter?.audio || chapter.audio.src === player.src) return;
    if (!audio.paused && player.current >= 0) {
      player.pendingSwitch = true;
      return;
    }
    swapAudio(chapter, player.current, false);
  }

  function swapAudio(chapter, sentence, play) {
    player.pendingSwitch = false;
    player.src = chapter.audio.src;
    player.loaded = chapter.audio;
    // La velocidad acompaña a la voz que suena, no a la elegida que aún se genera.
    setSpeed(speedFor(chapter.audio.voice), false);
    audio.src = chapter.audio.src;
    audio.addEventListener(
      'loadedmetadata',
      () => {
        const ms = sentence >= 0 ? timeOfSentence(chapter, sentence) : null;
        if (ms !== null) audio.currentTime = ms / 1000;
        audio.playbackRate = player.speed;
        if (play) audio.play().catch(() => {});
        syncToTime();
      },
      { once: true },
    );
  }

  function selectVoice(id) {
    if (id === voices.selected) return closeVoiceMenu();
    window.LectioSound?.play('select');
    voices.selected = id;
    store.set('voice', id);
    applyVoice();
    switchSource();
    const chapter = data.chapters[state.chapter];
    if (api.available && voiceById(id)?.profile && chapter.narratable && !chapter.audios[id]) {
      generateFromHere();
    }
    closeVoiceMenu();
    renderSidebar();
    renderPlayer();
  }

  /** El capítulo actual y, por adelantado, el siguiente, con la voz elegida. */
  function generateFromHere() {
    requestAudio(state.chapter, false);
    const next = nextNarratable(state.chapter);
    if (next !== null) requestAudio(next, true);
  }

  async function requestAudio(index, prefetch) {
    const chapter = data.chapters[index];
    const voice = voices.selected;
    if (!api.available || !chapter?.narratable || chapter.audios[voice]) return;
    if (!voiceById(voice)?.profile) return;
    api.error = null;
    try {
      const response = await fetch(`${bookPath}/chapters/${chapter.orderIndex}/audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice, prefetch }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudo generar el audio.');
      if (body.job.status === 'done') {
        await refreshAudio();
      } else {
        api.jobs = [...api.jobs.filter((j) => j.id !== body.job.id), body.job];
        schedulePoll();
      }
    } catch (error) {
      api.error = error instanceof Error ? error.message : String(error);
    }
    renderVoiceStatus();
    refreshVoiceMenu();
    if (index === state.chapter && !chapter.audio) renderPlayer();
  }

  /** Mientras suena un capítulo, se pide el siguiente para no esperar al pasar. */
  function prefetchNext() {
    if (!api.available || player.chapter === null) return;
    const next = nextNarratable(player.chapter);
    const key = `${next}:${voices.selected}`;
    if (next === null || prefetched.has(key)) return;
    prefetched.add(key);
    requestAudio(next, true);
  }

  async function pollJobs() {
    try {
      const response = await fetch(`/api/jobs?book=${encodeURIComponent(data.slug)}`);
      if (!response.ok) return;
      const { jobs } = await response.json();
      const finished = jobs.some(
        (j) => j.status === 'done' && api.jobs.some((p) => p.id === j.id && p.status !== 'done'),
      );
      api.jobs = jobs;
      if (finished) await refreshAudio();
    } catch {
      /* el servidor se detuvo: se reintenta en el siguiente ciclo */
    }
    renderVoiceStatus();
    refreshVoiceMenu();
    schedulePoll();
  }

  function schedulePoll() {
    clearTimeout(api.timer);
    if (api.jobs.some((j) => j.status === 'queued' || j.status === 'running')) {
      api.timer = setTimeout(pollJobs, 1000);
    }
  }

  /** Trae el audio nuevo del servidor y, si es del capítulo que suena, cambia a él. */
  async function refreshAudio() {
    const response = await fetch(`${bookPath}/audio`);
    if (!response.ok) return;
    const hadAudio = Boolean(data.chapters[state.chapter].audio);
    mergeAudio(await response.json());
    refreshPlayerAvailability();
    switchSource();
    renderSidebar();
    const chapter = data.chapters[state.chapter];
    if (player.pendingPlay === state.chapter && chapter.audios[voices.selected]) {
      player.pendingPlay = null;
      renderPlayer();
      ensureLoaded(true);
    } else if (!hadAudio && chapter.audio) {
      renderPlayer();
    } else if (ui.voice) {
      ui.voiceName.textContent = currentVoiceName();
    }
  }

  /** Estado de la generación del capítulo actual con la voz elegida, bajo el reproductor. */
  function renderVoiceStatus() {
    if (!ui.voiceStatus) return;
    const chapter = data.chapters[state.chapter];
    const voice = voiceById(voices.selected);
    const job = jobFor(state.chapter, voices.selected);
    const playingOther = chapter.audio && chapter.audio.voice !== voices.selected;
    const parts = [];
    if (api.error) {
      parts.push(h('span', { class: 'voice-error' }, api.error));
    } else if (job?.status === 'error') {
      parts.push(
        h('span', { class: 'voice-error' }, `No se pudo generar con ${voice?.name}: ${job.error}`),
        h(
          'button',
          { class: 'link', onclick: () => requestAudio(state.chapter, false) },
          'Reintentar',
        ),
      );
    } else if (job) {
      const percent = job.total ? Math.round((100 * job.done) / job.total) : 0;
      parts.push(
        h(
          'span',
          {},
          job.status === 'queued'
            ? `En cola: ${voice?.name ?? job.voice}…`
            : `Generando con ${voice?.name ?? job.voice} · ${percent} %`,
          playingOther ? ` · mientras, suena ${chapter.audio.label.split(' · ')[0]}` : '',
        ),
        h('progress', { max: '100', value: String(percent), 'aria-hidden': 'true' }),
      );
    }
    ui.voiceStatus.replaceChildren(...parts);
    ui.voiceStatus.hidden = parts.length === 0;
  }

  // Muestra de cada voz: se genera una vez en el servidor y queda guardada.
  const sample = new Audio();
  let sampleVoice = null;
  for (const event of ['playing', 'pause', 'ended', 'waiting', 'error']) {
    sample.addEventListener(event, () => refreshVoiceMenu());
  }

  function toggleSample(voice) {
    if (sampleVoice === voice.id && !sample.paused) {
      sample.pause();
      return;
    }
    if (!audio.paused) audio.pause();
    sampleVoice = voice.id;
    sample.src = `/api/voices/${encodeURIComponent(voice.id)}/sample`;
    sample.play().catch(() => {});
    refreshVoiceMenu();
  }

  let voiceMenu = null;

  function toggleVoiceMenu() {
    if (voiceMenu) return closeVoiceMenu();
    closeSpeedMenu();
    voiceMenu = h('div', { class: 'speed-menu voice-menu', role: 'dialog', 'aria-label': 'Voz' });
    refreshVoiceMenu();
    document.body.append(voiceMenu);
    const rect = ui.voice.getBoundingClientRect();
    voiceMenu.style.right = `${Math.max(12, document.documentElement.clientWidth - rect.right)}px`;
    voiceMenu.style.bottom = `${window.innerHeight - rect.top + 10}px`;
    ui.voice.setAttribute('aria-expanded', 'true');
    voiceMenu.querySelector('.voice-pick:not(:disabled)')?.focus();
  }

  function closeVoiceMenu() {
    voiceMenu?.remove();
    voiceMenu = null;
    ui.voice?.setAttribute('aria-expanded', 'false');
    if (!sample.paused) sample.pause();
  }

  function refreshVoiceMenu() {
    if (!voiceMenu) return;
    const chapter = data.chapters[state.chapter];
    const focused = document.activeElement?.dataset?.voice;
    const rows = data.voices.map((voice) => {
      const ready = Boolean(chapter.audios[voice.id]);
      const job = jobFor(state.chapter, voice.id);
      const canGenerate = api.available && voice.profile && chapter.narratable;
      const status = ready
        ? 'Lista'
        : job && job.status !== 'error'
          ? job.status === 'queued'
            ? 'En cola'
            : `Generando · ${job.total ? Math.round((100 * job.done) / job.total) : 0} %`
          : canGenerate
            ? `Se genera en ≈ ${eta(chapter)}`
            : 'Sin generar';
      const sampleState =
        sampleVoice === voice.id && !sample.paused ? (sample.readyState < 3 ? '…' : '❚❚') : '▶';
      return h(
        'div',
        { class: 'voice-option' },
        h(
          'button',
          {
            class: 'voice-pick',
            'data-voice': voice.id,
            'aria-pressed': String(voice.id === voices.selected),
            disabled: !ready && !canGenerate,
            onclick: () => selectVoice(voice.id),
          },
          h('strong', {}, voice.name),
          h('span', { class: `voice-state${ready ? ' ready' : ''}` }, status),
        ),
        api.available && voice.profile
          ? h(
              'button',
              {
                class: 'voice-sample',
                'data-voice': `${voice.id}:sample`,
                'aria-label': `Escuchar una muestra de ${voice.name}`,
                title: 'Escuchar una muestra',
                onclick: () => toggleSample(voice),
              },
              sampleState,
            )
          : null,
      );
    });
    const note = h(
      'p',
      { class: 'voice-note' },
      'Para generar otras voces desde aquí, abre la biblioteca con ',
      h('code', {}, 'pnpm serve'),
      '.',
    );
    voiceMenu.replaceChildren(
      h('div', { class: 'speed-head' }, h('span', {}, 'Voz del narrador')),
      h('div', { class: 'voice-list' }, rows),
      ...(api.available ? [] : [note]),
    );
    if (focused) voiceMenu.querySelector(`[data-voice="${focused}"]`)?.focus();
  }

  document.addEventListener('click', (event) => {
    if (voiceMenu && !voiceMenu.contains(event.target) && !event.target.closest('.voice-button'))
      closeVoiceMenu();
  });

  // ------------------------------------------------------------ confirmación de cambio de capítulo

  /** ¿Se está escuchando este capítulo a mitad de camino? (al inicio o al final no se pregunta). */
  function listeningMidChapter() {
    const chapter = data.chapters[state.chapter];
    if (!chapter.audio || player.chapter !== state.chapter) return false;
    const elapsed = audio.currentTime * 1000;
    return elapsed > 5000 && elapsed < chapter.audio.durationMs - 10000;
  }

  /**
   * Evita cambiar de capítulo por accidente (un toque de más en ⏮/⏭ o en las flechas).
   * La posición del capítulo actual queda guardada: aunque se confirme, al volver se retoma.
   */
  function confirmChapterChange(index) {
    if (!listeningMidChapter()) return Promise.resolve(true);
    const current = data.chapters[state.chapter];
    const target = data.chapters[index];
    return new Promise((resolve) => {
      const dialog = h(
        'dialog',
        { class: 'confirm', 'aria-labelledby': 'confirm-title' },
        h('h2', { id: 'confirm-title' }, `¿Pasar a «${target.title}»?`),
        h(
          'p',
          {},
          `Vas en ${formatTime(audio.currentTime * 1000)} de ${formatTime(current.audio.durationMs)} de «${current.title}». `,
          'Tu posición queda guardada: si vuelves, sigues desde ahí.',
        ),
        h(
          'div',
          { class: 'confirm-actions' },
          h('button', { class: 'tool', value: 'stay', autofocus: true }, 'Seguir aquí'),
          h('button', { class: 'tool primary', value: 'go' }, 'Ir al capítulo'),
        ),
      );
      const finish = (answer) => {
        dialog.close();
        dialog.remove();
        resolve(answer);
      };
      dialog.addEventListener('click', (event) => {
        const choice = event.target.closest('button')?.value;
        if (choice) finish(choice === 'go');
        else if (event.target === dialog) finish(false); // clic fuera del recuadro
      });
      dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        finish(false);
      });
      document.body.append(dialog);
      dialog.showModal();
    });
  }

  async function requestChapter(index, play) {
    if (!data.chapters[index]) return;
    if (!(await confirmChapterChange(index))) return;
    if (play) playChapter(index);
    else go(index);
  }

  /** Oración que suena en `ms`: la última cuyo inicio ya pasó (búsqueda binaria). */
  function sentenceAt(timeline, ms) {
    let low = 0;
    let high = timeline.length - 1;
    let found = -1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (timeline[mid][1] <= ms) {
        found = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return found === -1 ? -1 : timeline[found][0];
  }

  /** Inicio en el audio de la primera oración narrada a partir de `index`. */
  function timeOfSentence(chapter, index) {
    const loaded = player.chapter === data.chapters.indexOf(chapter) ? player.loaded : null;
    const entry = (loaded ?? chapter.audio).sentences.find(([i]) => i >= index);
    return entry ? entry[1] : null;
  }

  function syncToTime() {
    const chapter = data.chapters[state.chapter];
    if (!chapter.audio || player.chapter !== state.chapter) return;
    // Los tiempos son los del audio que suena, que puede ser de la voz anterior.
    const loaded = player.loaded ?? chapter.audio;
    const ms = audio.currentTime * 1000;
    if (ui.current) ui.current.textContent = formatTime(ms);
    if (ui.total) ui.total.textContent = formatTime(loaded.durationMs);
    if (ui.progress) {
      if (ui.progress.max !== String(loaded.durationMs))
        ui.progress.max = String(loaded.durationMs);
      if (document.activeElement !== ui.progress) ui.progress.value = String(Math.round(ms));
      const shown = document.activeElement === ui.progress ? Number(ui.progress.value) : ms;
      ui.progressWrap.style.setProperty(
        '--progress',
        `${Math.min(100, (100 * shown) / Math.max(1, loaded.durationMs))}%`,
      );
    }
    if (ui.play) {
      if (window.LectioIcons && ui.playIcon instanceof Element) {
        window.LectioIcons.set(ui.playIcon, audio.paused ? 'play' : 'pause');
      } else {
        ui.play.textContent = audio.paused ? '▶' : '❚❚';
      }
      ui.play.setAttribute('aria-label', audio.paused ? 'Reproducir' : 'Pausar');
      ui.play.title = audio.paused ? 'Reproducir' : 'Pausar';
    }

    const index = sentenceAt(loaded.sentences, ms);
    if (index === player.current) return;
    // Empezó otra oración: buen momento para pasar a la voz recién generada.
    if (player.pendingSwitch && index > player.current && !audio.paused) {
      player.current = index;
      highlightCurrent(chapter, index);
      return swapAudio(chapter, index, true);
    }
    player.current = index;
    highlightCurrent(chapter, index);
    if (player.follow && !audio.paused) scrollToCurrent(false);
  }

  function currentRange(chapter, index) {
    const sentence = chapter.sentences[index];
    if (!sentence || sentence[0] < 0) return null;
    const block = main.querySelectorAll('.prose [data-b]')[sentence[0]];
    return block ? rangeFor(block, sentence[1], sentence[2]) : null;
  }

  function highlightCurrent(chapter, index) {
    if (!('highlights' in CSS)) return;
    const range = index >= 0 ? currentRange(chapter, index) : null;
    if (range) CSS.highlights.set('lectio-current', new Highlight(range));
    else CSS.highlights.delete('lectio-current');
  }

  /** Mantiene la oración que suena a un tercio de la pantalla, solo si se salió de la zona visible. */
  function scrollToCurrent(force) {
    const range = currentRange(data.chapters[state.chapter], player.current);
    if (!range) return;
    const rect = range.getBoundingClientRect();
    const top =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-height')) ||
      60;
    const bottom = window.innerHeight - (playerBar.offsetHeight || 0);
    if (!force && rect.top > top + 24 && rect.bottom < bottom - 24) return;
    player.autoScrolling = true;
    window.scrollTo({
      top: window.scrollY + rect.top - window.innerHeight * 0.33,
      behavior: reducedMotion.matches ? 'auto' : 'smooth',
    });
    clearTimeout(player.scrollTimer);
    player.scrollTimer = setTimeout(() => (player.autoScrolling = false), 700);
  }

  /** Si el lector hace scroll mientras suena el audio, el seguimiento se pausa. */
  function pauseFollow() {
    if (audio.paused || player.autoScrolling || !player.follow) return;
    if (data.chapters[state.chapter].audio && player.chapter === state.chapter) {
      player.follow = false;
      followButton.hidden = false;
    }
  }

  function resumeFollow() {
    player.follow = true;
    followButton.hidden = true;
    scrollToCurrent(true);
  }

  window.addEventListener('wheel', pauseFollow, { passive: true });
  window.addEventListener('touchmove', pauseFollow, { passive: true });

  /** Botón flotante "Escuchar desde aquí" junto a la oración en la que se hizo clic. */
  function offerListenHere(event, sentenceIndex) {
    closeListenChip();
    const chapter = data.chapters[state.chapter];
    const startMs = chapter.audio ? timeOfSentence(chapter, sentenceIndex) : null;
    if (startMs === null) return;
    listenChip = h(
      'button',
      {
        class: 'listen-chip',
        onclick: (click) => {
          click.stopPropagation();
          closeListenChip();
          player.follow = true;
          followButton.hidden = true;
          seekTo(startMs);
          ensureLoaded(true);
        },
      },
      '▶ Escuchar desde aquí',
    );
    document.body.append(listenChip);
    listenChip.style.left = `${Math.max(12, event.pageX - listenChip.offsetWidth / 2)}px`;
    listenChip.style.top = `${event.pageY + 14}px`;
  }

  function closeListenChip() {
    listenChip?.remove();
    listenChip = null;
  }

  /** Oración bajo el clic: bloque + offset del cursor dentro de su texto. */
  function sentenceAtClick(event) {
    const block = event.target.closest('[data-b]');
    const caret = caretAt(event);
    if (!block || !caret || !block.contains(caret.node)) return null;
    const range = document.createRange();
    range.selectNodeContents(block);
    range.setEnd(caret.node, caret.offset);
    const offset = range.toString().length;
    const blockIndex = Number(block.dataset.b);
    const candidates = data.chapters[state.chapter].sentences
      .map((s, index) => ({ s, index }))
      .filter(({ s }) => s[0] === blockIndex);
    const hit = candidates.find(({ s }) => offset >= s[1] && offset <= s[2]) || candidates[0];
    return hit ? { block, blockIndex, ...hit } : null;
  }

  function setMediaSession(chapter) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: chapter.title,
      artist: data.book.authors.join(', '),
      album: data.book.title || '',
      artwork: data.cover ? [{ src: data.cover }] : [],
    });
    const handlers = {
      play: () => audio.play().catch(() => {}),
      pause: () => audio.pause(),
      seekbackward: () => seekBy(-15000),
      seekforward: () => seekBy(15000),
      previoustrack: () => {
        const previous = audioChapter(state.chapter, -1);
        if (previous !== null) playChapter(previous);
      },
      nexttrack: () => {
        const next = audioChapter(state.chapter, 1);
        if (next !== null) playChapter(next);
      },
    };
    for (const [action, handler] of Object.entries(handlers)) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* acción no soportada por este navegador */
      }
    }
  }

  let frame = 0;
  const tick = () => {
    syncToTime();
    if (!audio.paused) frame = requestAnimationFrame(tick);
  };
  const narrating = (value) => {
    if (window.LectioSound) window.LectioSound.setNarrating(value);
    else document.documentElement.dataset.playing = String(value);
  };
  audio.addEventListener('play', () => {
    narrating(true);
    prefetchNext();
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(tick);
    syncToTime();
  });
  audio.addEventListener('pause', () => {
    narrating(false);
    // Una voz nueva esperaba el fin de la oración: en pausa ya no hay por qué esperar.
    if (player.pendingSwitch && player.chapter !== null) {
      return swapAudio(data.chapters[player.chapter], player.current, false);
    }
    syncToTime();
  });
  audio.addEventListener('seeked', syncToTime);
  audio.addEventListener('ended', () => {
    // Si el siguiente capítulo se está generando con la voz elegida, se espera por él en
    // vez de saltarlo o de oírlo con otra voz.
    const upcoming = nextNarratable(state.chapter);
    if (
      api.available &&
      upcoming !== null &&
      !data.chapters[upcoming].audios[voices.selected] &&
      voiceById(voices.selected)?.profile
    ) {
      go(upcoming);
      player.pendingPlay = upcoming;
      requestAudio(upcoming, false);
      return;
    }
    const next = audioChapter(state.chapter, 1);
    if (next !== null) playChapter(next);
    else {
      narrating(false);
      window.LectioSound?.play('hoot');
      syncToTime();
    }
  });

  // ------------------------------------------------------------ acciones

  /** El índice lateral se ubica bajo la barra superior, cuya altura cambia en pantallas chicas. */
  function measureTopbar() {
    const bar = app.querySelector('.topbar');
    if (bar) document.documentElement.style.setProperty('--topbar-height', `${bar.offsetHeight}px`);
  }
  window.addEventListener('resize', measureTopbar);

  function render() {
    app.replaceChildren(
      h('div', { class: `layout${hasAudio ? ' has-player' : ''}` }, topbar(), sidebar, main),
      inspector,
      followButton,
      playerBar,
    );
    measureTopbar();
    renderSidebar();
    if (state.view === 'book') renderChapter();
    else renderReport();
    renderPlayer();
  }

  function go(index) {
    if (!data.chapters[index]) return;
    if (index !== state.chapter) window.LectioSound?.play('page');
    state.chapter = index;
    history.replaceState(null, '', `#c${index}`);
    closeNote();
    closeInspector();
    sidebar.classList.remove('open');
    closeListenChip();
    if (player.chapter !== index && !audio.paused) audio.pause();
    closeSpeedMenu();
    followButton.hidden = true;
    player.follow = true;
    renderSidebar();
    renderChapter();
    renderPlayer();
    window.scrollTo({ top: 0 });
    main.focus({ preventScroll: true });
  }

  function setView(view) {
    state.view = view;
    closeNote();
    closeInspector();
    render();
  }

  function setSize(delta) {
    state.size = Math.min(28, Math.max(16, state.size + delta));
    store.set('size', state.size);
    applySize();
  }

  function toggleReview() {
    state.review = !state.review;
    store.set('review', state.review);
    closeInspector();
    render();
  }

  function toggleAux() {
    state.hideAux = !state.hideAux;
    store.set('hideAux', state.hideAux);
    renderSidebar();
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeSpeedMenu();
      closeVoiceMenu();
      closeListenChip();
      closeNote();
      closeInspector();
      sidebar.classList.remove('open');
    }
    if (state.view !== 'book' || event.altKey || event.ctrlKey || event.metaKey) return;
    if (document.querySelector('dialog[open]') || speedMenu || voiceMenu) return;
    const typing = event.target.closest('input, textarea, button, select');
    if (event.key === ' ' && !typing && data.chapters[state.chapter].audio) {
      event.preventDefault();
      togglePlay();
      return;
    }
    if (['PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key))
      pauseFollow();
    if (event.key === 'ArrowRight') requestChapter(state.chapter + 1, false);
    if (event.key === 'ArrowLeft') requestChapter(state.chapter - 1, false);
  });

  applySize();
  render();
  detectApi();
})();
