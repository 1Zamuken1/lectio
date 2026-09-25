import type { VoiceKind } from '@lectio/epub-pipeline';

/** Velocidad y tono de un tramo, en el formato de SSML de Edge ("+10%", "-7%"). */
export interface Prosody {
  rate: string;
  pitch: string;
}

/**
 * Perfil de voz: una voz de Edge con una prosodia para la narración y otra para el
 * diálogo (docs/lectio-decision-tts.md §7). Elegidos escuchando muestras: las
 * velocidades igualan el ritmo entre voces, que de fábrica hablan a velocidades muy
 * distintas, y dejan cada voz a su ritmo natural en 1× (la velocidad va en el MP3, así
 * que vale en cualquier reproductor y no estira las pausas).
 */
export interface VoiceProfile {
  id: string;
  name: string;
  /** Solo para la terminal (`lectio voices`); la interfaz muestra el nombre. */
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
    // Antes +26 % / +20 %; a oído, su punto justo era esa versión a 0,85×.
    id: 'jorge',
    name: 'Jorge',
    description: 'hombre · México',
    voice: 'es-MX-JorgeNeural',
    language: 'es',
    prosody: {
      narration: { rate: '+7%', pitch: '-7%' },
      dialogue: { rate: '+2%', pitch: '+10%' },
    },
  },
  {
    // Su voz ya es aguda: subirle el tono en los diálogos sonaba artificial. El contraste
    // se logra con velocidad (y, en la variante, bajando la narración). Velocidades: las
    // de antes a 0,85×, que era como mejor sonaba.
    id: 'salome',
    name: 'Salomé',
    description: 'mujer · Colombia',
    voice: 'es-CO-SalomeNeural',
    language: 'es',
    prosody: {
      narration: { rate: '+0%', pitch: '-4%' },
      dialogue: { rate: '+4%', pitch: '+0%' },
    },
  },
  {
    id: 'salome-grave',
    name: 'Salomé grave',
    description: 'mujer · Colombia · narración más grave',
    voice: 'es-CO-SalomeNeural',
    language: 'es',
    prosody: {
      narration: { rate: '-1%', pitch: '-8%' },
      dialogue: { rate: '-1%', pitch: '+0%' },
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

/** Perfiles para un idioma, por defecto primero. */
export function profilesFor(language: string): VoiceProfile[] {
  const preferred = DEFAULT_PROFILES[language];
  return VOICE_PROFILES.filter((p) => p.language === language).sort(
    (a, b) => Number(b.id === preferred) - Number(a.id === preferred),
  );
}

export interface ResolvedVoice {
  /** Perfil ("gonzalo") o voz de Edge ("en-US-AndrewNeural"): también nombra la carpeta. */
  id: string;
  label: string;
  /** Voz de Edge que se usa. */
  voice: string;
  prosody: Record<VoiceKind, Prosody>;
  /** Resumen de la prosodia: si cambia, el audio generado ya no sirve. */
  prosodyKey: string;
}

/** Lo que pidió el usuario (perfil o voz de Edge), o lo de por defecto para el idioma. */
export function resolveVoice(
  requested: string | undefined,
  language: string,
  rate?: string,
): ResolvedVoice {
  const id =
    requested ?? DEFAULT_PROFILES[language] ?? DEFAULT_VOICES[language] ?? DEFAULT_VOICES.en!;
  const profile = findProfile(id);
  const key = ({ narration, dialogue }: Record<VoiceKind, Prosody>) =>
    `narración ${narration.rate}/${narration.pitch} · diálogo ${dialogue.rate}/${dialogue.pitch}`;
  if (profile) {
    return {
      id: profile.id,
      label: profile.name,
      voice: profile.voice,
      prosody: profile.prosody,
      prosodyKey: key(profile.prosody),
    };
  }
  const flat = { rate: rate ?? DEFAULT_RATE, pitch: '+0%' };
  const prosody = { narration: flat, dialogue: flat };
  return { id, label: id.replace(/Neural$/, ''), voice: id, prosody, prosodyKey: key(prosody) };
}
