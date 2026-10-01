/** Escenas del Bosque élfico en un lienzo de píxeles (bosque-scenes.js). */
export declare const W: number;
export declare const H: number;

export declare class Pix {
  constructor(w?: number, h?: number);
  readonly w: number;
  readonly h: number;
  readonly d: Uint8ClampedArray<ArrayBuffer>;
  copy(): Pix;
}

export type Mode = 'day' | 'night';

/** Un rectángulo en coordenadas de la escena (320 × 180). */
export interface SceneRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RasterScene {
  /** Lo fijo: se dibuja una vez por modo. */
  base(mode: Mode): Pix;
  /** Lo que se mueve, pintado sobre la base en cada paso (null: escena quieta). */
  frame: ((base: Pix, mode: Mode, time: number) => Pix) | null;
  /** Donde van los libros reales (el hueco de la estantería dibujada). */
  shelf?: SceneRect;
  /** La puerta a la otra sala (el ascensor de lianas). */
  door?: SceneRect;
  /** El punto que queda a la vista cuando la pantalla recorta la escena (0 a 1). */
  focus: [number, number];
}

export declare const SCENES: Record<'title' | 'monastery' | 'study' | 'trunk', RasterScene>;
