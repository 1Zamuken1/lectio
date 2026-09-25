import { collapsedText, descendants, isElement, isText, tagName } from '../dom/xhtml.js';
import type { Landmark, Navigation } from '../navigation/types.js';
import type { Section } from '../segmentation/sections.js';
import { GENERIC_TYPES, SPECIFIC_TYPES, verdictForTitle, type Verdict } from './rules.js';

export type SectionKind = 'narrative' | 'front_matter' | 'back_matter' | 'notes';

export type ClassificationSignal = 'semantic' | 'landmark' | 'title' | 'heuristic' | 'default';

export interface Classification {
  kind: SectionKind;
  signal: ClassificationSignal;
  /** `low` cuando decidió una heurística: útil para calibrar reglas con el corpus. */
  confidence: 'high' | 'low';
  /** Qué lo decidió, legible (queda en el reporte): `epub:type=titlepage`, `título "Índice"`... */
  evidence: string;
}

export interface ClassifiedSection extends Section {
  kind: SectionKind;
  classification: Classification;
}

export interface ClassificationOptions {
  /** Tamaño a partir del cual una sección se considera "cuerpo" del libro. */
  coreMinChars: number;
  /** Secciones más cortas que esto, fuera del cuerpo, se consideran material auxiliar. */
  shortMaxChars: number;
  /** Proporción del texto dentro de enlaces a partir de la cual una sección es un índice. */
  tocLinkRatio: number;
}

export const DEFAULT_CLASSIFICATION_OPTIONS: ClassificationOptions = {
  coreMinChars: 2000,
  shortMaxChars: 300,
  tocLinkRatio: 0.5,
};

interface Decision {
  verdict: Verdict;
  signal: ClassificationSignal;
  evidence: string;
}

/**
 * Etapa 5. Señales en orden de precedencia (la primera que decide gana):
 * 1. Tipo semántico específico del punto de corte o del documento (`titlepage`, `endnotes`).
 * 2. Landmark tipado que apunta exactamente al inicio de la sección.
 * 3. Tipo semántico genérico (`frontmatter`, `bodymatter`, `backmatter`).
 * 4. Título reconocible ("Índice", "Colophon", "Notas").
 * 5. Heurísticas de contenido y posición (confianza baja).
 * 6. Por defecto, narrativa: omitir texto del autor es peor que narrar un aviso.
 */
export function classifySections(
  sections: Section[],
  navigation: Navigation,
  options: ClassificationOptions = DEFAULT_CLASSIFICATION_OPTIONS,
): ClassifiedSection[] {
  const firstPass = sections.map((section) =>
    decideBySignals(section, navigation.landmarks, options),
  );

  // El "cuerpo" del libro: primera y última sección extensa que no es material auxiliar.
  const isCore = (i: number) => {
    const decision = firstPass[i];
    return (
      (!decision || decision.verdict === 'narrative') &&
      sections[i]!.textLength >= options.coreMinChars
    );
  };
  const indices = sections.map((_, i) => i);
  const firstCore = indices.find(isCore) ?? indices.find((i) => !firstPass[i]) ?? 0;
  const lastCore =
    indices.findLast(isCore) ?? indices.findLast((i) => !firstPass[i]) ?? sections.length - 1;
  const bodyStart = landmarkIndex(sections, navigation.landmarks, 'bodymatter');
  const backStart = landmarkIndex(sections, navigation.landmarks, 'backmatter');

  return sections.map((section, i) => {
    const decision = firstPass[i] ?? decideByPosition(section, i);
    const verdict =
      decision.verdict === 'aux' ? (i > lastCore ? 'back' : 'front') : decision.verdict;
    const heuristic = decision.signal === 'heuristic';
    return {
      ...section,
      kind: KIND[verdict],
      classification: {
        kind: KIND[verdict],
        signal: decision.signal,
        confidence: heuristic ? 'low' : 'high',
        evidence: decision.evidence,
      },
    };
  });

  function decideByPosition(section: Section, i: number): Decision {
    const short = section.textLength < options.shortMaxChars;
    if (bodyStart !== null && i < bodyStart && section.textLength < options.coreMinChars) {
      return { verdict: 'front', signal: 'heuristic', evidence: 'antes del landmark bodymatter' };
    }
    if (backStart !== null && i >= backStart && short) {
      return { verdict: 'back', signal: 'heuristic', evidence: 'después del landmark backmatter' };
    }
    const outsideCore = i < firstCore || i > lastCore;
    if (
      outsideCore &&
      section.textLength < options.coreMinChars &&
      LEGAL_NOTICE.test(collapsedText(section.content))
    ) {
      return {
        verdict: i < firstCore ? 'front' : 'back',
        signal: 'heuristic',
        evidence: 'aviso legal fuera del cuerpo del libro',
      };
    }
    if (short && i < firstCore) {
      return {
        verdict: 'front',
        signal: 'heuristic',
        evidence: 'corta y antes del cuerpo del libro',
      };
    }
    if (short && i > lastCore) {
      return {
        verdict: 'back',
        signal: 'heuristic',
        evidence: 'corta y después del cuerpo del libro',
      };
    }
    return {
      verdict: 'narrative',
      signal: 'default',
      evidence: 'sin señales de material auxiliar',
    };
  }
}

const KIND: Record<Exclude<Verdict, 'aux'>, SectionKind> = {
  narrative: 'narrative',
  front: 'front_matter',
  back: 'back_matter',
  notes: 'notes',
};

function decideBySignals(
  section: Section,
  landmarks: Landmark[],
  options: ClassificationOptions,
): Decision | null {
  const { element, document } = section.semantics;

  const specific = [...element, ...document].find((type) => type in SPECIFIC_TYPES);
  if (specific) {
    return {
      verdict: SPECIFIC_TYPES[specific]!,
      signal: 'semantic',
      evidence: `epub:type=${specific}`,
    };
  }

  const landmark = landmarks.find((l) => startsAt(section, l));
  if (landmark && landmark.type in SPECIFIC_TYPES) {
    return {
      verdict: SPECIFIC_TYPES[landmark.type]!,
      signal: 'landmark',
      evidence: `landmark ${landmark.type}`,
    };
  }

  const generic = [...element, ...document].find((type) => type in GENERIC_TYPES);
  if (generic) {
    return {
      verdict: GENERIC_TYPES[generic]!,
      signal: 'semantic',
      evidence: `epub:type=${generic}`,
    };
  }
  if (landmark && landmark.type in GENERIC_TYPES) {
    return {
      verdict: GENERIC_TYPES[landmark.type]!,
      signal: 'landmark',
      evidence: `landmark ${landmark.type}`,
    };
  }

  const byTitle = verdictForTitle(section.title);
  if (byTitle) return { verdict: byTitle, signal: 'title', evidence: `título "${section.title}"` };

  return decideByContent(section, options);
}

function decideByContent(section: Section, options: ClassificationOptions): Decision | null {
  const stats = contentStats(section.content);

  if (stats.links >= 3 && stats.linkChars / Math.max(stats.chars, 1) >= options.tocLinkRatio) {
    return {
      verdict: 'aux',
      signal: 'heuristic',
      evidence: `índice: ${Math.round((100 * stats.linkChars) / stats.chars)} % del texto en enlaces`,
    };
  }
  if (stats.blocks >= 3 && stats.noteBlocks / stats.blocks >= 0.6) {
    return {
      verdict: 'notes',
      signal: 'heuristic',
      evidence: 'bloques numerados con aspecto de notas',
    };
  }
  if (stats.chars < 20 && stats.images > 0) {
    return { verdict: 'aux', signal: 'heuristic', evidence: 'solo imagen' };
  }
  return null;
}

const LEGAL_NOTICE = /©|\bcopyright\b|all rights reserved|derechos reservados|\bisbn\b/i;

/** Bloque que empieza con una marca de nota: "1.", "[3]", "(2)", "*", "†". */
const NOTE_MARKER = /^\s*(\[\d{1,3}\]|\(\d{1,3}\)|\d{1,3}[.)\]]|[*†‡])\s*\S/;
const BLOCK_TAGS = new Set(['p', 'li', 'dd', 'aside', 'div']);

function contentStats(root: Element) {
  let chars = 0;
  let linkChars = 0;
  let links = 0;
  let images = 0;
  let blocks = 0;
  let noteBlocks = 0;

  const countText = (node: Node, insideLink: boolean): void => {
    for (const child of Array.from(node.childNodes)) {
      if (isText(child)) {
        const length = (child.textContent ?? '').replace(/\s+/g, ' ').trim().length;
        chars += length;
        if (insideLink) linkChars += length;
      } else if (isElement(child)) {
        const isLink = tagName(child) === 'a' && child.hasAttribute('href');
        if (isLink) links++;
        countText(child, insideLink || isLink);
      }
    }
  };
  countText(root, false);

  for (const element of descendants(root)) {
    const tag = tagName(element);
    if (['img', 'image', 'svg'].includes(tag)) images++;
    // Solo bloques "hoja": un <div> que contiene párrafos no cuenta como bloque propio.
    const isLeafBlock =
      BLOCK_TAGS.has(tag) && !Array.from(element.children).some((c) => BLOCK_TAGS.has(tagName(c)));
    const text = (element.textContent ?? '').trim();
    if (isLeafBlock && text) {
      blocks++;
      if (NOTE_MARKER.test(text)) noteBlocks++;
    }
  }
  return { chars, linkChars, links, images, blocks, noteBlocks };
}

/** El landmark apunta al inicio de la sección o a su ancla (el capítulo tras una portadilla). */
function startsAt(section: Section, landmark: Landmark): boolean {
  return [section.start, section.anchor].some(
    (point) =>
      landmark.path === point.path &&
      (landmark.fragment === null ? point.id === null : landmark.fragment === point.id),
  );
}

/** Índice de la primera sección donde empieza (o que contiene el inicio de) un landmark. */
function landmarkIndex(sections: Section[], landmarks: Landmark[], type: string): number | null {
  const landmark = landmarks.find((l) => l.type === type);
  if (!landmark) return null;
  const exact = sections.findIndex((s) => startsAt(s, landmark));
  if (exact !== -1) return exact;
  const inDocument = sections.findIndex((s) => s.documents.includes(landmark.path));
  return inDocument === -1 ? null : inDocument;
}
