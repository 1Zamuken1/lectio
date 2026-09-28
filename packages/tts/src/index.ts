// @lectio/tts: síntesis de voz para la CLI y el worker (docs/lectio-decision-tts.md §7).
// Node puro, sin NestJS: el adaptador cumple el puerto TtsProvider del pipeline.

export { EdgeTtsProvider, speechSpan, wordBoundaries } from './edge-tts.adapter.js';
export { SilentTtsProvider } from './silent-tts.adapter.js';
export { mapLimit, PAUSES_MS, renderUnits } from './montage.js';
export { mp3DurationMs, mp3Frames, mp3Silence, trimMp3, type Frame } from './mp3.js';
export {
  DEFAULT_PROFILES,
  DEFAULT_RATE,
  DEFAULT_VOICES,
  findProfile,
  profilesFor,
  resolveVoice,
  VOICE_PROFILES,
  type Prosody,
  type ResolvedVoice,
  type VoiceProfile,
} from './voices.js';
