/**
 * El registro de mundos (docs/lectio-temas.md §7.2): qué mundos hay y qué tiene cada uno.
 * Sin dependencias del navegador: lo usan theme.ts y el build (vite.config.ts, para el
 * script de index.html que aplica el tema antes de pintar).
 */

export type WorldId = 'scriptorium' | 'bosque' | 'solarpunk' | 'clasico';

export interface World {
  id: WorldId;
  name: string;
  tagline: string;
  /** Terminado: se puede elegir. En desarrollo también se eligen los que no lo están. */
  ready: boolean;
  /**
   * Tiene escenas y animaciones de pixel art: la portada, las salas, el compañero, el
   * taller, la cuadrilla, el libro que falla y el arcón. Sin ellas, esas piezas se ven
   * como en el Clásico (pero con la paleta, el HUD y los íconos del mundo).
   */
  scenes: boolean;
  /** El compañero, para el interruptor de los ajustes (solo los mundos con escenas). */
  companion?: string;
}

export const WORLDS: World[] = [
  {
    id: 'scriptorium',
    name: 'Scriptorium',
    tagline: 'Monasterio de copistas',
    ready: true,
    scenes: true,
    companion: 'Sabio, el búho del scriptorium',
  },
  { id: 'bosque', name: 'Bosque élfico', tagline: 'Luminoso y noble', ready: false, scenes: false },
  {
    id: 'solarpunk',
    name: 'Solarpunk',
    tagline: 'Cielo, sol y jardines',
    ready: false,
    scenes: false,
  },
  {
    id: 'clasico',
    name: 'Clásico',
    tagline: 'Sobrio, sin ambientación',
    ready: true,
    scenes: false,
  },
];

/** Los mundos que se pueden elegir: los terminados y, en desarrollo, todos. */
export function selectableWorlds(dev: boolean): WorldId[] {
  return WORLDS.filter((w) => w.ready || dev).map((w) => w.id);
}

/** ¿El mundo tiene escenas y animaciones? (en vez de preguntar por un mundo en concreto) */
export function hasScenes(world: string | undefined): boolean {
  return WORLDS.some((w) => w.id === world && w.scenes);
}
