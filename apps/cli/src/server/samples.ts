import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { VoiceUnit } from '@lectio/epub-pipeline';
import { EdgeTtsProvider } from '../tts/edge-tts.adapter.js';
import { renderUnits } from '../tts/montage.js';
import type { ResolvedVoice } from '../tts/voices.js';

/** Frase de muestra con narración, diálogo y una pregunta: lo que distingue a cada perfil. */
const SAMPLE: Array<Omit<VoiceUnit, 'sentence'>> = [
  { kind: 'dialogue', text: 'Oye, chico,', pauseAfter: 'phrase' },
  { kind: 'narration', text: 'preguntó el viajero,', pauseAfter: 'phrase' },
  { kind: 'dialogue', text: '¿qué llevas ahí?', pauseAfter: 'paragraph' },
  { kind: 'dialogue', text: 'Nada, señor. Solo unas piedras para mi madre.', pauseAfter: 'none' },
];

const pending = new Map<string, Promise<Buffer>>();

/**
 * Muestra de unos 5 s de una voz. Se genera una vez y queda en `<root>/.lectio/samples`;
 * el nombre incluye la prosodia, así que si el perfil cambia se genera de nuevo.
 */
export function voiceSample(root: string, voice: ResolvedVoice): Promise<Buffer> {
  const hash = createHash('sha1')
    .update(voice.voice + voice.prosodyKey)
    .digest('hex')
    .slice(0, 8);
  const path = join(root, '.lectio', 'samples', `${voice.id}-${hash}.mp3`);
  let sample = pending.get(path);
  if (!sample) {
    sample = generate(path, voice).finally(() => pending.delete(path));
    pending.set(path, sample);
  }
  return sample;
}

async function generate(path: string, voice: ResolvedVoice): Promise<Buffer> {
  if (existsSync(path)) return readFile(path);
  const provider = new EdgeTtsProvider({ prosody: voice.prosody, trimSilence: true });
  try {
    const { audio } = await renderUnits(
      SAMPLE.map((unit) => ({ ...unit, sentence: 0 })),
      { provider, voice: voice.voice, language: 'es', concurrency: 2 },
    );
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, audio);
    return audio;
  } finally {
    provider.close();
  }
}
