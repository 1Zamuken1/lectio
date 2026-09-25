import { fromBuffer, type Entry } from 'yauzl';

export interface ZipEntryInfo {
  path: string;
  compressed: boolean;
  content: string;
}

/** Lee todas las entradas de un ZIP en orden. Solo para tests: sin límites de seguridad. */
export function readZip(buffer: Buffer): Promise<ZipEntryInfo[]> {
  return new Promise((resolve, reject) => {
    fromBuffer(buffer, { lazyEntries: true }, (openError, zip) => {
      if (openError) return reject(openError);
      const entries: ZipEntryInfo[] = [];

      zip.on('entry', (entry: Entry) => {
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError) return reject(streamError);
          const chunks: Buffer[] = [];
          stream.on('data', (chunk: Buffer) => chunks.push(chunk));
          stream.on('end', () => {
            entries.push({
              path: entry.fileName,
              compressed: entry.compressionMethod !== 0,
              content: Buffer.concat(chunks).toString('utf8'),
            });
            zip.readEntry();
          });
          stream.on('error', reject);
        });
      });
      zip.on('end', () => resolve(entries));
      zip.on('error', reject);
      zip.readEntry();
    });
  });
}
