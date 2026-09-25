import type { CleanedSection } from '../cleaning/clean.js';
import { collapsedText, tagName } from '../dom/xhtml.js';
import { blockText, segmentSentences, type BlockText } from '../sentences/segment.js';
import { dialogueRanges, splitByVoice, type VoiceKind } from './dialogue.js';
import {
  announcementFor,
  buildVocabulary,
  normalizeNarration,
  normalizeTitle,
} from './normalize.js';
import {
  DEFAULT_NARRATION_OPTIONS,
  removeCitations,
  removeDois,
  removeLegal,
  removeUrls,
  type NarrationOptions,
  type NarrationRule,
} from './rules.js';

export interface Sentence {
  /** Índice dentro del capítulo: la clave de sincronización entre lectura y audio. */
  index: number;
  /** Bloque que la contiene (`data-b` en el HTML de lectura). */
  blockIndex: number;
  /** Offsets [start, end) dentro del texto del bloque. */
  start: number;
  end: number;
  /** Texto tal como se lee: `blockText.slice(start, end)`. */
  text: string;
  /** Texto a narrar. `""` = esta oración no se narra (y no tendrá audio). */
  narration: string;
  /**
   * Tramos de narración y diálogo, solo si la oración tiene diálogo: el narrador los lee
   * con prosodias distintas. Sin este campo, toda la oración es narración.
   */
  voices?: VoicePart[];
}

export interface VoicePart {
  kind: VoiceKind;
  text: string;
}

export type NarrationStats = Record<NarrationRule, number>;

export interface NarratedSection extends CleanedSection {
  sentences: Sentence[];
  /** Caracteres de narración: lo que se envía al TTS y cuenta para la cuota. */
  characterCount: number;
  narrationStats: NarrationStats;
}

/** Bloques que no se narran: sus oraciones existen (para mantener los índices) sin narración. */
const SILENT_BLOCKS = new Set(['td', 'th', 'caption', 'pre']);
const HEADING = /^h[1-6]$/;
/** Hasta dónde se buscan encabezados repetidos al inicio de un capítulo. */
const MAX_LEADING_BLOCKS = 6;
const SHORT_BLOCK_CHARS = 100;

/** Etapas 7 (oraciones), 8 (limpieza de narración) y 9 (normalización). */
export function narrateSections(
  sections: CleanedSection[],
  language: string,
  options: Partial<NarrationOptions> = {},
): { sections: NarratedSection[]; stats: NarrationStats } {
  const rules = { ...DEFAULT_NARRATION_OPTIONS, ...options };
  const vocabulary = buildVocabulary(
    sections.flatMap((s) => s.blocks.map((b) => b.textContent ?? '')),
  );
  const total = emptyNarrationStats();
  let previousParent: string | null = null;

  const narrated = sections.map((section): NarratedSection => {
    const stats = emptyNarrationStats();
    const sentences: Sentence[] = [];

    section.blocks.forEach((block, blockIndex) => {
      const analyzed = blockText(block);
      const silent = isSilent(block);
      // N1: toda llamada a nota de un bloque narrado queda fuera de la narración (dentro de
      // una oración se recorta; al final de una oración ya queda fuera de su rango).
      if (!silent) stats.N1_noterefs += analyzed.noteRanges.length;
      const dialogue = silent ? [] : dialogueRanges(analyzed.text, language);
      for (const [start, end] of segmentSentences(analyzed, language)) {
        const narration = silent
          ? ''
          : narrationFor(analyzed, start, end, rules, stats, vocabulary);
        const voices = narration
          ? voicesFor(analyzed, start, end, dialogue, rules, vocabulary)
          : undefined;
        sentences.push({
          index: sentences.length,
          blockIndex,
          start,
          end,
          text: analyzed.text.slice(start, end),
          narration,
          ...(voices ? { voices } : {}),
        });
      }
    });

    // La parte ("Segunda parte…") se anuncia solo en el primer capítulo narrativo que la
    // contiene: las secciones de front matter del grupo (tasa, erratas) no la "consumen".
    const parent = section.ancestors.at(-1) ?? null;
    const isNarrative = section.kind === 'narrative';
    announce(section, sentences, isNarrative && parent !== previousParent ? parent : null);
    if (isNarrative) previousParent = parent;

    for (const rule of Object.keys(stats) as NarrationRule[]) total[rule] += stats[rule];
    return {
      ...section,
      sentences,
      characterCount: sentences.reduce((n, s) => n + s.narration.length, 0),
      narrationStats: stats,
    };
  });

  return { sections: narrated, stats: total };
}

function narrationFor(
  block: BlockText,
  start: number,
  end: number,
  rules: NarrationOptions,
  stats: NarrationStats,
  vocabulary: ReadonlySet<string>,
): string {
  // N1: las marcas de llamada a nota ("¹", "[3]") no se leen.
  let text = '';
  let cursor = start;
  for (const [noteStart, noteEnd] of block.noteRanges) {
    if (noteEnd <= start || noteStart >= end) continue;
    text += block.text.slice(cursor, Math.max(cursor, noteStart));
    cursor = Math.min(end, noteEnd);
  }
  text += block.text.slice(cursor, end);

  const steps: Array<[boolean, NarrationRule, (t: string) => { text: string; removed: number }]> = [
    [rules.legal, 'N5_legal', removeLegal],
    [rules.dois, 'N2_dois', removeDois],
    [rules.urls, 'N3_urls', removeUrls],
    [rules.citations, 'N4_citations', removeCitations],
  ];
  for (const [enabled, rule, apply] of steps) {
    if (!enabled || !text) continue;
    const result = apply(text);
    text = result.text;
    stats[rule] += result.removed;
  }
  return normalizeNarration(text, vocabulary);
}

/**
 * Tramos de voz de una oración con diálogo. Cada tramo pasa por las mismas reglas que la
 * oración entera (sus estadísticas no se cuentan dos veces); los tramos contiguos del
 * mismo tipo se unen. undefined si la oración es toda narración.
 */
function voicesFor(
  block: BlockText,
  start: number,
  end: number,
  dialogue: Array<[number, number]>,
  rules: NarrationOptions,
  vocabulary: ReadonlySet<string>,
): VoicePart[] | undefined {
  if (!dialogue.some(([a, b]) => b > start && a < end)) return undefined;
  // "(Al decir esto, hizo un gesto…)": una oración entre paréntesis es del narrador.
  if (/^\s*\(.*\)[.…]?\s*$/su.test(block.text.slice(start, end))) return undefined;
  const parts: VoicePart[] = [];
  for (const part of splitByVoice(block.text, start, end, dialogue)) {
    const text = narrationFor(
      block,
      part.start,
      part.end,
      rules,
      emptyNarrationStats(),
      vocabulary,
    );
    if (!text) continue;
    const last = parts.at(-1);
    if (last?.kind === part.kind) last.text += ` ${text}`;
    else parts.push({ kind: part.kind, text });
  }
  return parts.some((p) => p.kind === 'dialogue') ? parts : undefined;
}

/**
 * La primera oración narrada anuncia el capítulo ("Segunda parte. Capítulo 74. De cómo…").
 *
 * Los encabezados del inicio que repiten el título o la parte ("A Scandal in Bohemia" +
 * "I") se silencian: el anuncio ya los dice. La búsqueda atraviesa bloques cortos, como
 * el subtítulo de una portadilla ("With Strictures on…"), y se detiene en el primer
 * párrafo de texto corrido. Si el primer bloque es uno de esos encabezados, el anuncio
 * ocupa su lugar (y el lector lo resalta); si no, se agrega una oración sintética al
 * principio, sin bloque (`blockIndex = -1`). Los encabezados que no coinciden (un
 * subtítulo propio) y los bloques cortos se siguen narrando.
 */
function announce(section: CleanedSection, sentences: Sentence[], parent: string | null): void {
  const announcement = announcementFor(section.title, parent);
  const references = [section.title, ...section.ancestors];

  const repeated = new Set<number>();
  for (const [index, block] of section.blocks.slice(0, MAX_LEADING_BLOCKS).entries()) {
    const text = collapsedText(block);
    if (!HEADING.test(tagName(block))) {
      if (text.length > SHORT_BLOCK_CHARS) break;
      continue;
    }
    if (references.some((ref) => matchesTitle(text, ref))) repeated.add(index);
  }
  for (const sentence of sentences) {
    if (!repeated.has(sentence.blockIndex)) continue;
    sentence.narration = '';
    delete sentence.voices;
  }

  const first = sentences[0];
  if (first && repeated.has(0) && first.blockIndex === 0) {
    first.narration = announcement;
    delete first.voices;
    return;
  }
  sentences.unshift({
    index: 0,
    blockIndex: -1,
    start: 0,
    end: 0,
    text: '',
    narration: announcement,
  });
  sentences.forEach((s, i) => (s.index = i));
}

/** El encabezado repite el título (quizá abreviado o en otra forma: "I" vs "Capítulo I"). */
function matchesTitle(heading: string, title: string): boolean {
  const simplify = (t: string) =>
    normalizeTitle(t)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  const [a, b] = [simplify(heading), simplify(title)];
  // Por palabras completas: "i" no debe coincidir dentro de "a vindication".
  const contains = (outer: string, inner: string) => ` ${outer} `.includes(` ${inner} `);
  return a !== '' && b !== '' && (contains(a, b) || contains(b, a));
}

function isSilent(block: Element): boolean {
  for (let node: Element | null = block; node; node = node.parentElement) {
    const tag = tagName(node);
    if (SILENT_BLOCKS.has(tag) || tag === 'table') return true;
    if (tag === 'section') break;
  }
  return false;
}

function emptyNarrationStats(): NarrationStats {
  return { N1_noterefs: 0, N2_dois: 0, N3_urls: 0, N4_citations: 0, N5_legal: 0 };
}
