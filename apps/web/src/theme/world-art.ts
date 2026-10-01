import { Bosque } from './bosque';
import { SCENES as BOSQUE_SCENES, type RasterScene } from './bosque-scenes';
import { Pixel } from './pixel';
import type { WorldId } from './worlds';

/**
 * El pixel art de cada mundo, pieza por pieza (docs/lectio-temas.md §7.1): cada mundo
 * dibuja su versión de la misma pieza. Un mundo sin esa pieza (el Clásico) da ''.
 */
export type ArtPiece =
  | 'pageCorner'
  | 'progressThumb'
  | 'title'
  | 'monastery'
  | 'study'
  | 'lecternStand'
  /** El compañero en las salas y en el índice del lector. */
  | 'companion'
  /** El compañero suelto, fuera de las escenas (junto al título, asomado a la página). */
  | 'companionFree';

const NONE = () => '';

const ART: Partial<Record<WorldId, Record<ArtPiece, () => string>>> = {
  scriptorium: {
    pageCorner: Pixel.fleuron,
    progressThumb: Pixel.quill,
    title: () => Pixel.scriptoriumScene({ desk: true }),
    monastery: Pixel.monasteryScene,
    study: Pixel.studyScene,
    lecternStand: Pixel.lecternStand,
    companion: Pixel.owlBadge,
    // Sabio vive dentro de las escenas (la portada lo dibuja en el escritorio).
    companionFree: NONE,
  },
  // Las escenas del Bosque son de lienzo (rasterScene); la página no lleva esquineros.
  bosque: {
    pageCorner: NONE,
    progressThumb: Bosque.firefly,
    title: NONE,
    monastery: NONE,
    study: NONE,
    lecternStand: Bosque.lecternStand,
    companion: Bosque.lumen,
    companionFree: Bosque.lumen,
  },
};

export function worldArt(world: WorldId, piece: ArtPiece): string {
  return ART[world]?.[piece]() ?? '';
}

/** Las escenas que un mundo dibuja en lienzo en vez de SVG (portada, salas y el tronco). */
export type ScenePiece = 'title' | 'monastery' | 'study' | 'trunk';

const RASTER: Partial<Record<WorldId, Partial<Record<ScenePiece, RasterScene>>>> = {
  bosque: BOSQUE_SCENES,
};

export function rasterScene(world: WorldId, piece: ScenePiece): RasterScene | null {
  return RASTER[world]?.[piece] ?? null;
}
