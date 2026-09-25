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

  function spine(book) {
    const seed = hash(book.slug);
    const color = SPINE_COLORS[seed % SPINE_COLORS.length];
    // Grosor según la extensión del libro; alto con algo de azar para que la fila respire.
    const width = Math.round(Math.min(78, 36 + Math.sqrt(book.estimatedMinutes) * 1.6));
    const height = 150 + (seed % 5) * 8;
    return h(
      'button',
      {
        class: book.narratedChapters ? 'spine has-audio' : 'spine',
        style: `--spine: var(--px-${color}); --spine-w: ${width}px; --spine-h: ${height}px`,
        'aria-pressed': String(state.selected === book.slug),
        'aria-label': `${book.title}${book.author ? `, de ${book.author}` : ''}`,
        onclick: () => {
          sound('select');
          state.selected = state.selected === book.slug ? null : book.slug;
          renderLibrary();
          document.querySelector('.book-detail h2')?.focus({ preventScroll: false });
        },
      },
      h('span', { class: 'spine-title', 'aria-hidden': 'true' }, book.title),
      book.narratedChapters ? h('span', { class: 'spine-mark', 'aria-hidden': 'true' }, '♪') : null,
    );
  }

  function shelf() {
    const owl = h('div', { class: 'shelf-owl companion-slot', 'aria-hidden': 'true' });
    owl.innerHTML = Pixel.owlBadge();
    return h(
      'section',
      { class: 'bookcase', 'aria-label': 'Estantería' },
      owl,
      data.books.length
        ? h(
            'div',
            { class: 'shelf' },
            data.books.map((book) => h('div', { class: 'slot' }, spine(book))),
          )
        : h('div', { class: 'shelf empty' }, h('p', {}, 'La estantería está vacía.')),
    );
  }

  function detail() {
    const book = data.books.find((b) => b.slug === state.selected);
    if (!book) {
      return h(
        'aside',
        { class: 'book-detail placeholder' },
        h(
          'h2',
          { tabindex: '-1' },
          data.books.length ? 'Elige un libro' : 'Agrega tu primer libro',
        ),
        h(
          'p',
          {},
          data.books.length
            ? 'Toca un lomo de la estantería para ver su ficha.'
            : 'Genera el preview de un EPUB y vuelve a crear la biblioteca:',
        ),
        data.books.length ? null : h('code', {}, 'pnpm lectio preview libro.epub'),
      );
    }
    const stats = [
      ['Capítulos', number.format(book.chapters)],
      ['Duración', `≈ ${duration(book.estimatedMinutes)}`],
      ['Con audio', book.narratedChapters ? `${book.narratedChapters} capítulo(s)` : 'Aún no'],
    ];
    return h(
      'aside',
      { class: 'book-detail', 'aria-live': 'polite' },
      book.cover ? h('img', { class: 'cover', src: book.cover, alt: '' }) : null,
      h('h2', { tabindex: '-1' }, book.title),
      h('p', { class: 'author' }, book.author || 'Autor desconocido'),
      h(
        'dl',
        { class: 'book-stats' },
        stats.map(([label, value]) => h('div', {}, h('dt', {}, label), h('dd', {}, value))),
      ),
      h(
        'a',
        {
          class: 'open-book',
          href: book.preview,
          onclick: (event) => {
            // Deja sonar el efecto antes de salir de la página.
            if (event.ctrlKey || event.metaKey || event.shiftKey) return;
            event.preventDefault();
            sound('open');
            setTimeout(() => location.assign(book.preview), 220);
          },
        },
        book.narratedChapters ? 'Leer y escuchar' : 'Leer',
      ),
    );
  }

  function renderLibrary() {
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
            '⌂',
            h('span', { class: 'label' }, 'Portada'),
          ),
          Theme.modeButton(),
          Theme.settingsButton(),
        ),
      ),
      h(
        'main',
        { class: 'library' },
        h('div', { class: 'library-scene' }, scene({ desk: false })),
        h('div', { class: 'library-body' }, shelf(), detail()),
      ),
    );
  }

  function render() {
    Theme.closeSettings?.();
    document.body.dataset.screen = state.screen;
    if (state.screen === 'title') renderTitle();
    else renderLibrary();
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.screen === 'library' && state.selected) {
      state.selected = null;
      renderLibrary();
    }
  });

  render();
})();
