/** Motor de pixel art (pixel.js): cada función devuelve SVG listo para insertar. */
export interface PixelCanvas {
  rect(color: string, x: number, y: number, w?: number, h?: number): void;
  sprite(rows: string[], palette: Record<string, string>, x: number, y: number): void;
  svg(className?: string): string;
}

export declare const Pixel: {
  scriptoriumScene(options?: { desk?: boolean }): string;
  /** La gran biblioteca del monasterio (el catálogo público). */
  monasteryScene(): string;
  /** Tu estudio. */
  studyScene(): string;
  /** El pie del atril bajo la ficha del libro. */
  lecternStand(): string;
  /** El taller de copistas; `voice` elige la cuadrilla. */
  workshop(voice: string): string;
  owlBadge(): string;
  fleuron(): string;
  quill(): string;
  canvas(): PixelCanvas;
  random(seed: number): () => number;
};
