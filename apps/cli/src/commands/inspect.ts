import { readFile } from 'node:fs/promises';
import { processEpub, type ProcessedBook, type SectionKind } from '@lectio/epub-pipeline';
import { formatDuration, formatNumber, style, userPath } from '../ui/terminal.js';

const KIND_LABEL: Record<SectionKind, string> = {
  narrative: 'narrativa',
  front_matter: 'preliminar',
  back_matter: 'final',
  notes: 'notas',
};

const RULE_LABEL: Record<string, string> = {
  S1_page_numbers: 'números de página',
  S1_line_numbers: 'números de verso',
  S2_running_headers: 'encabezados repetidos',
  S2_duplicate_titles: 'títulos repetidos',
  S3_hidden: 'elementos ocultos',
  S4_notes: 'llamadas a nota',
  N1_noterefs: 'marcas de nota',
  N2_dois: 'DOIs',
  N3_urls: 'URLs',
  N4_citations: 'citas',
  N5_legal: 'avisos legales',
};

export async function inspect(file: string, options: { json?: boolean }): Promise<void> {
  const book = await processEpub(await readFile(userPath(file)));
  if (options.json) {
    console.log(JSON.stringify(summary(book), null, 2));
    return;
  }
  printBook(book);
}

function printBook(book: ProcessedBook): void {
  const { metadata, report } = book;
  const title = metadata.title ?? 'Sin título';
  const authors = metadata.authors.join(', ') || 'autor desconocido';

  console.log();
  console.log(`${style.bold(title)} ${style.dim('—')} ${authors}`);
  console.log(
    style.dim(
      [
        `${metadata.language}${report.language.source === 'detected' ? ' (detectado)' : ''}`,
        `índice: ${report.navSource}`,
        `${report.chapters.total} secciones`,
        `${report.chapters.narrative} narrativas`,
        `≈ ${formatDuration(report.characters.estimatedMinutes)} de audio`,
        `${report.durationMs} ms`,
      ].join(' · '),
    ),
  );
  console.log();

  const width = Math.max(...book.chapters.map((c) => String(c.orderIndex).length));
  console.log(
    style.gray(`  ${'#'.padStart(width)}  ${'tipo'.padEnd(11)}${'narración'.padStart(10)}  título`),
  );
  for (const chapter of book.chapters) {
    const narrative = chapter.kind === 'narrative';
    const low = chapter.classification.confidence === 'low';
    const kind = `${KIND_LABEL[chapter.kind]}${low ? '?' : ''}`.padEnd(11);
    const chars = formatNumber(chapter.characterCount).padStart(10);
    const heading = [...chapter.ancestors, chapter.title].join(' › ');
    const line = `  ${String(chapter.orderIndex).padStart(width)}  ${kind}${chars}  ${heading}`;
    const reason = narrative ? '' : style.gray(`  ← ${chapter.classification.evidence}`);
    console.log((narrative ? line : style.gray(line)) + reason);
  }

  console.log();
  printRules(
    'Limpieza',
    Object.entries(report.cleaning).map(([k, v]) => [k, v.semantic + v.heuristic]),
  );
  printRules('Narración', Object.entries(report.narration));
  if (report.warnings.length === 0) {
    console.log(`${style.bold('Advertencias:')} ${style.green('ninguna')}`);
  } else {
    console.log(style.bold(`Advertencias (${report.warnings.length}):`));
    for (const warning of report.warnings)
      console.log(`  ${style.yellow(warning.code)} ${warning.message}`);
  }
  console.log(style.gray('\n"?" = clasificación de baja confianza (decidida por heurística).'));
}

function printRules(label: string, entries: Array<[string, number]>): void {
  const applied = entries.filter(([, count]) => count > 0);
  const text = applied.length
    ? applied
        .map(([rule, count]) => `${RULE_LABEL[rule] ?? rule} ${style.bold(formatNumber(count))}`)
        .join(' · ')
    : style.gray('sin cambios');
  console.log(`${style.bold(`${label}:`)} ${text}`);
}

/** Resumen serializable (sin HTML ni oraciones) para `--json`. */
function summary(book: ProcessedBook) {
  return {
    metadata: book.metadata,
    cover: book.cover
      ? { path: book.cover.path, mediaType: book.cover.mediaType, source: book.cover.source }
      : null,
    chapters: book.chapters.map((c) => ({
      orderIndex: c.orderIndex,
      title: c.title,
      ancestors: c.ancestors,
      kind: c.kind,
      classification: c.classification,
      characterCount: c.characterCount,
      sentences: c.sentences.length,
      notes: c.notes.length,
    })),
    report: book.report,
  };
}
