import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { processEpub, type ProcessedBook } from '../../src/index.js';

/**
 * Golden files (docs/lectio-pipeline-limpieza.md §7.2): por cada libro del corpus se guarda
 * la estructura completa y la narración de tres capítulos. Cualquier cambio en las reglas
 * aparece como un diff legible en `test/golden/`. Solo se versiona el texto derivado,
 * nunca los EPUB.
 *
 * Actualizar tras un cambio intencional:  pnpm --filter @lectio/epub-pipeline golden:update
 */

const corpusDir = fileURLToPath(new URL('../../../../corpus/', import.meta.url));
const goldenDir = new URL('../golden/', import.meta.url);
const metricsFile = fileURLToPath(new URL('metrics.json', goldenDir));
const update = process.env.LECTIO_GOLDEN_UPDATE === '1';

const BOOKS = [
  'pg-don-quijote',
  'pg-marianela',
  'pg-becquer-obras-escogidas',
  'se-sherlock-holmes',
  'se-vindication-rights-woman',
  'idpf-wasteland-otf-obf',
  'idpf-accessible-epub-3',
  'idpf-moby-dick',
].filter((id) => existsSync(`${corpusDir}${id}.epub`));

/** Oraciones por capítulo muestreado: suficiente para ver anuncios, notas y diálogos. */
const SAMPLE_SENTENCES = 40;
/** Tolerancia de la métrica de regresión, en puntos porcentuales. */
const TOLERANCE = 2;

interface Metrics {
  sections: number;
  narrative: number;
  narratedPercent: number;
}

describe.skipIf(BOOKS.length === 0)('corpus: golden files', () => {
  const metrics: Record<string, Metrics> = existsSync(metricsFile)
    ? JSON.parse(readFileSync(metricsFile, 'utf8'))
    : {};

  it.each(BOOKS)('%s: estructura y narración coinciden con la referencia', async (id) => {
    const book = await processEpub(await readFile(`${corpusDir}${id}.epub`));
    await expect(render(book)).toMatchFileSnapshot(fileURLToPath(new URL(`${id}.txt`, goldenDir)));

    // Métrica de regresión: una caída brusca del porcentaje narrado delata un falso
    // positivo masivo (una regla que empezó a borrar texto del autor).
    const current = measure(book);
    if (update || !metrics[id]) {
      metrics[id] = current;
      writeFileSync(metricsFile, `${JSON.stringify(sortKeys(metrics), null, 2)}\n`);
      return;
    }
    expect(current.sections).toBe(metrics[id].sections);
    expect(current.narrative).toBe(metrics[id].narrative);
    expect(Math.abs(current.narratedPercent - metrics[id].narratedPercent)).toBeLessThanOrEqual(TOLERANCE);
  });
});

function measure(book: ProcessedBook): Metrics {
  const narrative = book.chapters.filter((c) => c.kind === 'narrative');
  const text = narrative.reduce((n, c) => n + c.sentences.reduce((m, s) => m + s.text.length, 0), 0);
  const narrated = narrative.reduce((n, c) => n + c.characterCount, 0);
  return {
    sections: book.chapters.length,
    narrative: narrative.length,
    narratedPercent: Math.round((1000 * narrated) / Math.max(text, 1)) / 10,
  };
}

/** Representación de texto estable y fácil de revisar en un diff. */
function render(book: ProcessedBook): string {
  const lines: string[] = [];
  const { metadata, report } = book;
  lines.push(`# ${metadata.title} — ${metadata.authors.join(', ')}`);
  lines.push(`idioma: ${metadata.language} · índice: ${report.navSource} · pipeline v${report.pipelineVersion}`);
  lines.push('');
  lines.push('## Estructura');
  for (const chapter of book.chapters) {
    const heading = [...chapter.ancestors, chapter.title].join(' › ');
    const c = chapter.classification;
    lines.push(
      `${String(chapter.orderIndex).padStart(3)} ${chapter.kind.padEnd(12)} ${String(chapter.characterCount).padStart(7)}  ${heading}  [${c.signal}${c.confidence === 'low' ? '?' : ''}: ${c.evidence}]`,
    );
  }
  lines.push('');
  lines.push('## Reglas');
  const cleaning = Object.entries(report.cleaning).map(([k, v]) => `${k}=${v.semantic}+${v.heuristic}`);
  lines.push(`limpieza: ${cleaning.join(' ')}`);
  lines.push(`narración: ${Object.entries(report.narration).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  lines.push(`warnings: ${report.warnings.map((w) => w.code).join(', ') || 'ninguno'}`);

  const narrative = book.chapters.filter((c) => c.kind === 'narrative');
  const samples = [...new Set([narrative[0], narrative[Math.floor(narrative.length / 2)], narrative.at(-1)])];
  for (const chapter of samples) {
    if (!chapter) continue;
    lines.push('');
    lines.push(`## Narración: ${chapter.title} (${chapter.sentences.length} oraciones)`);
    for (const sentence of chapter.sentences.slice(0, SAMPLE_SENTENCES)) {
      const marker = sentence.narration === '' ? '∅' : sentence.narration === sentence.text ? '=' : '≠';
      lines.push(`[${sentence.index}·b${sentence.blockIndex}] ${marker} ${sentence.narration || sentence.text}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function sortKeys<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}
