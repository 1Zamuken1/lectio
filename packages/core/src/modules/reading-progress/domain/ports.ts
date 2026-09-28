import type { Position, SaveResult } from './model.js';

export interface ProgressRepository {
  /** Guarda solo si es posterior a lo guardado; si no, devuelve la posición vigente. */
  saveIfNewer(userId: string, bookId: string, position: Position): Promise<SaveResult>;
  find(userId: string, bookId: string): Promise<Position | null>;
}

export const PROGRESS_REPOSITORY = Symbol('PROGRESS_REPOSITORY');
