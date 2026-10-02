import { useSyncExternalStore } from 'react';
import { WORLDS, hasScenes, selectableWorlds, type WorldId } from './worlds';

/**
 * Sistema de temas (docs/lectio-temas.md §4). Dos ejes independientes, como atributos en
 * <html>: data-world (el mundo) y data-mode (día/noche; por defecto, según el sistema).
 * Además guarda las preferencias de sonido, música y compañero. Es la versión de la app
 * de apps/cli/assets/theme/theme.js, con la misma API para los módulos portados.
 */

export {
  WORLDS,
  hasCrew,
  hasHoloBookcase,
  hasScenes,
  roomTitle,
  type World,
  type WorldId,
} from './worlds';
export type Mode = 'system' | 'day' | 'night';

/** En desarrollo se eligen también los mundos a medio hacer (para verlos mientras tanto). */
const SELECTABLE = new Set(selectableWorlds(import.meta.env.DEV));

/** ¿Se puede elegir este mundo? (terminado o, en desarrollo, cualquiera) */
export function isSelectable(world: WorldId): boolean {
  return SELECTABLE.has(world);
}

interface Preferences {
  /** null = todavía no eligió mundo (la pantalla de título se lo pregunta). */
  world: WorldId | null;
  mode: Mode;
  sfx: boolean;
  music: boolean;
  volume: number;
  companion: boolean;
}

export interface ThemeSnapshot extends Omit<Preferences, 'world'> {
  world: WorldId;
  chosen: boolean;
  night: boolean;
  reducedMotion: boolean;
}

// Mismas claves que el preview de la CLI: quien lo usó allí encuentra sus preferencias.
const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const value = localStorage.getItem(`lectio:${key}`);
      return value === null ? fallback : (JSON.parse(value) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(`lectio:${key}`, JSON.stringify(value));
    } catch {
      /* navegación privada: se ignora */
    }
  },
};

const state: Preferences = {
  world: store.get<WorldId | null>('world', null),
  mode: store.get<Mode>('mode', 'system'),
  sfx: store.get('sfx', true),
  music: store.get('music', false),
  volume: store.get('volume', 0.5),
  companion: store.get('companion', true),
};

const listeners = new Set<(snapshot: ThemeSnapshot) => void>();
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const isNight = () => state.mode === 'night' || (state.mode === 'system' && systemDark.matches);
const activeWorld = (): WorldId =>
  state.world !== null && SELECTABLE.has(state.world) ? state.world : 'clasico';

let current = compute();

function compute(): ThemeSnapshot {
  return {
    ...state,
    world: activeWorld(),
    chosen: state.world !== null,
    night: isNight(),
    reducedMotion: reducedMotion.matches,
  };
}

function apply(): void {
  current = compute();
  const root = document.documentElement;
  root.dataset.world = current.world;
  root.dataset.scenes = hasScenes(current.world) ? 'on' : 'off';
  root.dataset.mode = current.night ? 'night' : 'day';
  root.dataset.companion = state.companion ? 'on' : 'off';
  root.dataset.motion = current.reducedMotion ? 'reduced' : 'full';
  for (const listener of listeners) listener(current);
}

systemDark.addEventListener('change', apply);
reducedMotion.addEventListener('change', apply);
apply();

export const Theme = {
  WORLDS,
  get: (): ThemeSnapshot => current,
  set<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
    state[key] = value;
    store.set(key, value);
    apply();
  },
  onChange(listener: (snapshot: ThemeSnapshot) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/** El tema en un componente: se vuelve a renderizar al cambiar el mundo, el modo o el sonido. */
export function useTheme(): ThemeSnapshot {
  return useSyncExternalStore(Theme.onChange, Theme.get);
}
