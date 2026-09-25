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
    theme: store.get('theme', 'system'),
  };

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

  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    const dark = state.theme === 'dark' || (state.theme === 'system' && systemDark.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }
  systemDark.addEventListener('change', applyTheme);

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

  const themeLabels = { system: 'Tema: sistema', light: 'Tema: claro', dark: 'Tema: oscuro' };
  const themeIcons = { system: '◐', light: '☀', dark: '☾' };

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
        '☰',
      ),
      h('div', { class: 'brand' }, 'Lectio', h('small', {}, 'preview')),
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
        h(
          'button',
          {
            class: 'tool',
            'aria-label': themeLabels[state.theme],
            title: themeLabels[state.theme],
            onclick: cycleTheme,
          },
          themeIcons[state.theme],
        ),
        h(
          'button',
          {
            class: 'tool',
            'aria-pressed': String(state.review),
            title: 'Marca qué se narra, qué se omite y qué cambia',
            onclick: toggleReview,
          },
          '◉',
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
              : h('span', { class: 'toc-meta' }, duration(minutes(chapter.characterCount))),
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
      : `≈ ${duration(minutes(chapter.characterCount))} de audio · ${number(chapter.sentences.length)} oraciones`;

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
    applyHighlights(prose, chapter);
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
    if (state.review) inspectAt(event);
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

  // ------------------------------------------------------------ acciones

  /** El índice lateral se ubica bajo la barra superior, cuya altura cambia en pantallas chicas. */
  function measureTopbar() {
    const bar = app.querySelector('.topbar');
    if (bar) document.documentElement.style.setProperty('--topbar-height', `${bar.offsetHeight}px`);
  }
  window.addEventListener('resize', measureTopbar);

  function render() {
    app.replaceChildren(h('div', { class: 'layout' }, topbar(), sidebar, main), inspector);
    measureTopbar();
    renderSidebar();
    if (state.view === 'book') renderChapter();
    else renderReport();
  }

  function go(index) {
    if (!data.chapters[index]) return;
    state.chapter = index;
    history.replaceState(null, '', `#c${index}`);
    closeNote();
    closeInspector();
    sidebar.classList.remove('open');
    renderSidebar();
    renderChapter();
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

  function cycleTheme() {
    const order = ['system', 'light', 'dark'];
    state.theme = order[(order.indexOf(state.theme) + 1) % order.length];
    store.set('theme', state.theme);
    applyTheme();
    render();
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
      closeNote();
      closeInspector();
      sidebar.classList.remove('open');
    }
    if (state.view !== 'book' || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowRight') go(state.chapter + 1);
    if (event.key === 'ArrowLeft') go(state.chapter - 1);
  });

  applyTheme();
  applySize();
  render();
})();
