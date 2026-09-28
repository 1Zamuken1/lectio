import { createHash } from 'node:crypto';
import {
  DEFAULT_PROFILES,
  DEFAULT_VOICES,
  VOICE_PROFILES,
  resolveVoice,
  type ResolvedVoice,
} from '@lectio/tts';
import { VoiceNotAvailableError } from './errors.js';

export interface AvailableVoice {
  id: string;
  name: string;
  language: string;
  isDefault: boolean;
}

/** "es-CO" → "es": los perfiles son por idioma, no por variante. */
export function primaryLanguage(language: string | null): string {
  return (language ?? 'es').split('-')[0]!.toLowerCase();
}

/**
 * Voces que se pueden pedir: los perfiles de Lectio del idioma y, si no hay ninguno, la
 * voz de Edge por defecto de ese idioma (sin contraste de diálogo). Por defecto primero.
 */
export function availableVoices(language?: string): AvailableVoice[] {
  const languages = language
    ? [primaryLanguage(language)]
    : [...new Set([...VOICE_PROFILES.map((p) => p.language), ...Object.keys(DEFAULT_VOICES)])];
  return languages.flatMap((lang) => {
    const profiles = VOICE_PROFILES.filter((p) => p.language === lang);
    if (profiles.length > 0) {
      return profiles
        .map((p) => ({
          id: p.id,
          name: p.name,
          language: lang,
          isDefault: DEFAULT_PROFILES[lang] === p.id,
        }))
        .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
    }
    const voice = DEFAULT_VOICES[lang];
    return voice
      ? [
          {
            id: voice,
            name: voice.split('-')[2]!.replace(/Neural$/, ''),
            language: lang,
            isDefault: true,
          },
        ]
      : [];
  });
}

/** La voz pedida (o la de por defecto del idioma), si está disponible para el libro. */
export function pickVoice(
  requested: string | undefined,
  bookLanguage: string | null,
): ResolvedVoice {
  const language = primaryLanguage(bookLanguage);
  const voices = availableVoices(language);
  const chosen =
    requested === undefined
      ? voices.find((v) => v.isDefault)
      : voices.find((v) => v.id.toLowerCase() === requested.toLowerCase());
  if (!chosen) throw new VoiceNotAvailableError(voices.map((v) => v.id));
  return resolveVoice(chosen.id, language);
}

/** Resumen corto de la prosodia, para nombrar archivos: cambia si el perfil cambia. */
export function voiceVersion(voice: ResolvedVoice): string {
  return createHash('sha256')
    .update(`${voice.voice}|${voice.prosodyKey}`)
    .digest('hex')
    .slice(0, 10);
}
