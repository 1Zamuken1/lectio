import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { assertSafeKey, type FileStorage } from './file-storage.js';

/** storage/ en la raíz del monorepo: misma profundidad desde src/ y dist/. */
const DEFAULT_ROOT = fileURLToPath(new URL('../../../../../storage', import.meta.url));

/**
 * Storage en una carpeta local, para desarrollo y tests. Escribe de forma atómica (archivo
 * temporal y rename), así un corte a mitad de camino no deja un archivo incompleto.
 */
@Injectable()
export class LocalFileStorage implements FileStorage {
  readonly root: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.root = resolve(config.STORAGE_DIR ?? DEFAULT_ROOT);
  }

  async put(key: string, data: Buffer): Promise<void> {
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${process.pid}.tmp`;
    await writeFile(temporary, data);
    await rename(temporary, path);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.pathOf(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async openRead(key: string, range?: { start: number; end: number }) {
    const path = this.pathOf(key);
    const size = await this.size(key);
    if (size === null) return null;
    return { stream: createReadStream(path, range), size };
  }

  async size(key: string): Promise<number | null> {
    try {
      return (await stat(this.pathOf(key))).size;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true });
  }

  async deletePrefix(prefix: string): Promise<void> {
    await rm(this.pathOf(prefix), { recursive: true, force: true });
  }

  /** Ruta en el disco; la clave ya se validó, y además nunca sale de la carpeta raíz. */
  private pathOf(key: string): string {
    assertSafeKey(key);
    const path = resolve(join(this.root, key));
    if (path !== this.root && !path.startsWith(this.root + sep)) {
      throw new Error(`Clave fuera del storage: ${key}`);
    }
    return path;
  }
}
