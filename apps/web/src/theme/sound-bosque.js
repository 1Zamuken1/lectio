// Lectio · el sonido del Bosque élfico (docs/lectio-temas.md §7.5): arpa, flauta y cristal,
// sintetizados con Web Audio como el Scriptorium. Cada efecto suena con la materia de lo que
// pasa (lianas, hojas secas, madera de raíz); la música es un arpa en fa lidio con frases de
// flauta a ratos, más lenta y grave de noche, con pajaritos de día y grillos de noche.
//
// Todo recibe `a` = { ctx, sfx, music } (el contexto y los buses de sound.js).

const midi = (note) => 440 * 2 ** ((note - 69) / 12);

/** Ruido blanco (se reutiliza: soplo de la flauta, hojas, lianas). */
let noiseBuffer = null;
function noise(a) {
  if (!noiseBuffer || noiseBuffer.sampleRate !== a.ctx.sampleRate) {
    const length = a.ctx.sampleRate;
    noiseBuffer = a.ctx.createBuffer(1, length, a.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  const source = a.ctx.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = true;
  return source;
}

/**
 * Cuerda de arpa pellizcada: fundamental en triángulo, la octava en seno y un filtro que se
 * cierra con la caída (el brillo del pellizco se apaga antes que la nota).
 */
function harp(a, { note, start, duration = 1.2, gain = 0.1, bus = a.sfx }) {
  const { ctx } = a;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.linearRampToValueAtTime(gain, start + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(Math.min(9000, midi(note) * 8), start);
  lowpass.frequency.exponentialRampToValueAtTime(Math.max(300, midi(note) * 1.5), start + duration);
  lowpass.connect(env).connect(bus);
  for (const [type, ratio, level] of [
    ['triangle', 1, 1],
    ['sine', 2, 0.35],
  ]) {
    const osc = ctx.createOscillator();
    const partial = ctx.createGain();
    osc.type = type;
    osc.frequency.value = midi(note) * ratio;
    partial.gain.value = level;
    osc.connect(partial).connect(lowpass);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }
}

/** Flauta: seno con vibrato que entra tarde y un soplo de aire al empezar la nota. */
function flute(a, { note, start, duration, gain = 0.05, bus = a.sfx }) {
  const { ctx } = a;
  const end = start + duration;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.linearRampToValueAtTime(gain, start + 0.09);
  env.gain.setValueAtTime(gain * 0.85, Math.max(start + 0.1, end - 0.18));
  env.gain.exponentialRampToValueAtTime(0.0001, end);
  env.connect(bus);
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = midi(note);
  const vibrato = ctx.createOscillator();
  const depth = ctx.createGain();
  vibrato.frequency.value = 5.2;
  depth.gain.setValueAtTime(0, start);
  depth.gain.linearRampToValueAtTime(midi(note) * 0.006, start + Math.min(0.45, duration * 0.6));
  vibrato.connect(depth).connect(osc.frequency);
  const body = ctx.createGain();
  body.gain.value = 1;
  const overtone = ctx.createOscillator();
  const overtoneLevel = ctx.createGain();
  overtone.type = 'sine';
  overtone.frequency.value = midi(note) * 2;
  overtoneLevel.gain.value = 0.12;
  osc.connect(body).connect(env);
  overtone.connect(overtoneLevel).connect(env);
  // El soplo: ruido en banda alrededor de la nota, solo en el ataque.
  const breath = noise(a);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = midi(note) * 2;
  band.Q.value = 2;
  const breathEnv = ctx.createGain();
  breathEnv.gain.setValueAtTime(0.0001, start);
  breathEnv.gain.linearRampToValueAtTime(gain * 0.9, start + 0.03);
  breathEnv.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
  breath.connect(band).connect(breathEnv).connect(bus);
  for (const node of [osc, overtone, vibrato]) {
    node.start(start);
    node.stop(end + 0.05);
  }
  breath.start(start);
  breath.stop(start + 0.25);
}

/** Cristal: parciales inarmónicos agudos que se apagan despacio (campanilla, Lumen). */
function glass(a, { note, start, duration = 1.2, gain = 0.06, bus = a.sfx }) {
  for (const [ratio, level, decay] of [
    [1, 1, 1],
    [2.32, 0.45, 0.6],
    [4.25, 0.2, 0.35],
  ]) {
    const osc = a.ctx.createOscillator();
    const env = a.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = midi(note) * ratio;
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(gain * level, start + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration * decay);
    osc.connect(env).connect(bus);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }
}

/** Ruido filtrado con envolvente (hojas, lianas, roce de la página). */
function hiss(a, { start, duration, gain, from, to, q = 1, type = 'bandpass', bus = a.sfx }) {
  const source = noise(a);
  const filter = a.ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, start);
  filter.frequency.exponentialRampToValueAtTime(to, start + duration);
  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.linearRampToValueAtTime(gain, start + Math.min(0.02, duration / 4));
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(env).connect(bus);
  source.start(start);
  source.stop(start + duration + 0.05);
}

/** Madera de raíz: un "tok" hueco (seno grave que cae rápido) con su chasquido. */
function knock(a, { start, note = 52, gain = 0.2 }) {
  const osc = a.ctx.createOscillator();
  const env = a.ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(midi(note + 7), start);
  osc.frequency.exponentialRampToValueAtTime(midi(note), start + 0.03);
  env.gain.setValueAtTime(0.0001, start);
  env.gain.linearRampToValueAtTime(gain, start + 0.002);
  env.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
  osc.connect(env).connect(a.sfx);
  osc.start(start);
  osc.stop(start + 0.2);
  hiss(a, { start, duration: 0.03, gain: gain * 0.3, from: 2500, to: 1200 });
}

/** Crujido de liana o de madera: una sierra muy filtrada que se queja subiendo o bajando. */
function creak(a, { start, note, duration, slide, gain = 0.04 }) {
  const osc = a.ctx.createOscillator();
  const lowpass = a.ctx.createBiquadFilter();
  const env = a.ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(midi(note), start);
  osc.frequency.linearRampToValueAtTime(midi(note + slide), start + duration);
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 800;
  lowpass.Q.value = 4;
  env.gain.setValueAtTime(0.0001, start);
  env.gain.linearRampToValueAtTime(gain, start + 0.03);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(lowpass).connect(env).connect(a.sfx);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

// ------------------------------------------------------------ efectos

/** Pellizcos de arpa en fa lidio (fa sol la si do re mi). */
export const SFX = {
  select: (t, a) => {
    harp(a, { note: 84, start: t, duration: 0.35, gain: 0.07 });
    harp(a, { note: 88, start: t + 0.04, duration: 0.45, gain: 0.06 });
  },
  toggle: (t, a) => harp(a, { note: 79, start: t, duration: 0.4, gain: 0.08 }),
  open: (t, a) =>
    [77, 81, 84, 88].forEach((note, i) =>
      harp(a, { note, start: t + i * 0.045, duration: 0.6, gain: 0.07 }),
    ),
  confirm: (t, a) => {
    harp(a, { note: 81, start: t, duration: 0.4, gain: 0.07 });
    harp(a, { note: 89, start: t + 0.08, duration: 0.8, gain: 0.07 });
  },
  /** La página: un roce suave, más grave que el pergamino, y una cuerda muy queda. */
  page: (t, a) => {
    hiss(a, { start: t, duration: 0.14, gain: 0.06, from: 1400, to: 3200, q: 0.8 });
    harp(a, { note: 93, start: t + 0.05, duration: 0.3, gain: 0.025 });
  },
  /** Empieza la lectura: un glissando de arpa hacia arriba que termina en flauta. */
  start: (t, a) => {
    [65, 69, 72, 76, 77, 81, 84, 88].forEach((note, i) =>
      harp(a, { note, start: t + i * 0.035, duration: 0.9, gain: 0.05 }),
    );
    flute(a, { note: 84, start: t + 0.3, duration: 0.7, gain: 0.04 });
  },
  /** Risita de Lumen: cuatro notas de cristal que suben rápido (fin de capítulo). */
  hoot: (t, a) =>
    [88, 91, 95, 100].forEach((note, i) =>
      glass(a, { note, start: t + i * 0.07, duration: i === 3 ? 0.9 : 0.4, gain: 0.05 }),
    ),
  /** Lumen se encoge ante un error: dos notas de cristal que bajan. */
  sad: (t, a) => {
    glass(a, { note: 88, start: t, duration: 0.5, gain: 0.04 });
    glass(a, { note: 83, start: t + 0.16, duration: 0.8, gain: 0.035 });
  },
  /** Campanilla de cristal del taller: dos golpes. */
  bell: (t, a) => {
    glass(a, { note: 96, start: t, duration: 1.8, gain: 0.07 });
    glass(a, { note: 91, start: t + 0.42, duration: 2, gain: 0.05 });
  },
  /** El ascensor de lianas: la liana cruje y se estira, la canasta roza y se asienta. */
  door: (t, a) => {
    creak(a, { start: t, note: 47, duration: 0.35, slide: 5 });
    hiss(a, { start: t + 0.05, duration: 0.5, gain: 0.03, from: 500, to: 1200, q: 0.7 });
    creak(a, { start: t + 0.3, note: 54, duration: 0.28, slide: -3, gain: 0.03 });
    knock(a, { start: t + 0.62, note: 45, gain: 0.14 });
  },
  /** El libro se marchita: hojas secas que caen una a una, cada vez más graves. */
  burn: (t, a) => {
    for (let i = 0; i < 8; i++) {
      const at = t + i * 0.14 + Math.random() * 0.05;
      const pitch = 3200 - i * 260;
      hiss(a, { start: at, duration: 0.1, gain: 0.05, from: pitch, to: pitch * 0.6, q: 1.4 });
    }
    harp(a, { note: 53, start: t, duration: 1.4, gain: 0.04 });
  },
  /** Rebrota: el arpa sube con destellos de cristal. */
  reborn: (t, a) => {
    [65, 69, 72, 76, 79, 84].forEach((note, i) =>
      harp(a, { note, start: t + i * 0.06, duration: 0.9, gain: 0.05 }),
    );
    [96, 100].forEach((note, i) =>
      glass(a, { note, start: t + 0.4 + i * 0.09, duration: 0.6, gain: 0.03 }),
    );
  },
  /** La tapa del cofre de raíz: "tok" hueco y su rebote. */
  chest: (t, a) => {
    knock(a, { start: t, note: 50, gain: 0.2 });
    knock(a, { start: t + 0.12, note: 45, gain: 0.1 });
  },
  'chest-soft': (t, a) => {
    knock(a, { start: t, note: 50, gain: 0.09 });
    knock(a, { start: t + 0.12, note: 45, gain: 0.05 });
  },
};

// ------------------------------------------------------------ música
//
// Arpa en fa lidio (el si natural le da el brillo algo mágico): un arpegio que sube y baja
// sobre cada acorde y, cada tanto, una frase corta de flauta que se mueve por grados. De
// noche, más lenta y una tercera menor más grave. La semilla fija hace que siempre suene
// "igual de distinta".

const CHORDS = [
  [53, 57, 60, 64], // Fa maj7
  [55, 59, 62, 66], // Sol (el II mayor del lidio)
  [53, 57, 60, 64], // Fa maj7
  [52, 55, 59, 62], // Mim7
  [50, 53, 57, 60], // Rem7
  [55, 59, 62, 66], // Sol
  [48, 52, 55, 59], // Do maj7
  [53, 57, 60, 64], // Fa maj7
];
// Índices sobre las cuerdas de `rollNotes`.
const ROLL = [0, 1, 2, 3, 4, 3, 2, 1];
const SCALE = [65, 67, 69, 71, 72, 74, 76, 77, 79, 81]; // fa lidio, octava de la flauta

let step = 0;
let nextTime = 0;
let seed = 11;
let phrase = [];
let fluteRest = 0; // corcheas hasta la próxima nota de la frase
let phraseNote = 4;
let nextCritter = 0;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

/** Las cuerdas del arpegio: raíz, quinta, octava, décima, duodécima y la séptima arriba. */
function rollNotes([root, third, fifth, seventh]) {
  return [root, fifth, root + 12, third + 12, fifth + 12, seventh + 12];
}

/** Una frase de flauta de 3 a 5 notas, por grados cerca de la anterior. */
function newPhrase() {
  const notes = [];
  const length = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < length; i++) {
    phraseNote = Math.max(0, Math.min(SCALE.length - 1, phraseNote + Math.floor(rnd() * 5) - 2));
    notes.push({
      note: SCALE[phraseNote],
      beats: i === length - 1 ? 4 : 1 + Math.floor(rnd() * 2),
    });
  }
  return notes;
}

/** Pajaritos (de día): dos a cuatro píos agudos que suben. Grillos (de noche): un trino. */
function critter(a, t, night) {
  const { ctx } = a;
  if (night) {
    const pulses = 6 + Math.floor(rnd() * 6);
    for (let i = 0; i < pulses; i++) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      const at = t + i * 0.045;
      osc.type = 'sine';
      osc.frequency.value = 4400;
      env.gain.setValueAtTime(0.0001, at);
      env.gain.linearRampToValueAtTime(0.008, at + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, at + 0.03);
      osc.connect(env).connect(a.music);
      osc.start(at);
      osc.stop(at + 0.04);
    }
    return;
  }
  const chirps = 2 + Math.floor(rnd() * 3);
  const base = 95 + Math.floor(rnd() * 5);
  for (let i = 0; i < chirps; i++) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const at = t + i * (0.09 + rnd() * 0.05);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(midi(base), at);
    osc.frequency.exponentialRampToValueAtTime(midi(base + 4 + rnd() * 3), at + 0.06);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.linearRampToValueAtTime(0.012, at + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
    osc.connect(env).connect(a.music);
    osc.start(at);
    osc.stop(at + 0.09);
  }
}

export function startMusic(a) {
  nextTime = a.ctx.currentTime + 0.1;
  nextCritter = a.ctx.currentTime + 4;
}

export function scheduleMusic(a, night) {
  const beatLength = 60 / (night ? 56 : 72) / 2; // corcheas
  const shift = night ? -3 : 0;
  while (nextTime < a.ctx.currentTime + 0.25) {
    const bar = Math.floor(step / 8) % CHORDS.length;
    const beat = step % 8;
    const notes = rollNotes(CHORDS[bar]);
    // El bajo del arpa en el primer tiempo, el arpegio en todos.
    if (beat === 0) {
      harp(a, {
        note: CHORDS[bar][0] - 24 + shift,
        start: nextTime,
        duration: beatLength * 8,
        gain: 0.06,
        bus: a.music,
      });
    }
    harp(a, {
      note: notes[ROLL[beat]] + shift,
      start: nextTime,
      duration: beatLength * 5,
      gain: beat === 0 ? 0.055 : 0.04,
      bus: a.music,
    });
    // La flauta: una frase en la segunda mitad de cada cuatro compases, a veces.
    if (bar % 4 === 2 && beat === 0 && !phrase.length && rnd() < 0.75) phrase = newPhrase();
    if (phrase.length && fluteRest <= 0) {
      const { note, beats } = phrase.shift();
      flute(a, {
        note: note + shift,
        start: nextTime,
        duration: beatLength * 2 * beats,
        gain: 0.035,
        bus: a.music,
      });
      fluteRest = beats * 2;
    }
    fluteRest -= 1;
    nextTime += beatLength;
    step++;
  }
  if (a.ctx.currentTime >= nextCritter) {
    critter(a, a.ctx.currentTime + 0.1, night);
    nextCritter = a.ctx.currentTime + (night ? 3 + rnd() * 4 : 6 + rnd() * 8);
  }
}
