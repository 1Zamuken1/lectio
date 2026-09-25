import { MsEdgeTTS } from 'msedge-tts';
import { DEFAULT_PROFILES, DEFAULT_VOICES, VOICE_PROFILES } from '../tts/voices.js';
import { style } from '../ui/terminal.js';

/**
 * Primero los perfiles de Lectio (voz + prosodia de narración y diálogo); después, las
 * voces de Edge TTS filtradas por idioma o región ("es", "es-CL", "en-GB"), que también
 * se pueden usar directamente, sin contraste entre narración y diálogo.
 */
export async function voices(filter?: string): Promise<void> {
  const prefix = (filter ?? '').toLowerCase();
  const defaults = new Set([...Object.values(DEFAULT_PROFILES), ...Object.values(DEFAULT_VOICES)]);
  const mark = (id: string) => (defaults.has(id) ? style.green(' (por defecto)') : '');

  const profiles = VOICE_PROFILES.filter((p) => p.voice.toLowerCase().startsWith(prefix));
  if (profiles.length > 0) {
    console.log(
      style.bold('Voces de Lectio') + style.gray(' · narración y diálogo con tonos distintos'),
    );
    for (const profile of profiles) {
      console.log(
        `  ${profile.id.padEnd(14)} ${profile.name.padEnd(14)} ${style.gray(profile.description)}${mark(profile.id)}`,
      );
    }
    console.log('');
  }

  const all = await new MsEdgeTTS().getVoices();
  const matching = all
    .filter((v) => v.Locale.toLowerCase().startsWith(prefix))
    .sort((a, b) => a.Locale.localeCompare(b.Locale) || a.ShortName.localeCompare(b.ShortName));
  console.log(style.bold('Voces de Edge') + style.gray(' · una sola prosodia'));
  for (const voice of matching) {
    console.log(
      `  ${voice.ShortName.padEnd(34)} ${style.gray(voice.Gender.padEnd(7))}${mark(voice.ShortName)}`,
    );
  }
  console.log(
    style.gray(
      `\n${profiles.length} perfiles y ${matching.length} voces. Úsalas con: pnpm lectio narrate libro.epub --voice <nombre>`,
    ),
  );
}
