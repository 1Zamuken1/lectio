import type { TtsProvider, TtsResult } from '@lectio/epub-pipeline';

/**
 * Trama MP3 de silencio digital en el formato de Edge (MPEG-2 capa III, 48 kbps, 24 kHz,
 * mono, sin CRC): 144 bytes y 24 ms. Cabecera FF F3 64 C0; el resto en cero no tiene
 * coeficientes y el decodificador produce silencio exacto (ver mp3Silence).
 */
const FRAME = Buffer.alloc(144);
Buffer.from([0xff, 0xf3, 0x64, 0xc0]).copy(FRAME);
const FRAME_MS = 24;

/**
 * Proveedor sin red: devuelve silencio con una duración proporcional al texto. Sirve para
 * los tests y para desarrollar sin depender de Edge (TTS_PROVIDER=silent). El audio es un
 * MP3 válido, así que el montaje, la alineación y el reproductor funcionan igual.
 *
 * `failWhen`: para probar los fallos, el texto que hace fallar la síntesis.
 */
export class SilentTtsProvider implements TtsProvider {
  readonly name = 'silent';
  readonly maxChunkChars = 2500;

  constructor(private readonly options: { msPerChar?: number; failWhen?: RegExp } = {}) {}

  async synthesize(input: { text: string }): Promise<TtsResult> {
    if (this.options.failWhen?.test(input.text)) {
      throw new Error('Síntesis fallida (proveedor silencioso, a pedido del test).');
    }
    const frames = Math.max(
      1,
      Math.round((input.text.length * (this.options.msPerChar ?? 60)) / FRAME_MS),
    );
    return {
      audio: Buffer.concat(Array.from({ length: frames }, () => FRAME)),
      durationMs: frames * FRAME_MS,
      boundaries: [],
    };
  }

  close(): void {}
}
