// Lectio · sistema de temas (docs/lectio-temas.md §4). Compartido por el preview de un
// libro y la biblioteca. Dos ejes independientes, aplicados como atributos en <html>:
//   data-world  → el mundo: 'clasico' | 'scriptorium' (bosque y solarpunk, próximamente)
//   data-mode   → 'day' | 'night' (por defecto, según el sistema)
// Además guarda las preferencias de sonido, música y compañero.
(() => {
  'use strict';

  const WORLDS = [
    { id: 'scriptorium', name: 'Scriptorium', tagline: 'Monasterio de copistas', ready: true },
    { id: 'bosque', name: 'Bosque élfico', tagline: 'Luminoso y noble', ready: false },
    { id: 'solarpunk', name: 'Solarpunk', tagline: 'Cielo, sol y jardines', ready: false },
    { id: 'clasico', name: 'Clásico', tagline: 'Sobrio, sin ambientación', ready: true },
  ];

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

  // Migración: la versión anterior guardaba 'theme' = system | light | dark.
  const legacyMode = { light: 'day', dark: 'night', system: 'system' }[store.get('theme', '')];

  const state = {
    /** null = todavía no eligió mundo (la bienvenida se lo pregunta). */
    world: store.get('world', null),
    mode: store.get('mode', legacyMode ?? 'system'),
    sfx: store.get('sfx', true),
    music: store.get('music', false),
    volume: store.get('volume', 0.5),
    companion: store.get('companion', true),
  };

  const listeners = new Set();
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const isNight = () => state.mode === 'night' || (state.mode === 'system' && systemDark.matches);
  const activeWorld = () =>
    (WORLDS.find((w) => w.id === state.world && w.ready) ?? WORLDS.find((w) => w.id === 'clasico'))
      .id;

  function apply() {
    const root = document.documentElement;
    root.dataset.world = activeWorld();
    root.dataset.mode = isNight() ? 'night' : 'day';
    root.dataset.companion = state.companion ? 'on' : 'off';
    root.dataset.motion = reducedMotion.matches ? 'reduced' : 'full';
    for (const listener of listeners) listener(snapshot());
  }

  function snapshot() {
    return {
      ...state,
      world: activeWorld(),
      chosen: state.world !== null,
      night: isNight(),
      reducedMotion: reducedMotion.matches,
    };
  }

  function set(key, value) {
    state[key] = value;
    store.set(key, value);
    apply();
  }

  systemDark.addEventListener('change', apply);
  reducedMotion.addEventListener('change', apply);
  apply();

  // ------------------------------------------------------------ panel de ajustes

  let panel = null;

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

  /** Botón día/noche para la barra superior. */
  function modeButton() {
    const button = h('button', {
      class: 'tool mode-toggle',
      onclick: () => {
        window.LectioSound?.play('toggle');
        set('mode', isNight() ? 'day' : 'night');
      },
    });
    const refresh = () => {
      const night = isNight();
      button.textContent = night ? '☾' : '☀';
      button.setAttribute('aria-label', night ? 'Cambiar a día' : 'Cambiar a noche');
      button.title = night ? 'Noche · cambiar a día' : 'Día · cambiar a noche';
    };
    listeners.add(refresh);
    refresh();
    return button;
  }

  /** Botón que abre el panel de ajustes (mundo, sonido, música, compañero). */
  function settingsButton() {
    return h(
      'button',
      {
        class: 'tool settings-toggle',
        'aria-label': 'Ajustes de apariencia y sonido',
        title: 'Mundo y sonido',
        'aria-haspopup': 'dialog',
        onclick: toggleSettings,
      },
      '✦',
    );
  }

  function toggleSettings(event) {
    event?.stopPropagation();
    if (panel) return closeSettings();
    window.LectioSound?.play('open');
    const option = (key, label, hint) =>
      h(
        'label',
        { class: 'setting-row' },
        h('input', {
          type: 'checkbox',
          checked: state[key] || null,
          onchange: (e) => set(key, e.target.checked),
        }),
        h('span', {}, h('strong', {}, label), hint ? h('small', {}, hint) : null),
      );
    panel = h(
      'div',
      { class: 'settings-panel', role: 'dialog', 'aria-label': 'Mundo y sonido' },
      h('h2', {}, 'Mundo'),
      h(
        'div',
        { class: 'world-options' },
        WORLDS.map((world) =>
          h(
            'button',
            {
              class: 'world-option',
              'data-world-option': world.id,
              'aria-pressed': String(activeWorld() === world.id),
              disabled: !world.ready,
              onclick: () => {
                window.LectioSound?.play('select');
                set('world', world.id);
                for (const b of panel.querySelectorAll('[data-world-option]'))
                  b.setAttribute('aria-pressed', String(b.dataset.worldOption === world.id));
              },
            },
            h('strong', {}, world.name),
            h('small', {}, world.ready ? world.tagline : 'Próximamente'),
          ),
        ),
      ),
      h('h2', {}, 'Sonido'),
      option('sfx', 'Efectos de sonido', 'Al seleccionar y abrir'),
      option('music', 'Música ambiente', 'Se pausa sola mientras suena el libro'),
      h(
        'label',
        { class: 'setting-row volume' },
        h('span', {}, h('strong', {}, 'Volumen')),
        h('input', {
          type: 'range',
          min: '0',
          max: '1',
          step: '0.05',
          value: String(state.volume),
          'aria-label': 'Volumen de efectos y música',
          oninput: (e) => set('volume', Number(e.target.value)),
        }),
      ),
      h('h2', {}, 'Compañía'),
      option('companion', 'Mostrar compañero', 'El búho del scriptorium'),
    );
    document.body.append(panel);
    const anchor = document.querySelector('.settings-toggle');
    const rect = anchor?.getBoundingClientRect();
    if (rect) {
      panel.style.top = `${rect.bottom + 8}px`;
      panel.style.right = `${Math.max(12, document.documentElement.clientWidth - rect.right)}px`;
    }
    panel.querySelector('button:not([disabled])')?.focus();
  }

  function closeSettings() {
    panel?.remove();
    panel = null;
  }

  document.addEventListener('click', (event) => {
    if (panel && !panel.contains(event.target)) closeSettings();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSettings();
  });

  window.LectioTheme = {
    WORLDS,
    get: snapshot,
    set,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    modeButton,
    settingsButton,
    closeSettings,
    h,
  };
})();
