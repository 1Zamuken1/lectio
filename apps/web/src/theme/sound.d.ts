export type SoundName =
  | 'select'
  | 'toggle'
  | 'open'
  | 'confirm'
  | 'page'
  | 'start'
  | 'hoot'
  | 'bell'
  | 'door'
  | 'burn'
  | 'reborn'
  | 'chest'
  | 'chest-soft'
  /** Lumen se encoge ante un error (solo el Bosque). */
  | 'sad';

/** Efectos y música chiptune con Web Audio (sound.js). */
export declare const Sound: {
  play(name: SoundName, options?: { force?: boolean }): void;
  /** El reproductor avisa cuándo suena el libro: la música se aparta y los efectos callan. */
  setNarrating(value: boolean): void;
};
