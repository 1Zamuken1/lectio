// Lectio · el sonido del Solarpunk (docs/lectio-temas.md §7.8): sintetizador cálido y
// marimba, sintetizados con Web Audio como los otros mundos. Cada efecto suena con la
// materia de lo que pasa (la puerta corrediza, el cortocircuito, la cápsula que se sella);
// Pol habla con bips y trinos de robot. La música: pads tibios, una marimba que arpegia y
// frases cortas de kalimba; de día, pájaros y ráfagas de viento en los aerogeneradores; de
// noche, más lenta y grave, con el zumbido lejano de la ciudad.
//
// Todo recibe `a` = { ctx, sfx, music } (el contexto y los buses de sound.js).

const midi = (note) => 440 * 2 ** ((note - 69) / 12);

/** Ruido blanco (se reutiliza: el "fsss" de la cápsula, el viento, las chispas). */
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
 * Marimba: un seno con el golpe de su cuarto armónico (que se apaga enseguida) y una caída
 * corta. `bright` agrega el brillo de una kalimba (el armónico más alto y más largo).
 */
function marimba(a, { note, start, duration = 0.6, gain = 0.08, bus = a.sfx, bright = false }) {
  const { ctx } = a;
  for (const [ratio, level, decay] of [
    [1, 1, duration],
    [bright ? 5.4 : 3.9, bright ? 0.25 : 0.35, duration * (bright ? 0.5 : 0.18)],
  ]) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = midi(note) * ratio;
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(gain * level, start + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, start + decay);
    osc.connect(env).connect(bus);
    osc.start(start);
    osc.stop(start + decay + 0.05);
  }
}

/** Pad tibio: dos dientes de sierra un poco desafinados, un filtro cerrado y entrada lenta. */
function pad(a, { notes, start, duration, gain = 0.02, bus = a.music, cutoff = 900 }) {
  const { ctx } = a;
  const end = start + duration;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.linearRampToValueAtTime(gain, start + Math.min(0.8, duration * 0.4));
  env.gain.setValueAtTime(gain, Math.max(start + 0.81, end - 0.6));
  env.gain.exponentialRampToValueAtTime(0.0001, end);
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = cutoff;
  lowpass.Q.value = 0.4;
  lowpass.connect(env).connect(bus);
  for (const note of notes)
    for (const detune of [-7, 7]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = midi(note);
      osc.detune.value = detune;
      osc.connect(lowpass);
      osc.start(start);
      osc.stop(end + 0.05);
    }
}

/** Un bip de robot: onda cuadrada filtrada, con un deslizamiento opcional (los trinos de Pol). */
function beep(
  a,
  { note, start, duration = 0.08, gain = 0.05, slide = 0, type = 'square', bus = a.sfx },
) {
  const { ctx } = a;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 3200;
  osc.type = type;
  osc.frequency.setValueAtTime(midi(note), start);
  if (slide) osc.frequency.exponentialRampToValueAtTime(midi(note + slide), start + duration);
  env.gain.setValueAtTime(0.0001, start);
  env.gain.linearRampToValueAtTime(gain, start + 0.005);
  env.gain.setValueAtTime(gain, start + duration * 0.7);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(lowpass).connect(env).connect(bus);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** Soplo de ruido filtrado que barre de una frecuencia a otra (puerta, cápsula, viento). */
function hiss(a, { start, duration, gain = 0.04, from = 800, to = 2400, q = 0.8, bus = a.sfx }) {
  const { ctx } = a;
  const source = noise(a);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = q;
  band.frequency.setValueAtTime(from, start);
  band.frequency.exponentialRampToValueAtTime(to, start + duration);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.linearRampToValueAtTime(gain, start + duration * 0.25);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(band).connect(env).connect(bus);
  source.start(start, Math.random() * 0.5);
  source.stop(start + duration + 0.05);
}

export const SFX = {
  /** Elegir: una nota de marimba. */
  select: (t, a) => marimba(a, { note: 76, start: t, duration: 0.35, gain: 0.07 }),
  /** Cambiar algo: dos bips cortos y suaves. */
  toggle: (t, a) => {
    beep(a, { note: 81, start: t, duration: 0.05, gain: 0.03, type: 'triangle' });
    beep(a, { note: 88, start: t + 0.06, duration: 0.05, gain: 0.03, type: 'triangle' });
  },
  /** Abrir: la marimba sube una quinta. */
  open: (t, a) => {
    marimba(a, { note: 72, start: t, duration: 0.4, gain: 0.06 });
    marimba(a, { note: 79, start: t + 0.07, duration: 0.5, gain: 0.06 });
  },
  /** Confirmar: tres notas que suben, con la kalimba arriba. */
  confirm: (t, a) =>
    [72, 76, 79].forEach((note, i) =>
      marimba(a, {
        note: note + 12 * (i === 2),
        start: t + i * 0.07,
        duration: 0.5,
        gain: 0.06,
        bright: i === 2,
      }),
    ),
  /** Pasar de estante o de página: un barrido de luz cortito. */
  page: (t, a) => hiss(a, { start: t, duration: 0.16, gain: 0.025, from: 1800, to: 5200, q: 2 }),
  /** Pulsa para comenzar: arpegio de marimba y un acorde de pad que se abre. */
  start: (t, a) => {
    [60, 64, 67, 71, 74, 79].forEach((note, i) =>
      marimba(a, {
        note: note + 12,
        start: t + i * 0.06,
        duration: 0.6,
        gain: 0.06,
        bright: i > 3,
      }),
    );
    pad(a, {
      notes: [60, 64, 67, 71],
      start: t,
      duration: 1.4,
      gain: 0.025,
      bus: a.sfx,
      cutoff: 1400,
    });
  },
  /** El trino de Pol (fin de capítulo): bips que suben y una nota que se desliza. */
  hoot: (t, a) => {
    [84, 88, 91].forEach((note, i) =>
      beep(a, { note, start: t + i * 0.06, duration: 0.05, gain: 0.035 }),
    );
    beep(a, { note: 93, start: t + 0.2, duration: 0.22, gain: 0.03, slide: 5 });
  },
  /** Pol se enreda ante un error: dos bips que bajan y uno que se arrastra. */
  sad: (t, a) => {
    beep(a, { note: 76, start: t, duration: 0.08, gain: 0.035 });
    beep(a, { note: 71, start: t + 0.11, duration: 0.08, gain: 0.035 });
    beep(a, { note: 67, start: t + 0.22, duration: 0.3, gain: 0.03, slide: -4 });
  },
  /** El carillón del taller: tres campanitas de kalimba. */
  bell: (t, a) => {
    [91, 95, 98].forEach((note, i) =>
      marimba(a, { note, start: t + i * 0.12, duration: 1.4, gain: 0.06, bright: true }),
    );
  },
  /** La puerta corrediza: un soplo que se desliza y un "ding" de llegada. */
  door: (t, a) => {
    hiss(a, { start: t, duration: 0.45, gain: 0.05, from: 600, to: 2600, q: 0.6 });
    hiss(a, { start: t + 0.35, duration: 0.3, gain: 0.025, from: 2600, to: 900, q: 0.6 });
    marimba(a, { note: 84, start: t + 0.55, duration: 0.7, gain: 0.05, bright: true });
  },
  /** El cortocircuito: chisporroteo de bips desordenados y un zumbido que se apaga. */
  burn: (t, a) => {
    for (let i = 0; i < 10; i++) {
      const at = t + i * 0.09 + Math.random() * 0.04;
      hiss(a, {
        start: at,
        duration: 0.04,
        gain: 0.05,
        from: 3000 + Math.random() * 3000,
        to: 1500,
        q: 3,
      });
      if (i % 3 === 0)
        beep(a, { note: 90 + Math.random() * 8, start: at, duration: 0.03, gain: 0.02 });
    }
    beep(a, { note: 45, start: t, duration: 1.1, gain: 0.03, slide: -12, type: 'sawtooth' });
  },
  /** El reinicio: la barra de carga en bips que suben y un "ding". */
  reborn: (t, a) => {
    for (let i = 0; i < 6; i++)
      beep(a, { note: 72 + i * 2, start: t + i * 0.07, duration: 0.05, gain: 0.025 });
    marimba(a, { note: 91, start: t + 0.5, duration: 0.9, gain: 0.06, bright: true });
  },
  /** La cápsula se sella: "fsss" de aire y un clic. */
  chest: (t, a) => {
    hiss(a, { start: t, duration: 0.42, gain: 0.06, from: 5000, to: 1400, q: 0.7 });
    beep(a, { note: 72, start: t + 0.4, duration: 0.04, gain: 0.05, type: 'triangle' });
  },
  'chest-soft': (t, a) => {
    hiss(a, { start: t, duration: 0.3, gain: 0.025, from: 4000, to: 1400, q: 0.7 });
    beep(a, { note: 72, start: t + 0.28, duration: 0.03, gain: 0.02, type: 'triangle' });
  },
};

// ------------------------------------------------------------ música
//
// Do mayor con séptimas (tibio, como un pueblo de mañana): un pad sostiene cada acorde, la
// marimba arpegia en corcheas y, cada tanto, la kalimba dice una frase corta. De noche, más
// lenta, una tercera menor más grave y el pad más cerrado. La semilla fija hace que siempre
// suene "igual de distinta".

const CHORDS = [
  [48, 52, 55, 59], // Do maj7
  [45, 48, 52, 55], // Lam7
  [41, 45, 48, 52], // Fa maj7
  [43, 47, 50, 53], // Sol7
  [48, 52, 55, 59], // Do maj7
  [40, 43, 47, 50], // Mim7
  [41, 45, 48, 52], // Fa maj7
  [43, 47, 50, 55], // Sol
];
const ROLL = [0, 2, 3, 1, 2, 3, 2, 1];
const SCALE = [72, 74, 76, 79, 81, 84, 86, 88]; // pentatónica de do, octava de la kalimba

let step = 0;
let nextTime = 0;
let seed = 23;
let phrase = [];
let rest = 0;
let degree = 3;
let nextAmbience = 0;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

function newPhrase() {
  const notes = [];
  const length = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < length; i++) {
    degree = Math.max(0, Math.min(SCALE.length - 1, degree + Math.floor(rnd() * 5) - 2));
    notes.push({ note: SCALE[degree], beats: i === length - 1 ? 3 : 1 + Math.floor(rnd() * 2) });
  }
  return notes;
}

/** De día, pájaros o una ráfaga de viento; de noche, el zumbido lejano de la ciudad. */
function ambience(a, t, night) {
  const { ctx } = a;
  if (night) {
    hiss(a, { start: t, duration: 3.5, gain: 0.012, from: 160, to: 220, q: 0.5, bus: a.music });
    return;
  }
  if (rnd() < 0.45) {
    hiss(a, { start: t, duration: 2.6, gain: 0.014, from: 300, to: 900, q: 0.4, bus: a.music });
    return;
  }
  const chirps = 2 + Math.floor(rnd() * 3);
  const base = 96 + Math.floor(rnd() * 4);
  for (let i = 0; i < chirps; i++) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const at = t + i * (0.09 + rnd() * 0.05);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(midi(base), at);
    osc.frequency.exponentialRampToValueAtTime(midi(base + 3 + rnd() * 4), at + 0.06);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.linearRampToValueAtTime(0.011, at + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
    osc.connect(env).connect(a.music);
    osc.start(at);
    osc.stop(at + 0.09);
  }
}

export function startMusic(a) {
  nextTime = a.ctx.currentTime + 0.1;
  nextAmbience = a.ctx.currentTime + 3;
}

export function scheduleMusic(a, night) {
  const beatLength = 60 / (night ? 60 : 84) / 2; // corcheas
  const shift = night ? -3 : 0;
  while (nextTime < a.ctx.currentTime + 0.25) {
    const bar = Math.floor(step / 8) % CHORDS.length;
    const beat = step % 8;
    const chord = CHORDS[bar];
    if (beat === 0)
      pad(a, {
        notes: chord.map((n) => n + 12 + shift),
        start: nextTime,
        duration: beatLength * 8,
        gain: night ? 0.012 : 0.016,
        cutoff: night ? 650 : 1000,
      });
    if (beat === 0)
      marimba(a, {
        note: chord[0] + shift,
        start: nextTime,
        duration: beatLength * 4,
        gain: 0.05,
        bus: a.music,
      });
    marimba(a, {
      note: chord[ROLL[beat]] + 24 + shift,
      start: nextTime,
      duration: beatLength * 2.5,
      gain: beat % 2 ? 0.03 : 0.04,
      bus: a.music,
    });
    // La kalimba: una frase en la segunda mitad de cada cuatro compases, a veces.
    if (bar % 4 === 2 && beat === 0 && !phrase.length && rnd() < 0.75) phrase = newPhrase();
    if (phrase.length && rest <= 0) {
      const { note, beats } = phrase.shift();
      marimba(a, {
        note: note + shift,
        start: nextTime,
        duration: beatLength * 3 * beats,
        gain: 0.035,
        bus: a.music,
        bright: true,
      });
      rest = beats * 2;
    }
    rest -= 1;
    nextTime += beatLength;
    step++;
  }
  if (a.ctx.currentTime >= nextAmbience) {
    ambience(a, a.ctx.currentTime + 0.1, night);
    nextAmbience = a.ctx.currentTime + (night ? 4 + rnd() * 3 : 5 + rnd() * 7);
  }
}
