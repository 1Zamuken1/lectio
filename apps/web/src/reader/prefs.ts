import { create } from 'zustand';

export type ReadFont = 'literata' | 'atkinson';

export const MIN_SIZE = 16;
export const MAX_SIZE = 28;

interface ReaderPrefs {
  /** Tamaño del texto del libro, en px. */
  size: number;
  /** Literata (serif) o Atkinson Hyperlegible (pensada para baja visión). */
  font: ReadFont;
  /** Oculta del índice las secciones no narrativas (portada, dedicatoria, notas…). */
  hideAux: boolean;
  /** Tacha lo que no se narra (números de página, DOIs…). */
  review: boolean;
  set<K extends 'size' | 'font' | 'hideAux' | 'review'>(key: K, value: ReaderPrefs[K]): void;
}

// Mismas claves que el preview de la CLI (en otro origen, así que no se mezclan).
function load<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(`lectio:${key}`);
    return value === null ? fallback : (JSON.parse(value) as T);
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(`lectio:${key}`, JSON.stringify(value));
  } catch {
    /* navegación privada: se ignora */
  }
}

const clampSize = (value: number) =>
  Number.isFinite(value) ? Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(value))) : 20;

export const useReaderPrefs = create<ReaderPrefs>((set) => ({
  size: clampSize(load('size', 20)),
  font: load<ReadFont>('readFont', 'literata') === 'atkinson' ? 'atkinson' : 'literata',
  // Por defecto el índice muestra solo lo narrativo (arquitectura §2.2); el resto, a pedido.
  hideAux: load('hideAux', true),
  review: load('review', false),
  set: (key, value) => {
    const next = key === 'size' ? clampSize(value as number) : value;
    save(key === 'font' ? 'readFont' : key, next);
    set({ [key]: next });
  },
}));

/** Lleva el tamaño y la fuente al documento (variables de CSS y data-read-font). */
export function applyReaderPrefs(prefs: Pick<ReaderPrefs, 'size' | 'font'>): void {
  const root = document.documentElement;
  root.style.setProperty('--text-size', `${prefs.size}px`);
  root.dataset.readFont = prefs.font;
}
