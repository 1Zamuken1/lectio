import type { WorldId } from '../theme/worlds';

/**
 * Lo que dice el compañero de la sala, con la voz de cada mundo. Las salas y el estudio
 * escriben sus avisos en el tono neutro de siempre (el de Sabio y del Clásico); aquí se
 * reescriben para los compañeros con personalidad propia, como Lumen en el Bosque
 * (curioso, juguetón, frases cortas y entusiastas). `mood` dice cómo reacciona:
 * 'error' lo encoge un momento; lo demás, voltereta con chispas.
 */
export interface CompanionLine {
  text: string;
  mood: 'happy' | 'error';
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

type Rule = [RegExp, (m: RegExpMatchArray) => string, CompanionLine['mood']?];

/** Los avisos que son errores (para el tono y para que el compañero se encoja). */
const ERRORS =
  /DRM|no es un EPUB|no es un EPUB válido|No encontramos|No pudimos|No pude|demasiado|Algo falló|muy rápido|Hay audio generándose/i;

const LUMEN: Rule[] = [
  [
    /^Elige un libro de la estantería\. Aquí se lee y se escucha sin cuenta\.$/,
    () => '¡Hola! Elige el libro que quieras: aquí se lee y se escucha sin cuenta.',
  ],
  [/^Aquí no hay libros todavía\.$/, () => 'Mmm… todavía no hay libros por aquí.'],
  [/^«(.+)»\. Buena elección\.$/, (m) => `¡Uy, «${m[1]}»! Tiene buena pinta. ¿Lo abrimos?`],
  [
    /^«(.+)»\. Sigamos donde lo dejaste\.$/,
    (m) => `¡«${m[1]}»! Seguimos donde lo dejaste, ¿vamos?`,
  ],
  [/^«(.+)»\. Aún sin abrir\.$/, (m) => `«${m[1]}»… ¡todavía sin estrenar! ¿Lo empezamos?`],
  [
    /^«(.+)»\. (Cap\. .+|Al comienzo .+)$/,
    (m) => `«${m[1]}»: ${lowerFirst(m[2] ?? '')}. ¡Sigamos!`,
  ],
  [
    /^Aún lo estoy preparando: en unos segundos estará listo\.$/,
    () => '¡Lo estoy preparando! Unos segunditos y está listo.',
  ],
  [/^Tus libros, a mano\.$/, () => '¡Tus libros! Todos a mano.'],
  [/^Aquí va tu primer libro\.$/, () => '¡Este rincón espera tu primer libro!'],
  [/^«(.+)» ya está en tu repisa\.$/, (m) => `¡Listo! «${m[1]}» ya está en tu repisa.`],
  [/^Subiendo «(.+)»…$/, (m) => `¡Allá va «${m[1]}»!`],
  [
    /^¡Recibido! Lo estoy preparando: en unos segundos estará en tu repisa\.$/,
    () => '¡Lo tengo! Lo preparo y en unos segundos está en tu repisa.',
  ],
  [/^Ya tienes este libro: aquí está\.$/, () => '¡Este ya lo tienes! Mira, aquí está.'],
  [/^Quité «(.+)» de tu estudio\.$/, (m) => `¡Fuera! Quité «${m[1]}» de tu estudio.`],
  [/^Quité el libro de tu estudio\.$/, () => '¡Fuera! Quité el libro de tu estudio.'],
  [/^Listo, sigue en tu repisa\.$/, () => '¡Uf, de vuelta! Sigue en tu repisa.'],
  [
    /^Sin conexión: te muestro los libros de tu última visita\.$/,
    () => 'Sin conexión… pero te muestro los libros de tu última visita.',
  ],
  [/^Sin conexión por ahora\.$/, () => 'Sin conexión por ahora. ¡Te espero aquí!'],
  [
    /^Hay audio generándose para ese libro: espera a que termine y vuelve a quitarlo\.$/,
    () => 'Espera un poquito: estoy grabando audio de ese libro. Cuando termine, lo quitamos.',
    'error',
  ],
];

const VOICES: Partial<Record<WorldId, Rule[]>> = { bosque: LUMEN };

export function companionLine(world: WorldId, text: string): CompanionLine {
  const mood: CompanionLine['mood'] = ERRORS.test(text) ? 'error' : 'happy';
  const rules = VOICES[world];
  if (!rules) return { text, mood };
  for (const [pattern, write, ruleMood] of rules) {
    const match = text.match(pattern);
    if (match) return { text: write(match), mood: ruleMood ?? mood };
  }
  // Los errores sin frase propia: con un "Ay…" delante, que es como suena Lumen.
  if (mood === 'error') return { text: `Ay… ${lowerFirst(text)}`, mood };
  return { text, mood };
}
