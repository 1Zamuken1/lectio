// Descarga los EPUB del corpus de referencia listados en corpus/sources.json.
// Uso: pnpm corpus:download [--force]
// Los archivos ya descargados se saltan, salvo con --force.

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const corpusDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'corpus');
const force = process.argv.includes('--force');
// Pausa entre descargas, por cortesía con Project Gutenberg (desaconseja descargas automáticas rápidas).
const DELAY_MS = 2000;

const { books } = JSON.parse(await readFile(join(corpusDir, 'sources.json'), 'utf8'));
let failures = 0;

for (const [index, book] of books.entries()) {
  const target = join(corpusDir, `${book.id}.epub`);
  if (existsSync(target) && !force) {
    console.log(`- ${book.id}: ya existe, se salta`);
    continue;
  }
  if (index > 0) await new Promise((resolve) => setTimeout(resolve, DELAY_MS));

  try {
    const response = await fetch(book.url, {
      headers: { 'User-Agent': 'lectio-corpus/0.1 (proyecto personal; descarga puntual)' },
      redirect: 'follow',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = Buffer.from(await response.arrayBuffer());
    // Un EPUB es un ZIP: debe empezar con la firma "PK\x03\x04". Evita guardar una página HTML de error.
    if (data.subarray(0, 4).toString('binary') !== 'PK\x03\x04') {
      throw new Error(`la respuesta no es un EPUB (${response.headers.get('content-type')})`);
    }

    await writeFile(target, data);
    console.log(`+ ${book.id}: ${(data.length / 1024 / 1024).toFixed(1)} MB`);
  } catch (error) {
    failures += 1;
    console.error(`x ${book.id}: ${error.message}`);
  }
}

console.log(failures ? `\nTerminado con ${failures} error(es).` : '\nCorpus completo.');
process.exitCode = failures ? 1 : 0;
