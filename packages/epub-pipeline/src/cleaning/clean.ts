import type { ClassifiedSection } from '../classification/classify.js';
import type { EpubArchive } from '../container/archive.js';
import { tagName } from '../dom/xhtml.js';
import type { BookStructure } from '../structure.js';
import { sanitizeContent } from './sanitize.js';
import { serializeChildren } from './serialize.js';
import { addStats, emptyStats, type RuleStats } from './stats.js';
import { removeHidden } from './structural/hidden.js';
import { extractNotes } from './structural/notes.js';
import { removePageNumbers } from './structural/page-numbers.js';
import {
  findRunningHeaders,
  removeDuplicateTitles,
  removeRunningHeaders,
} from './structural/running-headers.js';

export interface ReadingNote {
  id: string;
  html: string;
}

/** Sección tras la etapa 6: lista para leer, y con sus bloques listos para la etapa 7. */
export interface CleanedSection extends ClassifiedSection {
  /** Contenido sanitizado (reemplaza al original). */
  content: Element;
  /** HTML de lectura: bloques con `data-b`, llamadas a nota como `<a data-lectio-note="n1">`. */
  contentHtml: string;
  /** Bloques de texto en orden de lectura (`data-b` = índice). */
  blocks: Element[];
  notes: ReadingNote[];
  /** Imágenes referenciadas (rutas dentro del ZIP). */
  resources: string[];
  cleaning: RuleStats;
}

/**
 * Etapa 6: limpieza estructural. Las reglas S1–S4 trabajan sobre el XHTML original
 * (necesitan clases, ids y `epub:type`); después se sanitiza y se marcan los bloques.
 */
export function cleanSections(
  structure: BookStructure,
  archive: EpubArchive,
): { sections: CleanedSection[]; stats: RuleStats } {
  const documents = new Map(structure.documents.map((d) => [d.path, d]));
  const runningHeaders = findRunningHeaders(structure.sections);
  const total = emptyStats();

  const sections = structure.sections.map((original): CleanedSection => {
    // Se trabaja sobre una copia: la estructura de entrada no se modifica.
    const section = { ...original, content: original.content.cloneNode(true) as Element };
    const stats = emptyStats();

    removeHidden(section.content, stats);
    removePageNumbers(section.content, stats);
    removeRunningHeaders(section, runningHeaders, stats);
    removeDuplicateTitles(section, stats);
    const notes = extractNotes(section, documents, stats);

    const { content, blocks, resources } = sanitizeContent(section.content, null, archive);
    const noteResources: string[] = [];
    const readingNotes = notes.map((note) => {
      const wrapper = note.body.ownerDocument.createElement('div');
      wrapper.setAttribute('data-lectio-src', note.path);
      // El contenedor de la nota (<li id="note-3">, <aside>) no se muestra: solo su contenido.
      const unwrap = ['li', 'dd', 'aside'].includes(tagName(note.body));
      for (const node of unwrap ? Array.from(note.body.childNodes) : [note.body]) {
        wrapper.appendChild(node);
      }
      const sanitized = sanitizeContent(wrapper, null, archive, { markBlocks: false });
      noteResources.push(...sanitized.resources);
      return { id: note.id, html: serializeChildren(sanitized.content) };
    });

    addStats(total, stats);
    return {
      ...section,
      content,
      contentHtml: serializeChildren(content),
      blocks,
      notes: readingNotes,
      resources: [...new Set([...resources, ...noteResources])],
      cleaning: stats,
    };
  });

  return { sections, stats: total };
}
