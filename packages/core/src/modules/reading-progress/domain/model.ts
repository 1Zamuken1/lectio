export type ReadingMode = 'reading' | 'listening';

/**
 * Posición en un libro (docs/lectio-modelo-datos.md §2.5): una sola, válida para leer y
 * para escuchar. `clientUpdatedAt` es cuándo estuvo el usuario ahí (no cuándo se envió):
 * resuelve los conflictos entre dispositivos.
 */
export interface Position {
  chapterId: string;
  sentenceIndex: number;
  mode: ReadingMode;
  clientUpdatedAt: Date;
}

export type SaveResult = { applied: true } | { applied: false; current: Position };
