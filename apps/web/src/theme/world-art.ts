import { Bosque } from './bosque';
import { Pixel } from './pixel';
import type { WorldId } from './worlds';

/**
 * Las piezas de pixel art que comparten todos los mundos con HUD de píxeles: cada mundo
 * dibuja la suya (docs/lectio-temas.md §7.1). Un mundo sin la pieza (el Clásico) da ''.
 */
const ART: Partial<Record<WorldId, { pageCorner: () => string; progressThumb: () => string }>> = {
  scriptorium: { pageCorner: Pixel.fleuron, progressThumb: Pixel.quill },
  bosque: { pageCorner: Bosque.corner, progressThumb: Bosque.sprout },
};

export function worldArt(world: WorldId, piece: 'pageCorner' | 'progressThumb'): string {
  return ART[world]?.[piece]() ?? '';
}
