import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ManifestEntry } from '../src/commands/narrate.js';
import { resolveVoice } from '../src/tts/voices.js';
import { loadAudioIndex, voiceChoices } from '../src/web/audio-index.js';

let root: string;

afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

/** Carpeta de una voz con un capítulo narrado. */
async function voiceFolder(
  dir: string,
  voice: string,
  orderIndex: number,
  pipelineVersion = 1,
  rate = resolveVoice(voice, 'es').prosodyKey,
) {
  await mkdir(dir, { recursive: true });
  const entry: ManifestEntry = {
    orderIndex,
    title: 'Cap',
    audio: '004 - Cap.mp3',
    alignment: '004 - Cap.alignment.json',
    durationMs: 1000,
    characters: 10,
    voice,
    voiceLabel: voice,
    rate,
    provider: 'edge',
    pipelineVersion,
  };
  await writeFile(join(dir, entry.audio), 'mp3');
  await writeFile(
    join(dir, entry.alignment),
    JSON.stringify({
      version: 1,
      durationMs: 1000,
      approximate: false,
      sentences: [{ index: 0, startMs: 0, endMs: 1000 }],
    }),
  );
  await writeFile(join(dir, 'manifest.json'), JSON.stringify({ version: 1, chapters: [entry] }));
}

describe('loadAudioIndex', () => {
  it('reúne el audio de cada voz por capítulo, con rutas relativas al preview', async () => {
    root = await mkdtemp(join(tmpdir(), 'lectio-'));
    const audio = join(root, 'audio');
    await voiceFolder(join(audio, 'gonzalo'), 'gonzalo', 4);
    await voiceFolder(join(audio, 'jorge'), 'jorge', 4);
    await voiceFolder(join(audio, 'salome'), 'salome', 5, 0); // otra versión del pipeline

    const index = await loadAudioIndex(1, root, audio);
    expect([...index.keys()]).toEqual([4]);
    expect(Object.keys(index.get(4)!).sort()).toEqual(['gonzalo', 'jorge']);
    expect(index.get(4)!.jorge).toMatchObject({
      src: 'audio/jorge/004%20-%20Cap.mp3',
      label: 'Jorge',
      sentences: [[0, 0, 1000]],
    });
  });

  it('descarta el audio de un perfil cuya prosodia cambió', async () => {
    root = await mkdtemp(join(tmpdir(), 'lectio-'));
    await voiceFolder(
      join(root, 'audio', 'jorge'),
      'jorge',
      4,
      1,
      'narración +26%/-7% · diálogo +20%/+10%',
    );
    expect((await loadAudioIndex(1, root, join(root, 'audio'))).size).toBe(0);
  });

  it('lee también la carpeta de antes (audio/manifest.json) y ofrece sus voces', async () => {
    root = await mkdtemp(join(tmpdir(), 'lectio-'));
    await voiceFolder(join(root, 'audio'), 'es-CO-GonzaloNeural', 4);

    const index = await loadAudioIndex(1, root, join(root, 'audio'));
    expect(index.get(4)!['es-CO-GonzaloNeural']!.src).toBe('audio/004%20-%20Cap.mp3');
    const choices = voiceChoices('es', index);
    expect(choices.map((c) => c.id)).toEqual([
      'gonzalo',
      'jorge',
      'salome',
      'salome-grave',
      'es-CO-GonzaloNeural',
    ]);
    expect(choices.at(-1)!.profile).toBe(false);
  });
});
