import { Bosque } from './bosque';
import { Pixel } from './pixel';
import type { WorldId } from './worlds';

/**
 * El pixel art de cada mundo, pieza por pieza (docs/lectio-temas.md §7.1): cada mundo
 * dibuja su versión de la misma pieza. Un mundo sin esa pieza (el Clásico) da ''.
 */
export type ArtPiece =
  'pageCorner' | 'progressThumb' | 'title' | 'monastery' | 'study' | 'lecternStand';

const ART: Partial<Record<WorldId, Record<ArtPiece, () => string>>> = {
  scriptorium: {
    pageCorner: Pixel.fleuron,
    progressThumb: Pixel.quill,
    title: () => Pixel.scriptoriumScene({ desk: true }),
    monastery: Pixel.monasteryScene,
    study: Pixel.studyScene,
    lecternStand: Pixel.lecternStand,
  },
  bosque: {
    pageCorner: Bosque.corner,
    progressThumb: Bosque.sprout,
    title: Bosque.titleScene,
    monastery: Bosque.hallScene,
    study: Bosque.refugeScene,
    lecternStand: Bosque.lecternStand,
  },
};

export function worldArt(world: WorldId, piece: ArtPiece): string {
  return ART[world]?.[piece]() ?? '';
}
