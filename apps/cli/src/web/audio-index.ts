import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { Alignment } from '@lectio/epub-pipeline';
import type { ManifestEntry } from '../commands/narrate.js';
import { findProfile, profilesFor, resolveVoice } from '../tts/voices.js';

/** Audio de un capítulo con una voz, tal como lo usa el reproductor. */
export interface ChapterAudio {
  /** Ruta relativa al preview (el MP3 no se incrusta: pesaría decenas de MB). */
  src: string;
  durationMs: number;
  voice: string;
  label: string;
  approximate: boolean;
  /** [índice de oración, inicio ms, fin ms]. */
  sentences: Array<[number, number, number]>;
}

/** Por capítulo (orderIndex), su audio en cada voz generada. */
export type AudioIndex = Map<number, Record<string, ChapterAudio>>;

/**
 * Audio generado de un libro: `audio/<voz>/manifest.json` por cada voz (y
 * `audio/manifest.json`, la carpeta de antes, si existe). Se ignoran los capítulos
 * narrados con otra versión del pipeline (sus índices de oración podrían no coincidir
 * con el texto actual) y los de un perfil cuya prosodia cambió desde entonces: ese audio
 * ya no suena como la voz elegida, y se genera de nuevo al pedirlo.
 */
export async function loadAudioIndex(
  pipelineVersion: number,
  previewDir: string,
  audioRoot: string,
): Promise<AudioIndex> {
  const index: AudioIndex = new Map();
  if (!existsSync(audioRoot)) return index;
  const folders = [
    audioRoot,
    ...(await readdir(audioRoot, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => join(audioRoot, e.name)),
  ];
  for (const dir of folders) {
    const manifestPath = join(dir, 'manifest.json');
    if (!existsSync(manifestPath)) continue;
    const { chapters } = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      chapters: ManifestEntry[];
    };
    for (const entry of chapters) {
      if (entry.pipelineVersion !== pipelineVersion) continue;
      const profile = findProfile(entry.voice);
      if (profile && entry.rate !== resolveVoice(profile.id, profile.language).prosodyKey) continue;
      const alignmentPath = join(dir, entry.alignment);
      if (!existsSync(alignmentPath) || !existsSync(join(dir, entry.audio))) continue;
      const alignment = JSON.parse(await readFile(alignmentPath, 'utf8')) as Alignment;
      const path = relative(previewDir, join(dir, entry.audio)).split(/[\\/]/);
      const voices = index.get(entry.orderIndex) ?? {};
      voices[entry.voice] = {
        src: path.map(encodeURIComponent).join('/'),
        durationMs: alignment.durationMs,
        voice: entry.voice,
        label: profile?.name ?? entry.voice.replace(/Neural$/, ''),
        approximate: alignment.approximate,
        sentences: alignment.sentences.map((s) => [s.index, s.startMs, s.endMs]),
      };
      index.set(entry.orderIndex, voices);
    }
  }
  return index;
}

/**
 * Voces que ofrece el reproductor: los perfiles del idioma (por defecto primero) y
 * cualquier otra voz con la que ya haya audio generado.
 */
export function voiceChoices(language: string, index: AudioIndex) {
  const choices = profilesFor(language).map((p) => ({
    id: p.id,
    name: p.name,
    profile: true,
  }));
  for (const voices of index.values()) {
    for (const audio of Object.values(voices)) {
      if (choices.some((c) => c.id === audio.voice)) continue;
      choices.push({
        id: audio.voice,
        name: audio.label,
        profile: false,
      });
    }
  }
  return choices;
}
