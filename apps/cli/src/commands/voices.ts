import { MsEdgeTTS } from 'msedge-tts';
import { DEFAULT_VOICES } from '../tts/edge-tts.adapter.js';
import { style } from '../ui/terminal.js';

/** Lista las voces de Edge TTS, filtradas por idioma o región ("es", "es-CL", "en-GB"). */
export async function voices(filter?: string): Promise<void> {
  const all = await new MsEdgeTTS().getVoices();
  const prefix = (filter ?? '').toLowerCase();
  const matching = all
    .filter((v) => v.Locale.toLowerCase().startsWith(prefix))
    .sort((a, b) => a.Locale.localeCompare(b.Locale) || a.ShortName.localeCompare(b.ShortName));
  const defaults = new Set(Object.values(DEFAULT_VOICES));

  for (const voice of matching) {
    const mark = defaults.has(voice.ShortName) ? style.green(' (por defecto)') : '';
    console.log(`${voice.ShortName.padEnd(34)} ${style.gray(voice.Gender.padEnd(7))}${mark}`);
  }
  console.log(
    style.gray(
      `\n${matching.length} voces. Úsalas con: pnpm lectio narrate libro.epub --voice <nombre>`,
    ),
  );
}
