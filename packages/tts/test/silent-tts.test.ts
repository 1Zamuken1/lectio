import { describe, expect, it } from 'vitest';
import { mp3DurationMs, mp3Frames } from '../src/mp3.js';
import { renderUnits } from '../src/montage.js';
import { SilentTtsProvider } from '../src/silent-tts.adapter.js';

describe('SilentTtsProvider', () => {
  it('devuelve un MP3 válido con la duración proporcional al texto', async () => {
    const provider = new SilentTtsProvider({ msPerChar: 48 });
    const result = await provider.synthesize({ text: 'x'.repeat(10) });
    expect(result.durationMs).toBe(480);
    expect(mp3Frames(result.audio)).toHaveLength(20);
    expect(mp3DurationMs(result.audio)).toBe(480);
  });

  it('sirve para el montaje completo: pausas y alineación', async () => {
    const { audio, alignment } = await renderUnits(
      [
        { sentence: 0, kind: 'narration', text: 'Primera oración.', pauseAfter: 'sentence' },
        { sentence: 1, kind: 'dialogue', text: '¿Segunda?', pauseAfter: 'none' },
      ],
      { provider: new SilentTtsProvider(), voice: 'x', language: 'es', concurrency: 2 },
    );
    expect(alignment.sentences.map((s) => s.index)).toEqual([0, 1]);
    expect(alignment.durationMs).toBe(Math.round(mp3DurationMs(audio)));
  });

  it('falla a pedido', async () => {
    const provider = new SilentTtsProvider({ failWhen: /FALLA/ });
    await expect(provider.synthesize({ text: 'esto FALLA' })).rejects.toThrow(/fallida/);
  });
});
