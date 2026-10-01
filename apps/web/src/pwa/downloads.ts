import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { isUnreachable, type ApiClient } from '../api/client';
import type { BookDetail, Chapter, Schemas } from '../api/queries';
import type { Alignment } from '../player/sync';
import { DOWNLOADS_CACHE, chapterCacheUrl, mediaCacheUrl, resourceUrl } from './cache-keys';
import { lectioDb, type DownloadRecord, type DownloadedBook, type DownloadedVoice } from './db';

type AudioState = Schemas['AudioStateDto'];

interface DownloadsState {
  /** Ya se leyó lo guardado en IndexedDB. */
  loaded: boolean;
  chapters: Record<string, DownloadRecord>;
  books: Record<string, DownloadedBook>;
  /**
   * Capítulos que se están bajando o esperan su turno, con su avance de 0 a 1 (0: en
   * cola). El anillo del atril lo dibuja.
   */
  active: Record<string, number>;
}

export interface StorageUse {
  /** Lo que ocupan las descargas de Lectio. */
  downloads: number;
  /** Lo que el navegador dice que usa todo el sitio y lo que permite (si lo dice). */
  usage: number | null;
  quota: number | null;
  /** El navegador prometió no borrarlas solo cuando falte espacio. */
  persisted: boolean;
}

export { isUnreachable };

/**
 * Las descargas para leer y escuchar sin conexión (frontend §2.4 y §6.3). Siempre a mano:
 * por capítulo, con la voz que suena. El texto (el JSON del capítulo), sus imágenes, el
 * audio y la alineación van a Cache Storage; IndexedDB lleva la lista (qué capítulo, qué
 * voz, cuánto ocupa) y la ficha del libro, para abrirlo sin red.
 *
 * El Service Worker sirve lo descargado (sw.ts); el lector y el reproductor también lo
 * leen directo de la caché cuando la red falla, así funciona aunque no haya worker.
 */
export class Downloads {
  readonly store = createStore<DownloadsState>(() => ({
    loaded: false,
    chapters: {},
    books: {},
    active: {},
  }));

  #loading: Promise<void> | null = null;
  /** Se baja un capítulo a la vez: el anillo avanza parejo y la red no se reparte. */
  #queue: Promise<unknown> = Promise.resolve();
  #askedPersist = false;
  /**
   * Sin Service Worker, el audio descargado suena desde un blob. Se guardan los dos
   * últimos: al cambiar de voz, el que suena sigue vivo hasta que entra el nuevo.
   */
  #blobUrls: string[] = [];

  get state(): DownloadsState {
    return this.store.getState();
  }

  get supported(): boolean {
    return typeof caches !== 'undefined' && typeof indexedDB !== 'undefined';
  }

  /** Lee la lista guardada. Una vez por app; las demás llamadas esperan a la primera. */
  load(): Promise<void> {
    if (!this.supported) return Promise.resolve();
    this.#loading ??= (async () => {
      try {
        const db = await lectioDb();
        const [chapters, books] = await Promise.all([db.getAll('downloads'), db.getAll('books')]);
        this.store.setState({
          loaded: true,
          chapters: Object.fromEntries(chapters.map((c) => [c.chapterId, c])),
          books: Object.fromEntries(books.map((b) => [b.bookId, b])),
        });
      } catch {
        this.store.setState({ loaded: true });
      }
    })();
    return this.#loading;
  }

  // ------------------------------------------------------------ consultas

  chapter(chapterId: string): DownloadRecord | null {
    return this.state.chapters[chapterId] ?? null;
  }

  voice(chapterId: string, voiceId: string): DownloadedVoice | null {
    return this.chapter(chapterId)?.voices.find((v) => v.voiceId === voiceId) ?? null;
  }

  /** Si el libro tiene algo descargado (se abre sin conexión). */
  hasBook(bookId: string): boolean {
    return Object.values(this.state.chapters).some((c) => c.bookId === bookId);
  }

  /** La ficha guardada al descargar, por id o (los públicos) por `slug:<slug>`. */
  book(idOrSlug: string): BookDetail | null {
    const slug = idOrSlug.startsWith('slug:') ? idOrSlug.slice(5) : null;
    const found = slug
      ? Object.values(this.state.books).find((b) => b.slug === slug)
      : this.state.books[idOrSlug];
    return found?.detail ?? null;
  }

  bytes(record: DownloadRecord): number {
    return record.textBytes + record.voices.reduce((sum, v) => sum + v.bytes, 0);
  }

  async storageUse(): Promise<StorageUse> {
    const downloads = Object.values(this.state.chapters).reduce((s, c) => s + this.bytes(c), 0);
    const estimate = await navigator.storage?.estimate?.().catch(() => null);
    const persisted = (await navigator.storage?.persisted?.().catch(() => false)) ?? false;
    return {
      downloads,
      usage: estimate?.usage ?? null,
      quota: estimate?.quota ?? null,
      persisted,
    };
  }

  // ------------------------------------------------------------ leer lo descargado

  async readChapter(chapterId: string): Promise<Chapter | null> {
    if (!this.chapter(chapterId)) return null;
    const response = await this.#match(chapterCacheUrl(location.origin, chapterId));
    return response ? ((await response.json()) as Chapter) : null;
  }

  /** Una imagen de un capítulo descargado (la URL relativa con la que la pide el lector). */
  async readBlob(url: string): Promise<Blob | null> {
    const response = await this.#match(new URL(url, location.origin).href);
    return response ? response.blob() : null;
  }

  async readAlignment(voice: DownloadedVoice): Promise<Alignment | null> {
    const response = await this.#match(mediaCacheUrl(location.origin, voice.alignmentKey));
    return response ? ((await response.json()) as Alignment) : null;
  }

  /**
   * De dónde suena el audio descargado. Con Service Worker, la ruta de `/media` sin firma
   * (el worker la responde desde la caché, con Range); sin él, un blob.
   */
  async audioSrc(voice: DownloadedVoice): Promise<string | null> {
    const url = mediaCacheUrl(location.origin, voice.audioKey);
    if (navigator.serviceWorker?.controller) return url;
    const response = await this.#match(url);
    if (!response) return null;
    const blobUrl = URL.createObjectURL(await response.blob());
    this.#blobUrls.push(blobUrl);
    if (this.#blobUrls.length > 2) URL.revokeObjectURL(this.#blobUrls.shift()!);
    return blobUrl;
  }

  async #match(url: string): Promise<Response | null> {
    if (!this.supported) return null;
    const cache = await caches.open(DOWNLOADS_CACHE);
    return (await cache.match(url, { ignoreVary: true })) ?? null;
  }

  // ------------------------------------------------------------ descargar

  /**
   * Baja un capítulo: el texto, sus imágenes y, si se da una voz con audio listo, el audio
   * y la alineación. Si ya estaba, lo renueva y suma la voz. Si algo falla, no queda nada
   * a medias (salvo lo que ya estaba descargado). Va a la cola: uno a la vez.
   */
  downloadChapter(
    api: ApiClient,
    book: BookDetail,
    chapterId: string,
    voiceId: string | null,
  ): Promise<DownloadRecord> {
    if (this.state.active[chapterId] === undefined) this.#setProgress(chapterId, 0);
    const run = this.#queue.then(() => this.#download(api, book, chapterId, voiceId));
    this.#queue = run.catch(() => undefined);
    return run;
  }

  async #download(
    api: ApiClient,
    book: BookDetail,
    chapterId: string,
    voiceId: string | null,
  ): Promise<DownloadRecord> {
    await this.load();
    const summary = book.chapters.find((c) => c.id === chapterId);
    if (!summary) {
      this.#setProgress(chapterId, null);
      throw new Error('El capítulo no es de este libro');
    }
    this.#setProgress(chapterId, 0.02);
    const cache = await caches.open(DOWNLOADS_CACHE);
    const previous = this.chapter(chapterId);
    const written: string[] = [];
    try {
      void this.#askPersist();
      const text = await this.#saveText(api, cache, book.id, chapterId, written);
      let voices = previous?.voices ?? [];
      if (voiceId) {
        this.#setProgress(chapterId, TEXT_SHARE);
        const voice = await this.#saveVoice(api, cache, chapterId, voiceId, written, (f) =>
          this.#setProgress(chapterId, TEXT_SHARE + (1 - TEXT_SHARE) * f),
        );
        voices = [...voices.filter((v) => v.voiceId !== voiceId), voice];
      }
      const record: DownloadRecord = {
        chapterId,
        bookId: book.id,
        orderIndex: summary.orderIndex,
        images: text.images,
        textBytes: text.bytes,
        voices,
        savedAt: new Date().toISOString(),
      };
      await this.#commit(record, book, previous);
      return record;
    } catch (error) {
      const keep = new Set(previous ? this.#urlsOf(previous) : []);
      await Promise.all(written.filter((url) => !keep.has(url)).map((url) => cache.delete(url)));
      throw error;
    } finally {
      this.#setProgress(chapterId, null);
    }
  }

  /**
   * Lo que baja "Descargar los próximos 3": desde el capítulo dado (incluido), los
   * primeros `count` capítulos narrativos que faltan (o les falta la voz). Los ya
   * descargados y los que están en la cola se saltan: siempre suma tres más.
   */
  nextTargets(
    book: BookDetail,
    fromChapterId: string | null,
    voiceFor: (chapterId: string) => string | null,
    count = 3,
  ): string[] {
    const start = Math.max(
      0,
      book.chapters.findIndex((c) => c.id === fromChapterId),
    );
    return book.chapters
      .slice(start)
      .filter((c) => c.kind === 'narrative' && this.state.active[c.id] === undefined)
      .filter((c) => {
        const voice = voiceFor(c.id);
        return !this.chapter(c.id) || (voice !== null && !this.voice(c.id, voice));
      })
      .slice(0, count)
      .map((c) => c.id);
  }

  /** "Descargar los próximos 3", con aviso tras cada uno (`done` de `total`). */
  async downloadNext(
    api: ApiClient,
    book: BookDetail,
    fromChapterId: string | null,
    voiceFor: (chapterId: string) => string | null,
    onProgress?: (done: number, total: number) => void,
    count = 3,
  ): Promise<number> {
    const targets = this.nextTargets(book, fromChapterId, voiceFor, count);
    // Todos a la cola de una vez: sus anillos aparecen vacíos y se llenan por turno.
    const runs = targets.map((id) => this.downloadChapter(api, book, id, voiceFor(id)));
    let done = 0;
    onProgress?.(0, targets.length);
    for (const run of runs) {
      await run;
      onProgress?.(++done, targets.length);
    }
    return targets.length;
  }

  /**
   * El audio descargado ya no es el vigente (se regeneró: otra clave). Se baja el nuevo y
   * se borra el anterior; mientras, el anterior sigue sirviendo.
   */
  async refreshVoice(api: ApiClient, chapterId: string, voiceId: string): Promise<void> {
    const record = this.chapter(chapterId);
    const book = record && this.state.books[record.bookId];
    if (!record || !book || this.state.active[chapterId] !== undefined) return;
    this.#setProgress(chapterId, 0);
    const cache = await caches.open(DOWNLOADS_CACHE);
    const written: string[] = [];
    try {
      const voice = await this.#saveVoice(api, cache, chapterId, voiceId, written);
      const current = this.chapter(chapterId) ?? record;
      await this.#commit(
        { ...current, voices: [...current.voices.filter((v) => v.voiceId !== voiceId), voice] },
        book.detail,
        current,
      );
    } catch {
      await Promise.all(written.map((url) => cache.delete(url)));
    } finally {
      this.#setProgress(chapterId, null);
    }
  }

  async #saveText(
    api: ApiClient,
    cache: Cache,
    bookId: string,
    chapterId: string,
    written: string[],
  ): Promise<{ bytes: number; images: string[] }> {
    const response = await api.send(`/api/v1/chapters/${chapterId}`, { raw: true });
    const body = await response.text();
    const chapter = JSON.parse(body) as Chapter;
    const url = chapterCacheUrl(location.origin, chapterId);
    await cache.put(url, jsonResponse(body));
    written.push(url);
    let bytes = new Blob([body]).size;
    const images: string[] = [];
    for (const path of imagePaths(chapter.contentHtml)) {
      const relative = resourceUrl(bookId, path);
      try {
        const image = await api.send(relative, { raw: true });
        const blob = await image.blob();
        const absolute = new URL(relative, location.origin).href;
        await cache.put(absolute, blobResponse(blob, image.headers.get('Content-Type')));
        written.push(absolute);
        images.push(relative);
        bytes += blob.size;
      } catch (error) {
        // Una imagen que falta en el EPUB no impide leer; sin red, sí se corta.
        if (isUnreachable(error)) throw error;
      }
    }
    return { bytes, images };
  }

  async #saveVoice(
    api: ApiClient,
    cache: Cache,
    chapterId: string,
    voiceId: string,
    written: string[],
    onProgress: (fraction: number) => void = () => undefined,
  ): Promise<DownloadedVoice> {
    const state = await api.get<AudioState>(
      `/api/v1/chapters/${chapterId}/audio?voice=${encodeURIComponent(voiceId)}`,
    );
    const audioKey = state.audioUrl && keyOf(state.audioUrl);
    const alignmentKey = state.alignmentUrl && keyOf(state.alignmentUrl);
    if (state.status !== 'ready' || !audioKey || !alignmentKey) {
      throw new Error('El audio de este capítulo aún no está listo');
    }
    const existing = this.voice(chapterId, voiceId);
    if (existing?.audioKey === audioKey && existing.alignmentKey === alignmentKey) {
      return existing;
    }
    let bytes = 0;
    for (const [signed, key] of [
      [state.audioUrl!, audioKey],
      [state.alignmentUrl!, alignmentKey],
    ] as const) {
      // Sin Range: completo (200). Cache Storage no guarda respuestas parciales.
      const response = await fetch(signed);
      if (!response.ok) throw new Error('No se pudo bajar el audio');
      // El audio es casi todo el peso: su avance es el del anillo.
      const blob =
        key === audioKey ? await readWithProgress(response, onProgress) : await response.blob();
      const url = mediaCacheUrl(location.origin, key);
      await cache.put(url, blobResponse(blob, response.headers.get('Content-Type')));
      written.push(url);
      bytes += blob.size;
    }
    return { voiceId, audioKey, alignmentKey, bytes };
  }

  /** Guarda el registro y la ficha, y borra los archivos que el anterior tenía y este no. */
  async #commit(record: DownloadRecord, book: BookDetail, previous: DownloadRecord | null) {
    const saved: DownloadedBook = {
      bookId: book.id,
      slug: book.slug,
      detail: book,
      savedAt: record.savedAt,
    };
    const db = await lectioDb();
    const tx = db.transaction(['downloads', 'books'], 'readwrite');
    await Promise.all([
      tx.objectStore('downloads').put(record),
      tx.objectStore('books').put(saved),
      tx.done,
    ]);
    this.store.setState((s) => ({
      chapters: { ...s.chapters, [record.chapterId]: record },
      books: { ...s.books, [book.id]: saved },
    }));
    if (previous) {
      const kept = new Set(this.#urlsOf(record));
      await this.#deleteUrls(this.#urlsOf(previous).filter((url) => !kept.has(url)));
    }
  }

  // ------------------------------------------------------------ borrar

  async removeChapter(chapterId: string): Promise<void> {
    const record = this.chapter(chapterId);
    if (!record) return;
    const db = await lectioDb();
    await db.delete('downloads', chapterId);
    const chapters = { ...this.state.chapters };
    delete chapters[chapterId];
    const books = { ...this.state.books };
    const bookLeft = Object.values(chapters).some((c) => c.bookId === record.bookId);
    if (!bookLeft) {
      await db.delete('books', record.bookId);
      delete books[record.bookId];
    }
    this.store.setState({ chapters, books });
    await this.#deleteUrls(this.#urlsOf(record));
  }

  async removeBook(bookId: string): Promise<void> {
    for (const record of Object.values(this.state.chapters)) {
      if (record.bookId === bookId) await this.removeChapter(record.chapterId);
    }
  }

  /** Los capítulos descargados de libros privados (los de la cuenta, no los públicos). */
  privateChapters(): DownloadRecord[] {
    return Object.values(this.state.chapters).filter(
      (c) => this.state.books[c.bookId]?.detail.isPublic !== true,
    );
  }

  /** Al salir de la cuenta: se borran tus libros; los públicos se quedan (frontend §2.4). */
  async removePrivate(): Promise<void> {
    for (const record of this.privateChapters()) await this.removeChapter(record.chapterId);
  }

  async removeAll(): Promise<void> {
    if (!this.supported) return;
    const db = await lectioDb();
    const tx = db.transaction(['downloads', 'books'], 'readwrite');
    await Promise.all([
      tx.objectStore('downloads').clear(),
      tx.objectStore('books').clear(),
      tx.done,
    ]);
    this.store.setState({ chapters: {}, books: {} });
    await caches.delete(DOWNLOADS_CACHE);
  }

  /** Las URL de la caché de un capítulo descargado. */
  #urlsOf(record: DownloadRecord): string[] {
    return [
      chapterCacheUrl(location.origin, record.chapterId),
      ...record.images.map((path) => new URL(path, location.origin).href),
      ...record.voices.flatMap((v) => [
        mediaCacheUrl(location.origin, v.audioKey),
        mediaCacheUrl(location.origin, v.alignmentKey),
      ]),
    ];
  }

  /** Borra de la caché, salvo lo que otro capítulo descargado todavía usa (una viñeta común). */
  async #deleteUrls(urls: string[]): Promise<void> {
    const used = new Set(Object.values(this.state.chapters).flatMap((c) => this.#urlsOf(c)));
    const cache = await caches.open(DOWNLOADS_CACHE);
    await Promise.all(urls.filter((url) => !used.has(url)).map((url) => cache.delete(url)));
  }

  /** El avance de un capítulo en la cola (0 a 1), o null cuando termina. */
  #setProgress(chapterId: string, progress: number | null) {
    this.store.setState((s) => {
      const next = { ...s.active };
      if (progress === null) delete next[chapterId];
      else next[chapterId] = Math.min(1, Math.max(0, progress));
      return { active: next };
    });
  }

  /** Al primer uso, se pide que el navegador no borre las descargas cuando le falte espacio. */
  async #askPersist(): Promise<void> {
    if (this.#askedPersist) return;
    this.#askedPersist = true;
    if (await navigator.storage?.persisted?.()) return;
    await navigator.storage?.persist?.().catch(() => false);
  }
}

/** Las rutas de las imágenes de un capítulo (las mismas que el lector pide a la API). */
export function imagePaths(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const paths = [...doc.querySelectorAll('img')]
    .map((img) => img.getAttribute('src'))
    .filter((src): src is string => !!src);
  return [...new Set(paths)];
}

/** Del anillo, lo que corresponde al texto y las imágenes cuando también se baja audio. */
const TEXT_SHARE = 0.1;

/** Lee una respuesta entera avisando cuánto va (si dice su tamaño), unas 10 veces por segundo. */
async function readWithProgress(
  response: Response,
  onProgress: (fraction: number) => void,
): Promise<Blob> {
  const total = Number(response.headers.get('Content-Length')) || 0;
  if (!response.body || !total) return response.blob();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  let last = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    if (performance.now() - last > 100) {
      last = performance.now();
      onProgress(received / total);
    }
  }
  onProgress(1);
  return new Blob(chunks as BlobPart[], { type: response.headers.get('Content-Type') ?? '' });
}

function keyOf(url: string): string | null {
  return new URL(url, location.origin).searchParams.get('key');
}

function jsonResponse(body: string): Response {
  return new Response(body, { headers: { 'Content-Type': 'application/json' } });
}

function blobResponse(blob: Blob, type: string | null): Response {
  return new Response(blob, {
    headers: {
      'Content-Type': type ?? (blob.type || 'application/octet-stream'),
      'Content-Length': String(blob.size),
    },
  });
}

/** Las descargas de este navegador: una por app (no dependen de la sesión). */
export const downloads = new Downloads();

export function useDownloads<T>(selector: (state: DownloadsState) => T): T {
  return useStore(downloads.store, selector);
}
