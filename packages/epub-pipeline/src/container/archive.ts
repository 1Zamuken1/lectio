import { fromBuffer, type Entry, type ZipFile } from 'yauzl';
import { PipelineError } from '../errors.js';

const MB = 1024 * 1024;

/** Límites de seguridad: el archivo viene de un usuario y puede ser malicioso. */
export interface ArchiveLimits {
  /** Tamaño máximo del .epub tal como se sube. */
  maxArchiveBytes: number;
  /** Suma máxima de los tamaños descomprimidos (protección contra zip bombs). */
  maxUncompressedBytes: number;
  /** Número máximo de entradas del ZIP. */
  maxEntries: number;
}

export const DEFAULT_ARCHIVE_LIMITS: ArchiveLimits = {
  maxArchiveBytes: 100 * MB,
  maxUncompressedBytes: 300 * MB,
  maxEntries: 10_000,
};

/** Contenido del contenedor OCF ya descomprimido y validado. */
export class EpubArchive {
  readonly #files: ReadonlyMap<string, Buffer>;

  constructor(
    files: ReadonlyMap<string, Buffer>,
    /** Rutas en el orden en que aparecen en el ZIP (OCF exige `mimetype` primero). */
    readonly entryOrder: readonly string[],
  ) {
    this.#files = files;
  }

  has(path: string): boolean {
    return this.#files.has(path);
  }

  read(path: string): Buffer | undefined {
    return this.#files.get(path);
  }

  /** Lee un archivo de texto respetando el BOM (UTF-8 o UTF-16). */
  readText(path: string): string | undefined {
    const data = this.#files.get(path);
    return data === undefined ? undefined : decodeText(data);
  }
}

export async function openArchive(buffer: Buffer, limits: ArchiveLimits): Promise<EpubArchive> {
  if (buffer.length > limits.maxArchiveBytes) {
    throw new PipelineError(
      'LIMITS_EXCEEDED',
      `El archivo pesa ${toMb(buffer.length)} MB; el máximo es ${toMb(limits.maxArchiveBytes)} MB.`,
      { details: { limit: 'maxArchiveBytes' } },
    );
  }

  const zip = await openZip(buffer);
  try {
    if (zip.entryCount > limits.maxEntries) {
      throw new PipelineError(
        'LIMITS_EXCEEDED',
        `El archivo contiene ${zip.entryCount} entradas; el máximo es ${limits.maxEntries}.`,
        { details: { limit: 'maxEntries' } },
      );
    }
    return await readEntries(zip, limits);
  } finally {
    zip.close();
  }
}

function openZip(buffer: Buffer): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    fromBuffer(
      buffer,
      // decodeStrings valida los nombres: rechaza rutas absolutas y con `..` (path traversal).
      // validateEntrySizes verifica que lo descomprimido coincida con el tamaño declarado.
      { lazyEntries: true, decodeStrings: true, validateEntrySizes: true, strictFileNames: false },
      (error, zip) => {
        if (error) reject(invalidArchive(error));
        else resolve(zip);
      },
    );
  });
}

function readEntries(zip: ZipFile, limits: ArchiveLimits): Promise<EpubArchive> {
  return new Promise((resolve, reject) => {
    const files = new Map<string, Buffer>();
    const order: string[] = [];
    let declaredBytes = 0;
    let settled = false;

    const fail = (error: unknown): void => {
      if (settled) return;
      settled = true;
      zip.close();
      reject(error instanceof PipelineError ? error : invalidArchive(error));
    };

    zip.on('error', fail);
    zip.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(new EpubArchive(files, order));
    });

    zip.on('entry', (entry: Entry) => {
      if (settled) return;
      if (entry.fileName.endsWith('/')) {
        zip.readEntry();
        return;
      }

      // Se valida con el tamaño declarado antes de descomprimir nada;
      // validateEntrySizes garantiza que el tamaño real no lo supere.
      declaredBytes += entry.uncompressedSize;
      if (declaredBytes > limits.maxUncompressedBytes) {
        fail(
          new PipelineError(
            'LIMITS_EXCEEDED',
            `El contenido descomprimido supera el máximo de ${toMb(limits.maxUncompressedBytes)} MB.`,
            { details: { limit: 'maxUncompressedBytes' } },
          ),
        );
        return;
      }
      if (entry.isEncrypted()) {
        fail(
          new PipelineError('INVALID_ARCHIVE', 'El ZIP tiene entradas protegidas con contraseña.'),
        );
        return;
      }

      zip.openReadStream(entry, (error, stream) => {
        if (error) {
          fail(error);
          return;
        }
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('error', fail);
        stream.on('end', () => {
          if (!files.has(entry.fileName)) {
            files.set(entry.fileName, Buffer.concat(chunks));
            order.push(entry.fileName);
          }
          zip.readEntry();
        });
      });
    });

    zip.readEntry();
  });
}

function decodeText(data: Buffer): string {
  if (data[0] === 0xff && data[1] === 0xfe) return data.subarray(2).toString('utf16le');
  if (data[0] === 0xfe && data[1] === 0xff) {
    return Buffer.from(data.subarray(2)).swap16().toString('utf16le');
  }
  const text = data.toString('utf8');
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function invalidArchive(cause: unknown): PipelineError {
  return new PipelineError('INVALID_ARCHIVE', 'El archivo no es un ZIP válido o está dañado.', {
    cause,
  });
}

function toMb(bytes: number): string {
  return (bytes / MB).toFixed(1);
}
