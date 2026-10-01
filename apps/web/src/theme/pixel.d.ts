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
  /** La cuadrilla que trae un libro recién subido por la repisa. */
  bookCrew(): string;
  /** Llamas para el libro que no se pudo preparar. */
  flames(): string;
  /** El taller de copistas; `voice` elige la cuadrilla. */
  workshop(voice: string): string;
  /** Un aprendiz con su pergamino, vestido del color de la voz que se descarga. */
  scrollCarrier(voice?: string): string;
  /** El arcón de las descargas, con la tapa abierta y cerrada (la alterna el CSS). */
  downloadChest(): string;
  /** Un aprendiz con su pergamino, vestido del color de la voz que se descarga. */
  scrollCarrier(voice?: string): string;
  /** El arcón de las descargas, con la tapa abierta y cerrada (la alterna el CSS). */
  downloadChest(): string;
  owlBadge(): string;
  fleuron(): string;
  quill(): string;
  canvas(): PixelCanvas;
  random(seed: number): () => number;
};
