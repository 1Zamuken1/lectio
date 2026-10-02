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

/** Pol, el dron jardinero (Solarpunk): curioso y científico; todo lo mide y lo anota. */
const POL: Rule[] = [
  [
    /^Elige un libro de la estantería\. Aquí se lee y se escucha sin cuenta\.$/,
    () =>
      'Bip. Pasa el cursor por un libro de luz para verlo; aquí se lee y se escucha sin cuenta.',
  ],
  [/^Aquí no hay libros todavía\.$/, () => 'Registro: cero libros en esta terraza. Por ahora.'],
  [/^«(.+)»\. Buena elección\.$/, (m) => `Analizando «${m[1]}»… resultado: excelente elección.`],
  [
    /^«(.+)»\. Sigamos donde lo dejaste\.$/,
    (m) => `«${m[1]}»: posición guardada. Seguimos donde lo dejaste.`,
  ],
  [/^«(.+)»\. Aún sin abrir\.$/, (m) => `«${m[1]}»: 0 % leído. Semilla lista para germinar.`],
  [
    /^«(.+)»\. (Cap\. .+|Al comienzo .+)$/,
    (m) => `«${m[1]}» — dato: ${lowerFirst(m[2] ?? '')}. Sigamos.`,
  ],
  [
    /^Aún lo estoy preparando: en unos segundos estará listo\.$/,
    () => 'Procesando… unos segundos más y queda listo.',
  ],
  [/^Tus libros, a mano\.$/, () => 'Inventario de tu rincón: todos tus libros, a mano.'],
  [/^Aquí va tu primer libro\.$/, () => 'Este panel espera su primer libro. Bip.'],
  [/^«(.+)» ya está en tu repisa\.$/, (m) => `Entrega confirmada: «${m[1]}» ya está en tu panel.`],
  [/^Subiendo «(.+)»…$/, (m) => `Transmitiendo «${m[1]}»…`],
  [
    /^¡Recibido! Lo estoy preparando: en unos segundos estará en tu repisa\.$/,
    () => 'Recibido. Lo proceso y en unos segundos está en tu panel.',
  ],
  [
    /^Ya tienes este libro: aquí está\.$/,
    () => 'Duplicado detectado: ya tienes este libro. Aquí está.',
  ],
  [/^Quité «(.+)» de tu estudio\.$/, (m) => `Listo: «${m[1]}» fuera de tu rincón.`],
  [/^Quité el libro de tu estudio\.$/, () => 'Listo: el libro salió de tu rincón.'],
  [/^Listo, sigue en tu repisa\.$/, () => 'Restaurado. Sigue en tu panel.'],
  [
    /^Sin conexión: te muestro los libros de tu última visita\.$/,
    () => 'Sin señal. Te muestro los libros de tu última visita.',
  ],
  [/^Sin conexión por ahora\.$/, () => 'Sin señal por ahora. Sigo midiendo.'],
  [
    /^Hay audio generándose para ese libro: espera a que termine y vuelve a quitarlo\.$/,
    () => 'Error 409: hay audio grabándose de ese libro. Cuando termine, lo quitamos.',
    'error',
  ],
];

const VOICES: Partial<Record<WorldId, Rule[]>> = { bosque: LUMEN, solarpunk: POL };

/** Cómo empieza un error sin frase propia, según el compañero. */
const ERROR_PREFIX: Partial<Record<WorldId, string>> = { bosque: 'Ay…', solarpunk: 'Error:' };

export function companionLine(world: WorldId, text: string): CompanionLine {
  const mood: CompanionLine['mood'] = ERRORS.test(text) ? 'error' : 'happy';
  const rules = VOICES[world];
  if (!rules) return { text, mood };
  for (const [pattern, write, ruleMood] of rules) {
    const match = text.match(pattern);
    if (match) return { text: write(match), mood: ruleMood ?? mood };
  }
  // Los errores sin frase propia: "Ay…" con Lumen, "Error:" con Pol.
  if (mood === 'error')
    return { text: `${ERROR_PREFIX[world] ?? ''} ${lowerFirst(text)}`.trim(), mood };
  return { text, mood };
}
