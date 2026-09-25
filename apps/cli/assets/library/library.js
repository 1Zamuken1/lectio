// Lectio · biblioteca (docs/lectio-temas.md §2). Dos pantallas:
//   - Portada: pantalla de título con la escena del mundo, el logo y la elección de mundo,
//     como elegir partida.
//   - Biblioteca: el escenario con la estantería; cada libro es un lomo pixel y al elegirlo
//     se abre su ficha con el enlace al preview.
// Los datos los genera `lectio library` a partir de los book.json de cada preview.
(() => {
  'use strict';

  const data = JSON.parse(document.getElementById('lectio-data').textContent);
  const Theme = window.LectioTheme;
  const Pixel = window.LectioPixel;
  const sound = (name) => window.LectioSound?.play(name);
  const { h } = Theme;
  const app = document.getElementById('app');

  const SPINE_COLORS = ['red', 'blue', 'green', 'red-d', 'blue-d', 'gold-d'];
  const number = new Intl.NumberFormat('es');

  const session = {
    get: (key) => {
      try {
        return sessionStorage.getItem(`lectio:${key}`);
      } catch {
        return null;
      }
    },
    set: (key, value) => {
      try {
        sessionStorage.setItem(`lectio:${key}`, value);
      } catch {
        /* navegación privada: se ignora */
      }
    },
  };

  // Primera visita: la portada muestra el Scriptorium; se cambia desde los mundos.
  if (!Theme.get().chosen) Theme.set('world', 'scriptorium');

  const state = {
    screen: location.hash === '#portada' || !session.get('entered') ? 'title' : 'library',
    selected: null,
  };

  function hash(text) {
    let value = 2166136261;
    for (const char of text) value = Math.imul(value ^ char.codePointAt(0), 16777619);
    return value >>> 0;
  }

  function duration(minutes) {
    if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`;
    const hours = Math.floor(minutes / 60);
    const rest = Math.round(minutes % 60);
    return rest ? `${hours} h ${rest} min` : `${hours} h`;
  }

  function scene(options) {
    const holder = h('div', { class: 'scene', 'aria-hidden': 'true' });
    holder.innerHTML = Pixel.scriptoriumScene(options);
    return holder;
  }

  // ------------------------------------------------------------ portada

  function worldPicker() {
    const current = Theme.get().world;
    return h(
      'div',
      { class: 'world-slots', role: 'group', 'aria-label': 'Mundo' },
      Theme.WORLDS.map((world, index) =>
        h(
          'button',
          {
            class: 'world-slot',
            'aria-pressed': String(current === world.id),
            disabled: !world.ready,
            onclick: () => {
              sound('select');
              Theme.set('world', world.id);
              render();
            },
          },
          h('span', { class: 'slot-number', 'aria-hidden': 'true' }, `0${index + 1}`),
          h('strong', {}, world.name),
          h('small', {}, world.ready ? world.tagline : 'Próximamente'),
        ),
      ),
    );
  }

  function renderTitle() {
    const count = data.books.length;
    const start = h(
      'button',
      {
        class: 'press-start',
        onclick: () => {
          sound('start');
          session.set('entered', '1');
          state.screen = 'library';
          if (location.hash) history.replaceState(null, '', location.pathname);
          render();
        },
      },
      'Pulsa para comenzar',
    );
    app.replaceChildren(
      h(
        'main',
        { class: 'title-screen' },
        scene({ desk: true }),
        h(
          'div',
          { class: 'title-banner' },
          h('h1', { class: 'logo' }, 'Lectio'),
          h('p', { class: 'tagline' }, 'Tu biblioteca, leída en voz alta'),
        ),
        h(
          'div',
          { class: 'title-card' },
          h('h2', { class: 'slots-title' }, 'Elige tu mundo'),
          worldPicker(),
          start,
          h(
            'p',
            { class: 'title-footer' },
            count === 1
              ? '1 libro en la estantería'
              : `${number.format(count)} libros en la estantería`,
          ),
        ),
        h('div', { class: 'title-tools' }, Theme.modeButton(), Theme.settingsButton()),
      ),
    );
    start.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------ biblioteca

  //
  // Un escenario: la escena ocupa toda la pantalla y la estantería está dentro de ella.
  // La ficha del libro flota sobre la escena (en el celular, sube desde abajo), así que
  // abrirla no mueve nada. La estructura se arma una vez; elegir un libro solo actualiza
  // los lomos, la ficha y lo que dice Sabio (las animaciones de entrada no se repiten).

  const lib = {};

  function spine(book, index) {
    const seed = hash(book.slug);
    const color = SPINE_COLORS[seed % SPINE_COLORS.length];
    // Grosor según la extensión del libro; alto con algo de azar para que la fila respire.
    const width = Math.round(Math.min(78, 36 + Math.sqrt(book.estimatedMinutes) * 1.6));
    const height = 150 + (seed % 5) * 8;
    return h(
      'button',
      {
        class: book.narratedChapters ? 'spine has-audio' : 'spine',
        style: `--spine: var(--px-${color}); --spine-w: ${width}px; --spine-h: ${height}px; --i: ${index}`,
        'data-slug': book.slug,
        'aria-pressed': 'false',
        'aria-label': `${book.title}${book.author ? `, de ${book.author}` : ''}`,
        onclick: () => selectBook(state.selected === book.slug ? null : book.slug),
      },
      h('span', { class: 'spine-title', 'aria-hidden': 'true' }, book.title),
      book.narratedChapters ? h('span', { class: 'spine-mark', 'aria-hidden': 'true' }, '♪') : null,
    );
  }

  function bookcase() {
    const owl = h('div', { class: 'shelf-owl companion-slot', 'aria-hidden': 'true' });
    owl.innerHTML = Pixel.owlBadge();
    lib.owl = owl;
    lib.hint = h('p', { class: 'shelf-hint', 'aria-live': 'polite' });
    return h(
      'section',
      { class: 'bookcase', 'aria-label': 'Estantería' },
      owl,
      lib.hint,
      data.books.length
        ? h(
            'div',
            { class: 'shelf' },
            data.books.map((book, i) => h('div', { class: 'slot' }, spine(book, i))),
          )
        : h(
            'div',
            { class: 'shelf empty' },
            h('p', {}, 'La estantería está vacía. Para agregar un libro:'),
            h('code', {}, 'pnpm lectio preview libro.epub'),
          ),
    );
  }

  function detailCard(book) {
    const stats = [
      ['Capítulos', number.format(book.chapters)],
      ['Duración', `≈ ${duration(book.estimatedMinutes)}`],
      ['Con audio', book.narratedChapters ? `${book.narratedChapters} capítulo(s)` : 'Aún no'],
    ];
    const open = h(
      'a',
      {
        class: 'open-book',
        href: book.preview,
        onclick: (event) => {
          if (event.ctrlKey || event.metaKey || event.shiftKey) return;
          event.preventDefault();
          openBook(book, open);
        },
      },
      book.narratedChapters ? 'Leer y escuchar' : 'Leer',
    );
    return h(
      'aside',
      { class: 'book-detail', 'aria-label': `Ficha de ${book.title}` },
      h(
        'button',
        {
          class: 'detail-close',
          'aria-label': 'Cerrar la ficha',
          title: 'Cerrar',
          onclick: () => selectBook(null),
        },
        window.LectioIcons ? window.LectioIcons.icon('close') : '×',
      ),
      book.cover
        ? h('img', { class: 'cover', src: book.cover, alt: '' })
        : h('div', { class: 'cover cover-blank', 'aria-hidden': 'true' }, book.title),
      h(
        'div',
        { class: 'detail-body' },
        h('h2', { tabindex: '-1' }, book.title),
        h('p', { class: 'author' }, book.author || 'Autor desconocido'),
        h(
          'dl',
          { class: 'book-stats' },
          stats.map(([label, value]) => h('div', {}, h('dt', {}, label), h('dd', {}, value))),
        ),
        open,
      ),
    );
  }

  function selectBook(slug) {
    const changed = slug !== state.selected;
    state.selected = slug;
    const book = data.books.find((b) => b.slug === slug);
    for (const button of lib.stage.querySelectorAll('.spine')) {
      button.setAttribute('aria-pressed', String(button.dataset.slug === slug));
    }
    lib.stage.classList.toggle('has-selection', Boolean(book));
    lib.detail.replaceChildren(book ? detailCard(book) : '');
    lib.detail.hidden = !book;
    lib.hint.textContent = book
      ? `«${book.title}». ${book.narratedChapters ? 'Ya tiene voz: ¿lo escuchamos?' : 'Buena elección.'}`
      : data.books.length
        ? 'Elige un libro de la estantería.'
        : 'Aquí no hay libros todavía.';
    // Sabio reacciona: la animación se reinicia quitando y poniendo la clase.
    lib.owl.classList.remove('hop');
    lib.hint.classList.remove('pop');
    void lib.owl.offsetWidth;
    if (changed) {
      lib.owl.classList.add('hop');
      lib.hint.classList.add('pop');
      sound(book ? 'select' : 'toggle');
    }
    if (book) lib.detail.querySelector('h2')?.focus({ preventScroll: true });
  }

  /** Transición al libro: un pergamino se abre desde el botón y la página cambia. */
  function openBook(book, from) {
    sound('open');
    const rect = from.getBoundingClientRect();
    const veil = h('div', {
      class: 'book-transition',
      style: `--x: ${rect.left + rect.width / 2}px; --y: ${rect.top + rect.height / 2}px`,
      'aria-hidden': 'true',
    });
    document.body.append(veil);
    const reduced = document.documentElement.dataset.motion !== 'full';
    setTimeout(() => location.assign(book.preview), reduced ? 120 : 560);
  }

  function renderLibrary() {
    lib.detail = h('div', { class: 'detail-slot', hidden: true });
    const scenery = scene({ desk: false });
    // Arriba siempre visible: el ventanal y las estanterías; la estantería tapa el suelo.
    scenery.querySelector('svg')?.setAttribute('preserveAspectRatio', 'xMidYMin slice');
    lib.stage = h(
      'main',
      { class: 'library' },
      h('div', { class: 'library-scene' }, scenery),
      h('div', { class: 'library-floor' }, bookcase()),
      lib.detail,
    );
    app.replaceChildren(
      h(
        'header',
        { class: 'topbar' },
        h('div', { class: 'brand' }, 'Lectio', h('small', {}, 'biblioteca')),
        h(
          'div',
          { class: 'tools' },
          h(
            'button',
            {
              class: 'tool',
              title: 'Volver a la pantalla de título',
              onclick: () => {
                sound('toggle');
                state.screen = 'title';
                render();
              },
            },
            window.LectioIcons ? window.LectioIcons.icon('home') : '⌂',
            h('span', { class: 'label' }, 'Portada'),
          ),
          Theme.modeButton(),
          Theme.settingsButton(),
        ),
      ),
      lib.stage,
    );
    const selected = state.selected;
    state.selected = null;
    selectBook(selected);
  }

  function render() {
    Theme.closeSettings?.();
    document.body.dataset.screen = state.screen;
    if (state.screen === 'title') renderTitle();
    else renderLibrary();
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.screen === 'library' && state.selected) selectBook(null);
  });

  render();
})();
