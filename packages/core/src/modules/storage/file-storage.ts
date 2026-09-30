import { createHash } from 'node:crypto';
import { extname } from 'node:path';
import type { Readable } from 'node:stream';

/**
 * Puerto de almacenamiento de archivos (docs/lectio-arquitectura-api.md §1.4). En desarrollo,
 * una carpeta local; al desplegar, R2/S3. La aplicación solo conoce claves ("books/<id>/…"),
 * nunca rutas del disco ni URLs.
 */
export interface FileStorage {
  put(key: string, data: Buffer): Promise<void>;
  /** null si no existe. */
  get(key: string): Promise<Buffer | null>;
  /**
   * Lectura por partes (audio con Range): `range` en bytes, ambos extremos incluidos.
   * `size` es el tamaño total del archivo; null si no existe.
   */
  openRead(
    key: string,
    range?: { start: number; end: number },
  ): Promise<{ stream: Readable; size: number } | null>;
  /** Tamaño en bytes; null si no existe. */
  size(key: string): Promise<number | null>;
  delete(key: string): Promise<void>;
  /** Borra todo lo que empieza con `prefix` (por ejemplo, todos los archivos de un libro). */
  deletePrefix(prefix: string): Promise<void>;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');

/** Claves: letras, números, guiones, puntos y barras; nunca "..", ni rutas absolutas. */
const SAFE_KEY = /^(?!\/)(?!.*\.\.)[A-Za-z0-9._/-]+$/;

export function assertSafeKey(key: string): void {
  if (!SAFE_KEY.test(key)) throw new Error(`Clave de storage no válida: ${key}`);
}

/** Dónde vive cada archivo de un libro. */
export const storageKeys = {
  book: (bookId: string) => `books/${bookId}/`,
  source: (bookId: string) => `books/${bookId}/source.epub`,
  cover: (bookId: string, mediaType: string) =>
    `books/${bookId}/cover${EXTENSIONS[mediaType] ?? '.img'}`,
  /**
   * Imagen de un capítulo. La ruta dentro del EPUB puede tener espacios o tildes: la clave
   * usa su hash (estable) y conserva la extensión para saber su tipo.
   */
  /**
   * Audio de un capítulo con una voz y su alineación. `version` resume la prosodia: si el
   * perfil cambia, el audio nuevo tiene otra clave y ninguna caché sirve el viejo.
   */
  audio: (bookId: string, chapterId: string, voiceId: string, version: string) =>
    `books/${bookId}/audio/${voiceId}/${chapterId}.${version}.mp3`,
  alignment: (bookId: string, chapterId: string, voiceId: string, version: string) =>
    `books/${bookId}/audio/${voiceId}/${chapterId}.${version}.alignment.json`,
  /** Muestra de unos segundos de un perfil de voz. */
  voiceSample: (voiceId: string, version: string) => `voices/${voiceId}.${version}.mp3`,
  resource: (bookId: string, epubPath: string) =>
    `books/${bookId}/resources/${createHash('sha256').update(epubPath).digest('hex').slice(0, 24)}${safeExtension(epubPath)}`,
};

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

const MEDIA_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.epub': 'application/epub+zip',
  '.mp3': 'audio/mpeg',
  '.json': 'application/json',
};

function safeExtension(path: string): string {
  const extension = extname(path).toLowerCase();
  return /^\.[a-z0-9]{1,5}$/.test(extension) ? extension : '';
}

/** Tipo de contenido a partir de la extensión de la clave. */
export function mediaTypeOf(key: string): string {
  return MEDIA_TYPES[extname(key).toLowerCase()] ?? 'application/octet-stream';
}
