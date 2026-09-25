import { describe, expect, it } from 'vitest';
import { cleanSections, narrateSections, openEpub, readStructure } from '../../../src/index.js';
import { dialogueRanges } from '../../../src/narration/dialogue.js';
import { buildEpub } from '../../helpers/build-epub.js';

const pieces = (text: string, language = 'es') =>
  dialogueRanges(text, language).map(([a, b]) => text.slice(a, b));

/** Tramos de voz de cada oración de un capítulo con un solo cuerpo. */
async function voicesOf(body: string) {
  const opened = await openEpub(await buildEpub({ chapters: [{ id: 'c', title: 'Cap', body }] }));
  const cleaned = cleanSections(readStructure(opened), opened.archive).sections;
  const [section] = narrateSections(cleaned, 'es').sections;
  return section!.sentences
    .filter((s) => s.blockIndex >= 0)
    .map((s) => s.voices?.map((v) => `${v.kind === 'dialogue' ? 'D' : 'N'}: ${v.text}`) ?? null);
}

describe('diálogo con raya', () => {
  it('alterna parlamento y acotación; la puntuación de cierre va con la acotación', () => {
    expect(pieces('—Vamos —dijo el viajero—, humanidad tenemos.')).toEqual([
      'Vamos ',
      ' humanidad tenemos.',
    ]);
  });

  it('una acotación al final del párrafo no lleva raya de cierre', () => {
    expect(pieces('—¿Qué llevas ahí? —preguntó con voz grave.')).toEqual(['¿Qué llevas ahí? ']);
  });

  it('tras la acotación cerrada con punto, sigue el parlamento', () => {
    expect(pieces('—No —dijo él—. Mañana será otro día.')).toEqual([
      'No ',
      ' Mañana será otro día.',
    ]);
  });

  it('acepta el "--" de Gutenberg y el guion pegado al inicio', () => {
    expect(pieces('--Buenas noches --dijo--.')).toEqual(['Buenas noches ']);
    expect(pieces('-Hola, chico -dijo-. ¿Vienes?')).toEqual(['Hola, chico ', ' ¿Vienes?']);
    expect(pieces('-Es un acuerdo franco-alemán.')).toEqual(['Es un acuerdo franco-alemán.']);
  });

  it('un párrafo sin raya inicial no es diálogo, aunque tenga incisos', () => {
    expect(pieces('El viajero —cansado ya— siguió su camino.')).toEqual([]);
  });

  it('en inglés la raya inicial atribuye una cita', () => {
    expect(pieces('—Genesis.', 'en')).toEqual([]);
  });

  it('una semirraya entre cifras es un rango', () => {
    expect(pieces('—Fue en 1914–1918, señor.')).toEqual(['Fue en 1914–1918, señor.']);
  });
});

describe('diálogo entre comillas', () => {
  it('reconoce lo entrecomillado que termina en puntuación o es largo', () => {
    expect(pieces('“Why,” said my wife, “it is Kate.”', 'en')).toEqual(['“Why,”', '“it is Kate.”']);
    expect(pieces('Gritó «ven aquí ahora mismo, chico» y se fue.')).toEqual([
      '«ven aquí ahora mismo, chico»',
    ]);
    expect(pieces('Y el hombre dijo: «Oye, chico, ¿qué llevas ahí?».')).toEqual([
      '«Oye, chico, ¿qué llevas ahí?»',
    ]);
    expect(pieces('He said, “I will not go,” and left.')).toEqual(['“I will not go,”']);
  });

  it('un término o un apodo entre comillas no es diálogo', () => {
    expect(pieces('Lo llamaban «el Doctor» en el pueblo.')).toEqual([]);
    expect(pieces('Los halagos del «aura de aplausos» que acompaña.')).toEqual([]);
  });
});

describe('tramos de voz por oración', () => {
  it('parte la oración en narración y diálogo, con el texto ya normalizado', async () => {
    expect(await voicesOf('<p>—Vamos —dijo el viajero—, humanidad tenemos.</p>')).toEqual([
      ['D: Vamos', 'N: dijo el viajero,', 'D: humanidad tenemos.'],
    ]);
  });

  it('el estado del párrafo sigue en sus oraciones siguientes', async () => {
    expect(await voicesOf('<p>—¡Nada, señor! Solo unas piedras —respondió el niño.</p>')).toEqual([
      ['D: ¡Nada, señor!'],
      ['D: Solo unas piedras', 'N: respondió el niño.'],
    ]);
  });

  it('una oración entre paréntesis dentro de un parlamento es del narrador', async () => {
    expect(
      await voicesOf('<p>—¿Pero qué más da? (Al decir esto, hizo un gesto). Adelante.</p>'),
    ).toEqual([['D: ¿Pero qué más da?'], null, ['D: Adelante.']]);
  });

  it('una oración sin diálogo no tiene tramos', async () => {
    expect(
      await voicesOf('<p>Se puso el sol. Tras el breve crepúsculo vino la noche.</p>'),
    ).toEqual([null, null]);
  });
});
