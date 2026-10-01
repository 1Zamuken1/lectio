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
   * Tiene escenas de pixel art: la portada, las dos salas y la puerta entre ellas. Sin
   * ellas, se ven como en el Clásico (con la paleta, el HUD y los íconos del mundo).
   */
  scenes: boolean;
  /**
   * Tiene su gente animada: el taller que graba la voz, la cuadrilla que trae un libro, el
   * libro que no se pudo preparar y las descargas en escena. Sin ella, todo eso es directo.
   */
  crew: boolean;
  /** El compañero, para el interruptor de los ajustes (sin compañero, no hay interruptor). */
  companion?: string;
  /** El título de cada sala (lo lee el lector de pantalla; en el Clásico se ve). */
  rooms: { monastery: string; study: string };
}

const CLASSIC_ROOMS = { monastery: 'La biblioteca del monasterio', study: 'Tu estudio' };

export const WORLDS: World[] = [
  {
    id: 'scriptorium',
    name: 'Scriptorium',
    tagline: 'Monasterio de copistas',
    ready: true,
    scenes: true,
    crew: true,
    companion: 'Sabio, el búho del scriptorium',
    rooms: CLASSIC_ROOMS,
  },
  {
    id: 'bosque',
    name: 'Bosque élfico',
    tagline: 'Luminoso y noble',
    ready: false,
    scenes: true,
    crew: false,
    rooms: { monastery: 'El salón élfico', study: 'Tu refugio' },
  },
  {
    id: 'solarpunk',
    name: 'Solarpunk',
    tagline: 'Cielo, sol y jardines',
    ready: false,
    scenes: false,
    crew: false,
    rooms: CLASSIC_ROOMS,
  },
  {
    id: 'clasico',
    name: 'Clásico',
    tagline: 'Sobrio, sin ambientación',
    ready: true,
    scenes: false,
    crew: false,
    rooms: CLASSIC_ROOMS,
  },
];

const byId = (world: string | undefined) => WORLDS.find((w) => w.id === world);

/** Los mundos que se pueden elegir: los terminados y, en desarrollo, todos. */
export function selectableWorlds(dev: boolean): WorldId[] {
  return WORLDS.filter((w) => w.ready || dev).map((w) => w.id);
}

/** Los mundos con escenas (para el script de index.html, que marca `data-scenes`). */
export const SCENE_WORLDS: WorldId[] = WORLDS.filter((w) => w.scenes).map((w) => w.id);

/** ¿El mundo tiene escenas? (en vez de preguntar por un mundo en concreto) */
export function hasScenes(world: string | undefined): boolean {
  return byId(world)?.scenes ?? false;
}

/** ¿El mundo tiene su gente animada (taller, cuadrilla, fuego, arcón)? */
export function hasCrew(world: string | undefined): boolean {
  return byId(world)?.crew ?? false;
}

/** El título de una sala en el mundo. */
export function roomTitle(world: string | undefined, room: 'monastery' | 'study'): string {
  return (byId(world)?.rooms ?? CLASSIC_ROOMS)[room];
}
