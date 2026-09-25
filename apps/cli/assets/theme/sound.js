// Lectio · sonido (docs/lectio-temas.md): efectos y música chiptune sintetizados con
// Web Audio. Sin archivos ni licencias de terceros.
//
// Reglas: la música viene apagada; se desvanece sola mientras suena la narración; los
// efectos nunca suenan encima de la narración; todo se calla con la pestaña oculta.
// El tema Clásico no tiene ambientación: ni efectos ni música.
(() => {
  'use strict';

  const Theme = window.LectioTheme;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const WORLDS_WITH_SOUND = new Set(['scriptorium']);

  let ctx = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let narrating = false;

  /** El contexto de audio solo puede crearse tras un gesto del usuario (política de autoplay). */
  function ensure() {
    if (!AudioContextClass) return null;
    if (!ctx) {
      ctx = new AudioContextClass();
      master = ctx.createGain();
      master.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.connect(master);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0;
      musicBus.connect(master);
      applyVolume();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function applyVolume() {
    if (master) master.gain.setTargetAtTime(Theme.get().volume * 0.5, ctx.currentTime, 0.05);
  }

  const midi = (note) => 440 * 2 ** ((note - 69) / 12);

  /** Nota con envolvente: ataque corto y caída exponencial (el "pluck" de las consolas). */
  function tone({
    note,
    start,
    duration,
    type = 'square',
    gain = 0.12,
    bus = sfxBus,
    attack = 0.004,
    slide = 0,
    filter = 0,
  }) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(midi(note), start);
    if (slide) osc.frequency.linearRampToValueAtTime(midi(note + slide), start + duration);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(gain, start + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    let node = osc;
    if (filter) {
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = filter;
      osc.connect(lowpass);
      node = lowpass;
    }
    node.connect(env);
    env.connect(bus);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  /** Roce de papel: ruido filtrado con un barrido de frecuencia. */
  function rustle(start, duration = 0.16, gain = 0.1) {
    const length = Math.ceil(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 0.9;
    band.frequency.setValueAtTime(1800, start);
    band.frequency.linearRampToValueAtTime(4200, start + duration);
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, start);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(band).connect(env).connect(sfxBus);
    source.start(start);
  }

  // ------------------------------------------------------------ efectos

  const SFX = {
    select: (t) => {
      tone({ note: 84, start: t, duration: 0.05, gain: 0.07 });
      tone({ note: 91, start: t + 0.045, duration: 0.07, gain: 0.07 });
    },
    toggle: (t) => tone({ note: 79, start: t, duration: 0.08, type: 'triangle', gain: 0.12 }),
    open: (t) =>
      [72, 76, 79].forEach((n, i) =>
        tone({ note: n, start: t + i * 0.055, duration: 0.14, type: 'triangle', gain: 0.12 }),
      ),
    confirm: (t) => {
      tone({ note: 79, start: t, duration: 0.08, gain: 0.07 });
      tone({ note: 84, start: t + 0.08, duration: 0.16, gain: 0.07 });
    },
    page: (t) => rustle(t),
    start: (t) =>
      [72, 76, 79, 84, 88].forEach((n, i) =>
        tone({
          note: n,
          start: t + i * 0.07,
          duration: i === 4 ? 0.4 : 0.12,
          gain: 0.08,
          filter: 3200,
        }),
      ),
    /** Ulular del búho: dos notas suaves con caída, al terminar un capítulo. */
    hoot: (t) => {
      tone({
        note: 67,
        start: t,
        duration: 0.32,
        type: 'sine',
        gain: 0.16,
        attack: 0.05,
        slide: -1,
      });
      tone({
        note: 64,
        start: t + 0.38,
        duration: 0.55,
        type: 'sine',
        gain: 0.14,
        attack: 0.06,
        slide: -2,
      });
    },
  };

  function soundAllowed() {
    const settings = Theme.get();
    return WORLDS_WITH_SOUND.has(settings.world) && settings.volume > 0;
  }

  function play(name) {
    const settings = Theme.get();
    if (!settings.sfx || !soundAllowed() || narrating || document.hidden) return;
    if (!ensure()) return;
    SFX[name]?.(ctx.currentTime + 0.01);
  }

  // ------------------------------------------------------------ música del scriptorium
  //
  // Generativa: progresión modal en re dórico, dron de órgano y arpegios de laúd, con una
  // melodía escasa que cambia en cada vuelta (semilla fija: siempre suena "igual de distinta").

  const BEAT = 60 / 66 / 2; // corcheas a 66 pulsos por minuto
  const CHORDS = [
    [50, 53, 57], // Rem
    [48, 52, 55], // Do
    [50, 53, 57], // Rem
    [55, 59, 62], // Sol (el si natural del dórico)
    [53, 57, 60], // Fa
    [48, 52, 55], // Do
    [50, 53, 57], // Rem
    [45, 48, 52], // Lam
  ];
  const ARPEGGIO = [0, 1, 2, 1, 2, 1, 0, 1];
  const SCALE = [62, 64, 65, 67, 69, 71, 72, 74]; // re dórico, octava media
  let timer = null;
  let nextTime = 0;
  let step = 0;
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  function schedule() {
    while (nextTime < ctx.currentTime + 0.25) {
      const bar = Math.floor(step / 8) % CHORDS.length;
      const beat = step % 8;
      const chord = CHORDS[bar];
      if (beat === 0) {
        // Dron de órgano: raíz grave y quinta, tenues y filtrados.
        tone({
          note: chord[0] - 12,
          start: nextTime,
          duration: BEAT * 8,
          type: 'square',
          gain: 0.025,
          bus: musicBus,
          attack: 0.3,
          filter: 520,
        });
        tone({
          note: chord[2] - 12,
          start: nextTime,
          duration: BEAT * 8,
          type: 'square',
          gain: 0.018,
          bus: musicBus,
          attack: 0.3,
          filter: 520,
        });
      }
      // Laúd: arpegio pulsado sobre el acorde.
      tone({
        note: chord[ARPEGGIO[beat]] + 12,
        start: nextTime,
        duration: BEAT * 1.8,
        type: 'triangle',
        gain: 0.07,
        bus: musicBus,
      });
      // Melodía escasa en compases alternos.
      if (bar % 2 === 1 && (beat === 0 || beat === 3 || beat === 5) && rnd() < 0.7) {
        const note = SCALE[Math.floor(rnd() * SCALE.length)];
        tone({
          note,
          start: nextTime,
          duration: BEAT * (beat === 5 ? 3 : 2),
          type: 'square',
          gain: 0.035,
          bus: musicBus,
          attack: 0.02,
          filter: 1800,
        });
      }
      nextTime += BEAT;
      step++;
    }
  }

  function startMusic() {
    if (timer || !ensure()) return;
    nextTime = ctx.currentTime + 0.1;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setTargetAtTime(0.9, ctx.currentTime, 0.6);
    timer = setInterval(schedule, 60);
  }

  function stopMusic() {
    if (!timer) return;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.35);
    const stopping = timer;
    timer = null;
    setTimeout(() => clearInterval(stopping), 1200);
  }

  function update() {
    const settings = Theme.get();
    const wanted = settings.music && soundAllowed() && !narrating && !document.hidden;
    if (ctx) applyVolume();
    if (wanted && ctx) startMusic();
    else stopMusic();
  }

  // La primera interacción crea el contexto y, si la música está activada, la inicia.
  const unlock = () => {
    if (Theme.get().music && soundAllowed()) {
      ensure();
      update();
    }
  };
  document.addEventListener('pointerdown', unlock, { once: false, passive: true });
  document.addEventListener('keydown', unlock, { once: false });
  document.addEventListener('visibilitychange', update);
  Theme.onChange((settings) => {
    if (settings.music && soundAllowed() && !ctx) return; // espera un gesto del usuario
    update();
  });

  window.LectioSound = {
    play,
    /** El reproductor avisa cuándo suena el libro: la música se aparta y los efectos callan. */
    setNarrating(value) {
      narrating = value;
      document.documentElement.dataset.playing = String(value);
      update();
    },
  };
})();
