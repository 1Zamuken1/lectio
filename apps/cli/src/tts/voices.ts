import type { VoiceKind } from '@lectio/epub-pipeline';

/** Velocidad y tono de un tramo, en el formato de SSML de Edge ("+10%", "-7%"). */
export interface Prosody {
  rate: string;
  pitch: string;
}

/**
 * Perfil de voz: una voz de Edge con una prosodia para la narración y otra para el
 * diálogo (docs/lectio-decision-tts.md §7). Elegidos escuchando muestras:
 * las velocidades igualan el ritmo entre voces, que de fábrica hablan a velocidades
 * muy distintas (Jorge necesita +26 % para sonar como Gonzalo a +6 %).
 */
export interface VoiceProfile {
  id: string;
  name: string;
  description: string;
  voice: string;
  language: string;
  prosody: Record<VoiceKind, Prosody>;
}

export const VOICE_PROFILES: VoiceProfile[] = [
  {
    id: 'gonzalo',
    name: 'Gonzalo',
    description: 'hombre · Colombia',
    voice: 'es-CO-GonzaloNeural',
    language: 'es',
    prosody: {
      narration: { rate: '+6%', pitch: '-7%' },
      dialogue: { rate: '+0%', pitch: '+10%' },
    },
  },
  {
    id: 'jorge',
    name: 'Jorge',
    description: 'hombre · México',
    voice: 'es-MX-JorgeNeural',
    language: 'es',
    prosody: {
      narration: { rate: '+26%', pitch: '-7%' },
      dialogue: { rate: '+20%', pitch: '+10%' },
    },
  },
  {
    // Su voz ya es aguda: subirle el tono en los diálogos sonaba artificial. El contraste
    // se logra con velocidad (y, en la variante, bajando la narración).
    id: 'salome',
    name: 'Salomé',
    description: 'mujer · Colombia',
    voice: 'es-CO-SalomeNeural',
    language: 'es',
    prosody: {
      narration: { rate: '+18%', pitch: '-4%' },
      dialogue: { rate: '+22%', pitch: '+0%' },
    },
  },
  {
    id: 'salome-grave',
    name: 'Salomé grave',
    description: 'mujer · Colombia · narración más grave',
    voice: 'es-CO-SalomeNeural',
    language: 'es',
    prosody: {
      narration: { rate: '+16%', pitch: '-8%' },
      dialogue: { rate: '+16%', pitch: '+0%' },
    },
  },
];

/** Perfil por defecto de cada idioma; sin perfil, se usa una voz de Edge sin contraste. */
export const DEFAULT_PROFILES: Record<string, string> = { es: 'gonzalo' };
export const DEFAULT_VOICES: Record<string, string> = { en: 'en-US-AndrewNeural' };

/**
 * Velocidad para una voz de Edge usada directamente (sin perfil): +12 %, punto medio
 * entre la velocidad natural y 1,25×, elegido tras escuchar capítulos completos.
 */
export const DEFAULT_RATE = '+12%';

export function findProfile(id: string): VoiceProfile | undefined {
  return VOICE_PROFILES.find((p) => p.id === id.toLowerCase());
}

/** Lo que pidió el usuario (perfil o voz de Edge), o lo de por defecto para el idioma. */
export function resolveVoice(
  requested: string | undefined,
  language: string,
  rate: string | undefined,
): { id: string; label: string; voice: string; prosody: Record<VoiceKind, Prosody> } {
  const id =
    requested ?? DEFAULT_PROFILES[language] ?? DEFAULT_VOICES[language] ?? DEFAULT_VOICES.en!;
  const profile = findProfile(id);
  if (profile) {
    return {
      id: profile.id,
      label: `${profile.name} · ${profile.description}`,
      voice: profile.voice,
      prosody: profile.prosody,
    };
  }
  const flat = { rate: rate ?? DEFAULT_RATE, pitch: '+0%' };
  return { id, label: id, voice: id, prosody: { narration: flat, dialogue: flat } };
}
