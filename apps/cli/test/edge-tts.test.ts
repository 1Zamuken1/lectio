import { processEpub } from '@lectio/epub-pipeline';
import { describe, expect, it } from 'vitest';
import { buildEpub } from '../../../packages/epub-pipeline/test/helpers/build-epub.js';
import { selectChapters } from '../src/commands/narrate.js';
import { speechSpan, wordBoundaries } from '../src/tts/edge-tts.adapter.js';

/** Mensaje de metadatos como los envía Edge (Offset en unidades de 100 ns). */
const message = (word: string, offsetMs: number) =>
  JSON.stringify(
    {
      Metadata: [
        {
          Type: 'WordBoundary',
          Data: {
            Offset: offsetMs * 10_000,
            Duration: 3_000_000,
            text: { Text: word, Length: word.length },
          },
        },
      ],
    },
    null,
    2,
  );

describe('wordBoundaries (metadatos de Edge TTS)', () => {
  it('ubica cada palabra en el texto enviado y convierte el tiempo a ms', () => {
    const text = 'Se puso el sol.';
    const metadata = ['Se', 'puso', 'el', 'sol'].map((w, i) => message(w, 100 + i * 300));

    expect(wordBoundaries(metadata, text)).toEqual([
      { textOffset: 0, textLength: 2, audioOffsetMs: 100, durationMs: 300 },
      { textOffset: 3, textLength: 4, audioOffsetMs: 400, durationMs: 300 },
      { textOffset: 8, textLength: 2, audioOffsetMs: 700, durationMs: 300 },
      { textOffset: 11, textLength: 3, audioOffsetMs: 1000, durationMs: 300 },
    ]);
  });

  it('el habla va del inicio de la primera palabra al fin de la última, aunque no se ubique', () => {
    // "1914" llega como otra palabra: no se ubica en el texto, pero cuenta para el recorte.
    const metadata = [message('Fue', 95), message('mil', 400)];
    expect(wordBoundaries(metadata, 'Fue 1914.')).toHaveLength(1);
    expect(speechSpan(metadata)).toEqual({ startMs: 95, endMs: 700 });
    expect(speechSpan([])).toBeNull();
  });

  it('las palabras repetidas se ubican en orden, no siempre en la primera aparición', () => {
    const text = 'la casa y la calle';
    const metadata = ['la', 'casa', 'y', 'la', 'calle'].map((w, i) => message(w, i * 100));

    expect(wordBoundaries(metadata, text).map((b) => b.textOffset)).toEqual([0, 3, 8, 10, 13]);
  });

  it('una palabra que el motor normalizó no genera marca ni desordena las siguientes', () => {
    const text = 'Llegó en 1605 a Madrid.';
    const metadata = ['Llegó', 'en', 'mil seiscientos cinco', 'a', 'Madrid'].map((w, i) =>
      message(w, i * 200),
    );

    expect(
      wordBoundaries(metadata, text).map((b) =>
        text.slice(b.textOffset, b.textOffset + b.textLength),
      ),
    ).toEqual(['Llegó', 'en', 'a', 'Madrid']);
  });

  it('tolera llaves y comillas dentro del texto de una palabra, y mensajes corruptos', () => {
    const text = 'dijo "}" y siguió';
    // Un mensaje cortado no debe arrastrar a los siguientes.
    const metadata = [message('dijo', 0), '{"roto": ', message('}', 100), message('siguió', 300)];

    expect(wordBoundaries(metadata, text).map((b) => b.audioOffsetMs)).toEqual([0, 100, 300]);
  });

  it('si llegan varios objetos pegados en un mismo mensaje, también los separa', () => {
    const text = 'Se puso el sol.';
    const joined = ['Se', 'puso'].map((w, i) => message(w, i * 300)).join('');

    expect(wordBoundaries([joined], text).map((b) => b.textOffset)).toEqual([0, 3]);
  });
});

describe('selectChapters', () => {
  it('por defecto elige los capítulos narrativos; con lista, los números de "inspect"', async () => {
    const book = await processEpub(
      await buildEpub({
        chapters: Array.from({ length: 5 }, (_, i) => ({
          id: `c${i}`,
          title: `Capítulo ${i}`,
          body: `<p>${'Texto del capítulo. '.repeat(20)}</p>`,
        })),
      }),
    );

    expect(selectChapters(book).map((c) => c.orderIndex)).toEqual([0, 1, 2, 3, 4]);
    expect(selectChapters(book, '1-2,4').map((c) => c.orderIndex)).toEqual([1, 2, 4]);
    expect(selectChapters(book, '3').map((c) => c.orderIndex)).toEqual([3]);
    expect(selectChapters(book, '99')).toEqual([]);
  });
});
