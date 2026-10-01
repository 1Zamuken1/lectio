import { onlineManager, type QueryClient } from '@tanstack/react-query';
import { createStore } from 'zustand/vanilla';
import { ApiError, type ApiClient } from '../api/client';
import type { BookDetail, ChapterSummary, Schemas } from '../api/queries';
import { downloads, isUnreachable } from '../pwa/downloads';
import type { DownloadedVoice } from '../pwa/db';
import type { ProgressSync } from '../reader/position';
import { formatNumber } from '../reader/text';
import { Sound } from '../theme/sound';
import {
  formatTime,
  needsConfirmation,
  sentenceToTime,
  timeToSentence,
  type Alignment,
} from './sync';

export type Voice = Schemas['VoiceDto'];
type AudioState = Schemas['AudioStateDto'];
type Usage = Schemas['UsageDto'];

/** Lo que el reproductor necesita de un libro (sale del detalle de la API). */
export interface PlayerBook {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  isPublic: boolean;
  language: string | null;
  /** Ruta del lector, sin `?capitulo=`. */
  href: string;
  chapters: ChapterSummary[];
}

/** El audio cargado en el <audio>: un capítulo con una voz y sus tiempos. */
export interface LoadedAudio {
  bookId: string;
  chapterId: string;
  voiceId: string;
  src: string;
  expiresAt: number;
  alignment: Alignment;
  durationMs: number;
  /**
   * Se grabó antes de un cambio: `narration` si el libro se reprocesó y cambió lo que se
   * narra (regenerarlo es gratis), `voice` si cambió el perfil de la voz (se cobra).
   */
  outdated: 'narration' | 'voice' | null;
}

/** Una generación en marcha (o fallida) de un capítulo con una voz. */
export interface Job {
  bookId: string;
  chapterId: string;
  voiceId: string;
  status: 'pending' | 'processing' | 'ready' | 'error';
  done: number;
  total: number;
  /** Pedida por adelantado (el taller no la muestra). */
  prefetch: boolean;
  /** Vuelve a grabar un audio desactualizado: mientras, sigue sonando el anterior. */
  refresh?: boolean;
  error?: string;
}

export interface ConfirmRequest {
  title: string;
  body: string;
  confirm: string;
  cancel: string;
  resolve: (answer: boolean) => void;
}

export interface PlayerState {
  books: Record<string, PlayerBook>;
  loaded: LoadedAudio | null;
  playing: boolean;
  /** Oración que suena (-1 antes de la primera). */
  sentence: number;
  /** Tiempo actual, actualizado ~4 veces por segundo (el reproductor grande usa onFrame). */
  timeMs: number;
  voices: Voice[];
  /** La voz elegida (puede no tener audio aún: entonces suena otra mientras se genera). */
  voice: string | null;
  speed: number;
  jobs: Record<string, Job>;
  /** Aviso bajo el reproductor: un error o que la cuota no alcanza. */
  notice: string | null;
  /** El reproductor pasó solo al capítulo siguiente: el lector lo sigue. */
  advanced: { from: string; to: string; at: number } | null;
  confirm: ConfirmRequest | null;
  /** El lector hizo scroll a mano: se deja de seguir la oración. */
  follow: boolean;
  /** Volumen de la narración (0 a 1), aparte de los efectos y la música del tema. */
  volume: number;
  muted: boolean;
}

const jobKey = (chapterId: string, voiceId: string) => `${chapterId}:${voiceId}`;

export const SPEED_PRESETS = [0.5, 0.75, 0.85, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
export const MIN_SPEED = 0.5;
export const MAX_SPEED = 3;
const clampSpeed = (value: number) =>
  Number.isFinite(value)
    ? Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.round(value * 100) / 100))
    : 1;
export const VOLUME_PRESETS = [0.25, 0.5, 0.75, 1];
const clampVolume = (value: number) =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, Math.round(value * 100) / 100)) : 1;

export const speedLabel = (value: number) =>
  `${value.toLocaleString('es', { maximumFractionDigits: 2 })}×`;

const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const value = localStorage.getItem(`lectio:${key}`);
      return value === null ? fallback : (JSON.parse(value) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(`lectio:${key}`, JSON.stringify(value));
    } catch {
      /* navegación privada */
    }
  },
};

/** Mensaje para el usuario según el `code` de la API (frontend §8). */
export function audioErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Sin conexión. Vuelve a intentarlo en un momento.';
  const body = error.body as { remaining?: number; required?: number; resetsAt?: string };
  switch (error.code) {
    case 'TTS_QUOTA_EXCEEDED':
      return `Te faltan ${formatNumber((body.required ?? 0) - (body.remaining ?? 0))} caracteres para este capítulo. Tu cuota se reinicia el ${resetDate(body.resetsAt)}.`;
    case 'AUDIO_CONCURRENCY_LIMIT':
      return 'Ya hay capítulos generándose; espera a que terminen.';
    case 'PUBLIC_BOOK_AUDIO':
      return 'El audio de los libros públicos lo prepara Lectio.';
    case 'VOICE_NOT_AVAILABLE':
      return 'Esa voz no lee este idioma.';
    default:
      return 'No se pudo generar el audio. Vuelve a intentarlo.';
  }
}

export const resetDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'long', timeZone: 'UTC' })
    : 'próximo mes';

/**
 * El reproductor de toda la app: un único <audio> fuera de las rutas (frontend §5.1), así
 * que navegar no corta lo que suena. Portado de `preview.js`: la sincronización por
 * oración, el cambio de voz sin cortar la oración, la generación con cuota, el adelanto del
 * capítulo siguiente y el avance automático. El estado vive en un store; la UI lo lee.
 */
export class PlayerController {
  readonly store = createStore<PlayerState>(() => ({
    books: {},
    loaded: null,
    playing: false,
    sentence: -1,
    timeMs: 0,
    voices: [],
    voice: null,
    speed: 1,
    jobs: {},
    notice: null,
    advanced: null,
    confirm: null,
    follow: true,
    // "volume" ya es el de los efectos del tema (theme.ts): la narración tiene su clave.
    volume: clampVolume(Number(store.get('narration-volume', 1))),
    muted: store.get<boolean>('narration-muted', false) === true,
  }));

  readonly audio = new Audio();
  readonly #frameListeners = new Set<() => void>();
  /** Última oración escuchada de cada capítulo: volver a uno retoma donde ibas. */
  readonly #positions = new Map<string, number>();
  /** Capítulos ya pedidos por adelantado con cada voz. */
  readonly #prefetched = new Set<string>();
  readonly #alignments = new Map<string, Alignment>();
  #voicesLanguage: string | null = null;
  /** Hay una voz nueva lista, esperando a que empiece la oración siguiente. */
  #pendingSwitch = false;
  /** Capítulo que debe empezar a sonar apenas termine de generarse. */
  #pendingPlay: string | null = null;
  #pollTimer: number | undefined;
  #frame = 0;
  #lastTimeUpdate = 0;

  constructor(
    private readonly api: ApiClient,
    private readonly queryClient: QueryClient,
    private readonly progress: ProgressSync,
    private readonly isAuthenticated: () => boolean,
  ) {
    this.audio.preload = 'metadata';
    this.audio.volume = this.state.volume;
    this.audio.muted = this.state.muted;
    this.audio.addEventListener('play', () => this.#onPlay());
    this.audio.addEventListener('pause', () => this.#onPause());
    this.audio.addEventListener('seeked', () => this.#sync());
    // requestAnimationFrame se detiene con la pestaña oculta o el celular bloqueado, justo
    // cuando más se escucha: timeupdate (~4 por segundo) sigue llegando y mantiene la
    // oración, el progreso guardado, el cambio de voz y el adelanto del siguiente.
    this.audio.addEventListener('timeupdate', () => this.#sync());
    this.audio.addEventListener('ended', () => void this.#onEnded());
    this.audio.addEventListener('error', () => void this.#onError());
  }

  get state(): PlayerState {
    return this.store.getState();
  }

  #set(partial: Partial<PlayerState>) {
    this.store.setState(partial);
  }

  /** Cada cuadro mientras suena (el reproductor grande mueve su barra aquí, sin renders). */
  onFrame(listener: () => void): () => void {
    this.#frameListeners.add(listener);
    return () => this.#frameListeners.delete(listener);
  }

  // ------------------------------------------------------------ libros y voces

  /** Guarda (o refresca) lo que se sabe de un libro: capítulos y audio por voz. */
  upsertBook(detail: BookDetail, href: string): PlayerBook {
    const book: PlayerBook = {
      id: detail.id,
      title: detail.title ?? 'Sin título',
      author: detail.author ?? '',
      coverUrl: detail.coverUrl,
      isPublic: detail.isPublic,
      language: detail.language,
      href,
      chapters: detail.chapters,
    };
    this.#set({ books: { ...this.state.books, [book.id]: book } });
    void this.loadVoices(detail.language ?? 'es');
    return book;
  }

  async loadVoices(language: string): Promise<void> {
    if (this.#voicesLanguage === language) return;
    this.#voicesLanguage = language;
    try {
      const voices = await this.api.get<Voice[]>(
        `/api/v1/voices?language=${encodeURIComponent(language)}`,
      );
      const stored = store.get<string | null>('voice', null);
      const voice = voices.some((v) => v.id === stored)
        ? stored
        : (voices.find((v) => v.isDefault)?.id ?? voices[0]?.id ?? null);
      this.#set({ voices, voice, speed: this.#speedFor(voice) });
    } catch {
      this.#voicesLanguage = null;
    }
  }

  voiceName(id: string | null): string {
    return this.state.voices.find((v) => v.id === id)?.name ?? id ?? 'Voz';
  }

  /** Voces con audio listo para el capítulo (lo que dice la API más lo recién generado). */
  readyVoices(chapter: ChapterSummary): string[] {
    const ready = new Set(chapter.audio.filter((a) => a.status === 'ready').map((a) => a.voiceId));
    for (const job of Object.values(this.state.jobs)) {
      if (job.chapterId !== chapter.id) continue;
      if (job.status === 'ready' || (job.refresh && job.status !== 'error')) ready.add(job.voiceId);
    }
    return [...ready];
  }

  /**
   * La voz que suena en un capítulo: la elegida si ya existe, si no otra con audio. Sin
   * conexión, solo las descargadas (si hay alguna).
   */
  effectiveVoice(chapter: ChapterSummary): string | null {
    let ready = this.readyVoices(chapter);
    if (!onlineManager.isOnline()) {
      const saved = ready.filter((v) => downloads.voice(chapter.id, v));
      if (saved.length > 0) ready = saved;
    }
    const { voice } = this.state;
    return voice && ready.includes(voice) ? voice : (ready[0] ?? null);
  }

  /**
   * La voz con que se descarga un capítulo: la elegida, si ese capítulo la tiene; si no,
   * otra con audio; null si no tiene ninguna (se baja solo el texto).
   */
  downloadVoice(chapter: ChapterSummary): string | null {
    const ready = this.readyVoices(chapter);
    const chosen = this.state.voice ?? store.get<string | null>('voice', null);
    return chosen && ready.includes(chosen) ? chosen : (ready[0] ?? null);
  }

  hasAudio(chapter: ChapterSummary): boolean {
    return this.readyVoices(chapter).length > 0;
  }

  /** Solo el dueño genera audio, y de sus libros (los públicos los prepara Lectio). */
  canGenerate(book: PlayerBook): boolean {
    return !book.isPublic && this.isAuthenticated();
  }

  jobFor(chapterId: string, voiceId: string | null): Job | null {
    return voiceId ? (this.state.jobs[jobKey(chapterId, voiceId)] ?? null) : null;
  }

  // ------------------------------------------------------------ cargar y reproducir

  #chapter(bookId: string, chapterId: string): ChapterSummary | null {
    return this.state.books[bookId]?.chapters.find((c) => c.id === chapterId) ?? null;
  }

  isLoaded(chapterId: string): boolean {
    return this.state.loaded?.chapterId === chapterId;
  }

  /**
   * Trae la URL firmada y la alineación del audio de un capítulo con una voz. Si está
   * descargado, suena desde la descarga: sin red, mientras se regraba (la API no da la
   * grabación anterior) o cuando es la misma grabación que da la API.
   */
  async #fetchAudio(bookId: string, chapterId: string, voiceId: string): Promise<LoadedAudio> {
    const saved = downloads.voice(chapterId, voiceId);
    let state: AudioState;
    try {
      state = await this.api.get<AudioState>(
        `/api/v1/chapters/${chapterId}/audio?voice=${encodeURIComponent(voiceId)}`,
      );
    } catch (error) {
      const offline =
        saved && isUnreachable(error) && (await this.#fromDownload(bookId, chapterId, saved));
      if (offline) return offline;
      throw error;
    }
    if (state.status !== 'ready' || !state.audioUrl || !state.alignmentUrl) {
      const fallback = saved && (await this.#fromDownload(bookId, chapterId, saved));
      if (fallback) return fallback;
      throw new Error('El audio aún no está listo');
    }
    const outdated = state.outdated ? (state.outdatedReason ?? 'voice') : null;
    const audioKey = new URL(state.audioUrl, location.origin).searchParams.get('key');
    if (saved && saved.audioKey === audioKey) {
      const local = await this.#fromDownload(bookId, chapterId, saved);
      if (local) return { ...local, outdated };
    } else if (saved) {
      // Se regeneró después de descargarlo: se baja la grabación nueva por detrás.
      void downloads.refreshVoice(this.api, chapterId, voiceId);
    }
    const key = jobKey(chapterId, voiceId);
    let alignment = this.#alignments.get(key);
    if (!alignment) {
      const response = await fetch(state.alignmentUrl);
      if (!response.ok) throw new Error('No se pudo leer la alineación');
      alignment = (await response.json()) as Alignment;
      this.#alignments.set(key, alignment);
    }
    return {
      bookId,
      chapterId,
      voiceId,
      src: state.audioUrl,
      expiresAt: state.expiresAt ? Date.parse(state.expiresAt) : Infinity,
      alignment,
      durationMs: state.durationMs ?? alignment.durationMs,
      outdated,
    };
  }

  /** El audio descargado (no vence: no hay firma que renovar). Null si falta en la caché. */
  async #fromDownload(
    bookId: string,
    chapterId: string,
    saved: DownloadedVoice,
  ): Promise<LoadedAudio | null> {
    const [alignment, src] = await Promise.all([
      downloads.readAlignment(saved),
      downloads.audioSrc(saved),
    ]).catch(() => [null, null] as const);
    if (!alignment || !src) return null;
    return {
      bookId,
      chapterId,
      voiceId: saved.voiceId,
      src,
      expiresAt: Infinity,
      alignment,
      durationMs: alignment.durationMs,
      outdated: null,
    };
  }

  /**
   * Carga un capítulo en el <audio> (con la voz que le toca) y, si se pide, lo reproduce
   * desde una oración. Si ya estaba cargado, solo mueve la posición.
   */
  async load(
    bookId: string,
    chapterId: string,
    options: { play?: boolean; sentence?: number } = {},
  ): Promise<boolean> {
    const chapter = this.#chapter(bookId, chapterId);
    const voice = chapter && this.effectiveVoice(chapter);
    if (!chapter || !voice) return false;
    const current = this.state.loaded;
    if (current?.chapterId === chapterId) {
      if (current.voiceId !== voice) this.#switchSource();
      if (options.sentence !== undefined) this.seekToSentence(options.sentence);
      if (options.play) await this.play();
      return true;
    }
    let loaded: LoadedAudio;
    try {
      loaded = await this.#fetchAudio(bookId, chapterId, voice);
    } catch (error) {
      this.#set({ notice: audioErrorMessage(error) });
      return false;
    }
    if (current) this.#positions.set(current.chapterId, this.state.sentence);
    this.#pendingSwitch = false;
    const resume = options.sentence ?? this.#positions.get(chapterId) ?? -1;
    const speed = this.#speedFor(voice);
    this.#set({ loaded, sentence: -1, timeMs: 0, speed, notice: null });
    this.audio.src = loaded.src;
    this.audio.playbackRate = speed;
    await this.#whenReady();
    const ms = resume >= 0 ? sentenceToTime(loaded.alignment, resume) : null;
    if (ms !== null) this.audio.currentTime = ms / 1000;
    this.#setMediaSession();
    this.#sync();
    if (options.play) await this.play();
    return true;
  }

  #whenReady(): Promise<void> {
    if (this.audio.readyState >= 1) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => resolve();
      this.audio.addEventListener('loadedmetadata', done, { once: true });
      this.audio.addEventListener('error', done, { once: true });
    });
  }

  async play(): Promise<void> {
    this.#set({ follow: true });
    await this.audio.play().catch(() => undefined);
  }

  pause(): void {
    this.audio.pause();
  }

  togglePlay(): void {
    if (this.audio.paused) void this.play();
    else this.pause();
  }

  seekTo(ms: number): void {
    const loaded = this.state.loaded;
    if (!loaded) return;
    this.audio.currentTime = Math.min(Math.max(0, ms), loaded.durationMs) / 1000;
    this.#sync();
  }

  seekBy(deltaMs: number): void {
    this.seekTo(this.audio.currentTime * 1000 + deltaMs);
  }

  seekToSentence(sentence: number): void {
    const loaded = this.state.loaded;
    const ms = loaded ? sentenceToTime(loaded.alignment, sentence) : null;
    if (ms !== null) this.seekTo(ms);
  }

  /** "Escuchar desde aquí": carga el capítulo si hace falta y suena desde esa oración. */
  async playFrom(bookId: string, chapterId: string, sentence: number): Promise<void> {
    this.#set({ follow: true });
    await this.load(bookId, chapterId, { sentence, play: true });
  }

  /** Inicio (ms) de una oración en el audio cargado, o null. */
  timeOf(sentence: number): number | null {
    const loaded = this.state.loaded;
    return loaded ? sentenceToTime(loaded.alignment, sentence) : null;
  }

  /** Velocidad de cada voz: la que eligió el usuario con ella, o 1× (el ritmo va en el MP3). */
  #speedFor(voiceId: string | null): number {
    return clampSpeed(Number(store.get(`voice-speed:${voiceId}`, 1)));
  }

  setSpeed(value: number): void {
    const speed = clampSpeed(value);
    store.set(`voice-speed:${this.state.loaded?.voiceId ?? this.state.voice}`, speed);
    this.audio.playbackRate = speed;
    this.#set({ speed });
  }

  /** Volumen de la narración; subirlo quita el silencio. */
  setVolume(value: number): void {
    const volume = clampVolume(value);
    store.set('narration-volume', volume);
    this.audio.volume = volume;
    if (volume > 0 && this.state.muted) this.#setMuted(false);
    this.#set({ volume });
  }

  toggleMute(): void {
    this.#setMuted(!this.state.muted);
  }

  #setMuted(muted: boolean) {
    store.set('narration-muted', muted);
    this.audio.muted = muted;
    this.#set({ muted });
  }

  setFollow(follow: boolean): void {
    if (follow !== this.state.follow) this.#set({ follow });
  }

  /** ¿Se está escuchando a mitad de camino? (al inicio o al final no se pregunta). */
  listeningMidChapter(): boolean {
    const loaded = this.state.loaded;
    if (!loaded) return false;
    const elapsed = this.audio.currentTime * 1000;
    return elapsed > 5000 && elapsed < loaded.durationMs - 10_000;
  }

  /**
   * Evita cambiar de capítulo por accidente mientras suena otro (un toque de más en ⏮/⏭
   * o en las flechas). La posición queda guardada: al volver, se retoma.
   */
  async confirmLeave(fromChapterId: string, target: ChapterSummary): Promise<boolean> {
    const loaded = this.state.loaded;
    if (!loaded || loaded.chapterId !== fromChapterId || !this.listeningMidChapter()) return true;
    const current = this.#chapter(loaded.bookId, loaded.chapterId);
    return this.ask({
      title: `¿Pasar a «${target.title}»?`,
      body: `Vas en ${formatTime(this.audio.currentTime * 1000)} de ${formatTime(loaded.durationMs)} de «${current?.title ?? ''}». Tu posición queda guardada: si vuelves, sigues desde ahí.`,
      confirm: 'Ir al capítulo',
      cancel: 'Seguir aquí',
    });
  }

  ask(request: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
    this.state.confirm?.resolve(false);
    return new Promise((resolve) => {
      this.#set({
        confirm: {
          ...request,
          resolve: (answer) => {
            this.#set({ confirm: null });
            resolve(answer);
          },
        },
      });
    });
  }

  /** Deja de sonar y olvida el capítulo (por ejemplo, al cerrar sesión). */
  stop(): void {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.#set({ loaded: null, playing: false, sentence: -1, timeMs: 0 });
  }

  // ------------------------------------------------------------ voces

  selectVoice(id: string, bookId: string, chapterId: string): void {
    if (id === this.state.voice) return;
    Sound.play('select');
    store.set('voice', id);
    this.#set({ voice: id, notice: null });
    const book = this.state.books[bookId];
    const chapter = this.#chapter(bookId, chapterId);
    if (!book || !chapter) return;
    if (this.readyVoices(chapter).includes(id)) {
      if (this.isLoaded(chapterId)) this.#switchSource();
      return;
    }
    if (this.canGenerate(book) && chapter.characterCount > 0) {
      void this.generateFromHere(bookId, chapterId);
    }
  }

  /**
   * Cambia el audio del capítulo que suena por el de la voz elegida. Si está sonando, no
   * corta a mitad de oración: espera a que empiece la siguiente y sigue desde ahí.
   */
  #switchSource(force = false): void {
    const loaded = this.state.loaded;
    const chapter = loaded && this.#chapter(loaded.bookId, loaded.chapterId);
    const voice = chapter && this.effectiveVoice(chapter);
    // `force`: la misma voz, recién regenerada (el archivo nuevo reemplaza al que suena).
    if (!loaded || !voice || (!force && voice === loaded.voiceId)) return;
    if (!this.audio.paused && this.state.sentence >= 0) {
      this.#pendingSwitch = true;
      return;
    }
    void this.#swap(this.state.sentence, false);
  }

  async #swap(sentence: number, play: boolean): Promise<void> {
    this.#pendingSwitch = false;
    const loaded = this.state.loaded;
    const chapter = loaded && this.#chapter(loaded.bookId, loaded.chapterId);
    const voice = chapter && this.effectiveVoice(chapter);
    if (!loaded || !voice) return;
    let next: LoadedAudio;
    try {
      next = await this.#fetchAudio(loaded.bookId, loaded.chapterId, voice);
    } catch (error) {
      this.#set({ notice: audioErrorMessage(error) });
      return;
    }
    const speed = this.#speedFor(voice); // la velocidad acompaña a la voz que suena
    this.#set({ loaded: next, speed });
    this.audio.src = next.src;
    await this.#whenReady();
    const ms = sentence >= 0 ? sentenceToTime(next.alignment, sentence) : null;
    if (ms !== null) this.audio.currentTime = ms / 1000;
    this.audio.playbackRate = speed;
    if (play) await this.audio.play().catch(() => undefined);
    this.#sync();
  }

  // ------------------------------------------------------------ generar

  /** El capítulo actual y, por adelantado, el siguiente, con la voz elegida. */
  async generateFromHere(bookId: string, chapterId: string): Promise<void> {
    const started = await this.generate(bookId, chapterId, { prefetch: false });
    const next = this.#nextNarratable(bookId, chapterId);
    if (started && next) void this.generate(bookId, next.id, { prefetch: true });
  }

  /**
   * Pide el audio de un capítulo con la voz elegida. Se genera directo; solo si gasta más
   * del 5 % de la cuota del mes se confirma antes. Lo pedido por adelantado nunca pregunta:
   * si sería caro, se deja para cuando llegues (y si la cuota no alcanza, se avisa ya).
   */
  async generate(
    bookId: string,
    chapterId: string,
    { prefetch }: { prefetch: boolean },
  ): Promise<boolean> {
    const book = this.state.books[bookId];
    const chapter = this.#chapter(bookId, chapterId);
    const voice = this.state.voice;
    if (!book || !chapter || !voice || !this.canGenerate(book)) return false;
    if (this.readyVoices(chapter).includes(voice)) return true;
    const running = this.jobFor(chapterId, voice);
    if (running && running.status !== 'error') {
      if (!prefetch && running.prefetch) this.#updateJob({ ...running, prefetch: false });
      return true;
    }

    let usage: Usage;
    try {
      usage = await this.usage();
    } catch (error) {
      if (!prefetch) this.#set({ notice: audioErrorMessage(error) });
      return false;
    }
    if (chapter.characterCount > usage.remaining) {
      const missing = formatNumber(chapter.characterCount - usage.remaining);
      this.#set({
        notice: `Tu cuota del mes no alcanza para «${chapter.title}» (faltan ${missing} caracteres). Se reinicia el ${resetDate(usage.resetsAt)}.`,
      });
      return false;
    }
    if (needsConfirmation(chapter.characterCount, usage.quota)) {
      if (prefetch) return false;
      const ok = await this.ask({
        title: `¿Generar «${chapter.title}» con ${this.voiceName(voice)}?`,
        body: `Este capítulo usa ${formatNumber(chapter.characterCount)} de los ${formatNumber(usage.remaining)} caracteres que te quedan este mes.`,
        confirm: 'Generar',
        cancel: 'Ahora no',
      });
      if (!ok) return false;
    }

    this.#updateJob({
      bookId,
      chapterId,
      voiceId: voice,
      status: 'pending',
      done: 0,
      total: 0,
      prefetch,
    });
    try {
      await this.api.post(`/api/v1/chapters/${chapterId}/audio`, { voiceId: voice });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'AUDIO_ALREADY_EXISTS') {
        this.#updateJob({ ...this.jobFor(chapterId, voice)!, status: 'ready' });
        this.#refreshBooks();
        return true;
      }
      this.#dropJob(chapterId, voice);
      if (!prefetch) this.#set({ notice: audioErrorMessage(error) });
      return false;
    }
    void this.queryClient.invalidateQueries({ queryKey: ['usage'] });
    this.#schedulePoll(0);
    return true;
  }

  /**
   * Vuelve a grabar el capítulo que suena, con su misma voz, porque quedó desactualizado.
   * Si cambió el texto (el libro se reprocesó), es gratis y no pregunta; si cambió la voz,
   * cuesta como generarlo de nuevo. Mientras, sigue sonando el audio anterior y, al quedar
   * listo, se pasa al nuevo al empezar la oración siguiente.
   */
  async regenerate(): Promise<boolean> {
    const loaded = this.state.loaded;
    const book = loaded && this.state.books[loaded.bookId];
    const chapter = loaded && this.#chapter(loaded.bookId, loaded.chapterId);
    if (!loaded?.outdated || !book || !chapter || !this.canGenerate(book)) return false;
    const running = this.jobFor(chapter.id, loaded.voiceId);
    if (running && running.status !== 'error') return true;
    const voice = loaded.voiceId;
    if (loaded.outdated === 'voice') {
      let usage: Usage;
      try {
        usage = await this.usage();
      } catch (error) {
        this.#set({ notice: audioErrorMessage(error) });
        return false;
      }
      if (chapter.characterCount > usage.remaining) {
        const missing = formatNumber(chapter.characterCount - usage.remaining);
        this.#set({
          notice: `Tu cuota del mes no alcanza para volver a grabar «${chapter.title}» (faltan ${missing} caracteres).`,
        });
        return false;
      }
      if (needsConfirmation(chapter.characterCount, usage.quota)) {
        const ok = await this.ask({
          title: `¿Volver a grabar «${chapter.title}» con ${this.voiceName(voice)}?`,
          body: `Usa ${formatNumber(chapter.characterCount)} de los ${formatNumber(usage.remaining)} caracteres que te quedan este mes.`,
          confirm: 'Volver a grabar',
          cancel: 'Ahora no',
        });
        if (!ok) return false;
      }
    }

    const job: Job = {
      bookId: book.id,
      chapterId: chapter.id,
      voiceId: voice,
      status: 'pending',
      done: 0,
      total: 0,
      prefetch: false,
      refresh: true,
    };
    this.#updateJob(job);
    try {
      await this.api.post(`/api/v1/chapters/${chapter.id}/audio`, { voiceId: voice });
    } catch (error) {
      this.#dropJob(chapter.id, voice);
      // Ya estaba al día (otra pestaña lo regeneró): se carga el nuevo.
      if (error instanceof ApiError && error.code === 'AUDIO_ALREADY_EXISTS') {
        this.#onGenerated({ ...job, status: 'ready' });
        return true;
      }
      this.#set({ notice: audioErrorMessage(error) });
      return false;
    }
    void this.queryClient.invalidateQueries({ queryKey: ['usage'] });
    this.#schedulePoll(0);
    return true;
  }

  /** La consulta del consumo del mes (la comparten el botón de generar y el controlador). */
  usageQuery() {
    return {
      queryKey: ['usage'],
      queryFn: () => this.api.get<Usage>('/api/v1/users/me/usage'),
      staleTime: 5_000,
    };
  }

  usage(): Promise<Usage> {
    return this.queryClient.fetchQuery(this.usageQuery());
  }

  #updateJob(job: Job) {
    this.#set({ jobs: { ...this.state.jobs, [jobKey(job.chapterId, job.voiceId)]: job } });
  }

  #dropJob(chapterId: string, voiceId: string) {
    const jobs = { ...this.state.jobs };
    delete jobs[jobKey(chapterId, voiceId)];
    this.#set({ jobs });
  }

  #schedulePoll(delay = 1000) {
    window.clearTimeout(this.#pollTimer);
    const active = Object.values(this.state.jobs).some(
      (j) => j.status === 'pending' || j.status === 'processing',
    );
    if (active) this.#pollTimer = window.setTimeout(() => void this.#poll(), delay);
  }

  /** Consulta el estado de lo que se está generando (el taller muestra done/total). */
  async #poll(): Promise<void> {
    const active = Object.values(this.state.jobs).filter(
      (j) => j.status === 'pending' || j.status === 'processing',
    );
    await Promise.all(
      active.map(async (job) => {
        try {
          const state = await this.api.get<AudioState>(
            `/api/v1/chapters/${job.chapterId}/audio?voice=${encodeURIComponent(job.voiceId)}`,
          );
          const latest = this.jobFor(job.chapterId, job.voiceId) ?? job;
          // Una regeneración que falla deja la grabación anterior (lista, pero desactualizada).
          if (latest.refresh && state.status === 'ready' && state.outdated) {
            this.#updateJob({
              ...latest,
              status: 'error',
              error: 'el servicio de voz no respondió',
            });
          } else if (state.status === 'ready') {
            this.#updateJob({
              ...latest,
              status: 'ready',
              done: latest.total,
              total: latest.total,
            });
            this.#onGenerated(latest);
          } else if (state.status === 'error' || state.status === 'none') {
            this.#updateJob({
              ...latest,
              status: 'error',
              error: 'el servicio de voz no respondió',
            });
            void this.queryClient.invalidateQueries({ queryKey: ['usage'] });
          } else {
            this.#updateJob({
              ...latest,
              status: state.status,
              done: state.progress?.done ?? 0,
              total: state.progress?.total ?? 0,
            });
          }
        } catch {
          /* sin red: se reintenta en el siguiente ciclo */
        }
      }),
    );
    this.#schedulePoll();
  }

  /** Terminó una generación: se refresca el libro y, si es lo que suena, se cambia a ella. */
  #onGenerated(job: Job) {
    this.#refreshBooks();
    void this.queryClient.invalidateQueries({ queryKey: ['usage'] });
    // Un audio regenerado trae otros tiempos: la alineación guardada ya no sirve.
    this.#alignments.delete(jobKey(job.chapterId, job.voiceId));
    const loaded = this.state.loaded;
    if (job.refresh && loaded?.chapterId === job.chapterId && loaded.voiceId === job.voiceId) {
      this.#switchSource(true);
    } else if (this.#pendingPlay === job.chapterId && job.voiceId === this.state.voice) {
      this.#pendingPlay = null;
      void this.load(job.bookId, job.chapterId, { play: true, sentence: 0 });
    } else if (loaded?.chapterId === job.chapterId && job.voiceId === this.state.voice) {
      this.#switchSource();
    }
  }

  #refreshBooks() {
    void this.queryClient.invalidateQueries({ queryKey: ['book'] });
    void this.queryClient.invalidateQueries({ queryKey: ['books'], refetchType: 'none' });
  }

  /** Siguiente capítulo narrativo con texto que narrar. */
  #nextNarratable(bookId: string, chapterId: string): ChapterSummary | null {
    const chapters = this.state.books[bookId]?.chapters ?? [];
    const index = chapters.findIndex((c) => c.id === chapterId);
    return (
      chapters.slice(index + 1).find((c) => c.kind === 'narrative' && c.characterCount > 0) ?? null
    );
  }

  /** El siguiente capítulo con audio descargado (con alguna voz), o null. */
  #nextDownloaded(bookId: string, chapterId: string): ChapterSummary | null {
    const chapters = this.state.books[bookId]?.chapters ?? [];
    const index = chapters.findIndex((c) => c.id === chapterId);
    return (
      chapters
        .slice(index + 1)
        .find((c) => this.readyVoices(c).some((voice) => downloads.voice(c.id, voice))) ?? null
    );
  }

  /** Capítulo con audio más cercano en la dirección indicada. */
  audioChapter(bookId: string, chapterId: string, step: 1 | -1): ChapterSummary | null {
    const chapters = this.state.books[bookId]?.chapters ?? [];
    for (let i = chapters.findIndex((c) => c.id === chapterId) + step; i >= 0; i += step) {
      const chapter = chapters[i];
      if (!chapter) return null;
      if (this.hasAudio(chapter)) return chapter;
    }
    return null;
  }

  /** Al pasar el 70 % del capítulo, se pide el siguiente si es barato (frontend §5.3). */
  #prefetchNext(): void {
    const loaded = this.state.loaded;
    const voice = this.state.voice;
    if (!loaded || !voice) return;
    const next = this.#nextNarratable(loaded.bookId, loaded.chapterId);
    const key = next && jobKey(next.id, voice);
    if (!next || !key || this.#prefetched.has(key)) return;
    this.#prefetched.add(key);
    const book = this.state.books[loaded.bookId];
    if (book && this.canGenerate(book) && !this.readyVoices(next).includes(voice)) {
      void this.generate(loaded.bookId, next.id, { prefetch: true });
    }
  }

  // ------------------------------------------------------------ eventos del <audio>

  #onPlay() {
    Sound.setNarrating(true);
    this.#set({ playing: true });
    cancelAnimationFrame(this.#frame);
    const tick = () => {
      this.#sync();
      if (!this.audio.paused) this.#frame = requestAnimationFrame(tick);
    };
    this.#frame = requestAnimationFrame(tick);
  }

  #onPause() {
    Sound.setNarrating(false);
    this.#set({ playing: false });
    const loaded = this.state.loaded;
    if (loaded && this.state.sentence >= 0) {
      this.progress.record(loaded.bookId, loaded.chapterId, this.state.sentence, 'listening');
    }
    // Una voz nueva esperaba el fin de la oración: en pausa ya no hay por qué esperar.
    if (this.#pendingSwitch) void this.#swap(this.state.sentence, false);
    else this.#sync();
  }

  /** Tiempo → oración; avisa a quien dibuja, guarda la posición y adelanta el siguiente. */
  #sync() {
    for (const listener of this.#frameListeners) listener();
    const loaded = this.state.loaded;
    if (!loaded) return;
    const ms = this.audio.currentTime * 1000;
    const now = performance.now();
    if (now - this.#lastTimeUpdate > 250 || this.audio.paused) {
      this.#lastTimeUpdate = now;
      this.#set({ timeMs: ms });
    }
    if (!this.audio.paused && ms > loaded.durationMs * 0.7) this.#prefetchNext();
    const sentence = timeToSentence(loaded.alignment, ms);
    if (sentence === this.state.sentence) return;
    const forward = sentence > this.state.sentence;
    this.#set({ sentence });
    if (sentence >= 0) {
      this.progress.record(loaded.bookId, loaded.chapterId, sentence, 'listening');
    }
    // Empezó otra oración: buen momento para pasar a la voz recién generada.
    if (this.#pendingSwitch && forward && !this.audio.paused) void this.#swap(sentence, true);
  }

  async #onEnded() {
    const loaded = this.state.loaded;
    if (!loaded) return;
    this.#positions.delete(loaded.chapterId);
    // Sin red: el siguiente descargado (saltando los que no); si no hay, se detiene.
    if (!onlineManager.isOnline()) {
      const saved = this.#nextDownloaded(loaded.bookId, loaded.chapterId);
      if (saved) {
        this.#advance(loaded.chapterId, saved.id);
        await this.load(loaded.bookId, saved.id, { play: true, sentence: 0 });
      } else {
        Sound.play('hoot');
        this.#set({ notice: 'No hay más capítulos descargados.' });
        this.#sync();
      }
      return;
    }
    const book = this.state.books[loaded.bookId];
    const voice = this.state.voice;
    const upcoming = this.#nextNarratable(loaded.bookId, loaded.chapterId);
    // Si el siguiente no tiene audio con la voz elegida y se puede generar, se espera por
    // él en vez de saltarlo o de oírlo con otra voz.
    if (
      book &&
      upcoming &&
      voice &&
      this.canGenerate(book) &&
      !this.readyVoices(upcoming).includes(voice)
    ) {
      this.#advance(loaded.chapterId, upcoming.id);
      this.#pendingPlay = upcoming.id;
      const started = await this.generate(loaded.bookId, upcoming.id, { prefetch: false });
      if (!started) this.#pendingPlay = null;
      return;
    }
    const next = this.audioChapter(loaded.bookId, loaded.chapterId, 1);
    if (next) {
      this.#advance(loaded.chapterId, next.id);
      await this.load(loaded.bookId, next.id, { play: true, sentence: 0 });
    } else {
      Sound.play('hoot');
      this.#sync();
    }
  }

  #advance(from: string, to: string) {
    const loaded = this.state.loaded;
    if (loaded) this.progress.record(loaded.bookId, to, 0, 'listening');
    this.#set({ advanced: { from, to, at: Date.now() } });
  }

  /** La URL firmada venció (pausa larga): se pide otra y se sigue en el mismo punto. */
  async #onError() {
    const loaded = this.state.loaded;
    if (!loaded || Date.now() < loaded.expiresAt - 60_000) return;
    const at = this.audio.currentTime;
    const wasPlaying = this.state.playing;
    try {
      const fresh = await this.#fetchAudio(loaded.bookId, loaded.chapterId, loaded.voiceId);
      this.#set({ loaded: fresh });
      this.audio.src = fresh.src;
      await this.#whenReady();
      this.audio.currentTime = at;
      if (wasPlaying) await this.audio.play().catch(() => undefined);
    } catch (error) {
      this.#set({ notice: audioErrorMessage(error) });
    }
  }

  // ------------------------------------------------------------ Media Session

  /** Controles del sistema: pantalla de bloqueo, auto, auriculares (frontend §5.2). */
  #setMediaSession() {
    const loaded = this.state.loaded;
    const book = loaded && this.state.books[loaded.bookId];
    const chapter = loaded && this.#chapter(loaded.bookId, loaded.chapterId);
    if (!('mediaSession' in navigator) || !book || !chapter || !loaded) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: chapter.title,
      artist: book.author,
      album: book.title,
      // Las portadas privadas piden token: solo las públicas se pueden pasar como URL.
      artwork: book.isPublic && book.coverUrl ? [{ src: book.coverUrl }] : [],
    });
    const step = (direction: 1 | -1) => {
      const current = this.state.loaded;
      const target = current && this.audioChapter(current.bookId, current.chapterId, direction);
      if (!current || !target) return;
      this.#advance(current.chapterId, target.id);
      void this.load(current.bookId, target.id, { play: true, sentence: 0 });
    };
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => void this.play()],
      ['pause', () => this.pause()],
      ['seekbackward', () => this.seekBy(-15_000)],
      ['seekforward', () => this.seekBy(15_000)],
      ['seekto', (details) => this.seekTo((details.seekTime ?? 0) * 1000)],
      ['previoustrack', () => step(-1)],
      ['nexttrack', () => step(1)],
    ];
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* acción no soportada por este navegador */
      }
    }
  }
}
