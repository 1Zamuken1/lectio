import type { TtsBoundary, TtsProvider, TtsResult, VoiceKind } from '@lectio/epub-pipeline';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import type { Readable } from 'node:stream';
import { mp3DurationMs, trimMp3 } from './mp3.js';
import type { Prosody } from './voices.js';

/**
 * Adaptador de Microsoft Edge TTS (docs/lectio-decision-tts.md). Servicio no oficial:
 * sin SLA, y Microsoft puede cambiarlo. Por eso vive detrás del puerto `TtsProvider`:
 * reemplazarlo por Kokoro o Azure no toca el pipeline.
 *
 * Librería: `msedge-tts` (MIT). Se descartó `edge-tts-universal` por su licencia AGPL-3.0,
 * incompatible con un posible uso comercial del worker.
 *
 * Edge acepta un solo `<prosody>` por solicitud: varios, `contour` o `mstts:express-as`
 * cierran la conexión sin audio (probado). Por eso narración y diálogo van en solicitudes
 * separadas, cada una con su prosodia.
 */

const OUTPUT = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3;
/** Los offsets de Edge vienen en unidades de 100 ns. */
const TICKS_PER_MS = 10_000;
const REQUEST_TIMEOUT_MS = 90_000;
const RETRIES = 4;
/** Recorte del silencio de Edge: margen antes de la primera palabra y tras la última. */
const LEAD_MS = 30;
const TAIL_MS = 90;

export class EdgeTtsProvider implements TtsProvider {
  readonly name = 'edge';
  /**
   * Edge acepta unos 4 KB por solicitud (ver docs/lectio-decision-tts.md §2.3); con tildes
   * en UTF-8 y el envoltorio SSML, 2.500 caracteres dejan margen.
   */
  readonly maxChunkChars = 2500;

  #client: MsEdgeTTS | null = null;
  #voice: string | null = null;
  readonly #prosody: Record<VoiceKind, Prosody>;
  readonly #trimSilence: boolean;

  /**
   * `prosody`: velocidad y tono de la narración y del diálogo (un perfil de voz).
   * `trimSilence`: quitar el silencio que Edge pone al inicio y al final de cada
   * solicitud, para que las pausas las decida el montaje.
   */
  constructor(options: { prosody: Record<VoiceKind, Prosody>; trimSilence?: boolean }) {
    this.#prosody = options.prosody;
    this.#trimSilence = options.trimSilence ?? false;
  }

  async synthesize(input: {
    text: string;
    voiceId: string;
    language: string;
    kind?: VoiceKind;
  }): Promise<TtsResult> {
    const prosody = this.#prosody[input.kind ?? 'narration'];
    let lastError: unknown;
    for (let attempt = 1; attempt <= RETRIES; attempt++) {
      try {
        return await this.#request(input.text, input.voiceId, prosody);
      } catch (error) {
        lastError = error;
        this.close(); // la conexión puede haber quedado inservible: se abre otra
        if (attempt < RETRIES) await sleep(1000 * 2 ** (attempt - 1));
      }
    }
    throw new Error(`Edge TTS falló tras ${RETRIES} intentos: ${describe(lastError)}`, {
      cause: lastError,
    });
  }

  close(): void {
    this.#client?.close();
    this.#client = null;
    this.#voice = null;
  }

  async #request(text: string, voice: string, prosody: Prosody): Promise<TtsResult> {
    const client = await this.#connect(voice);
    // El texto se inserta tal cual dentro del SSML: hay que escapar lo que es XML.
    const { audioStream, metadataStream } = client.toStream(escapeXml(text), prosody);
    // Las marcas llegan antes que el fin del audio, pero el stream de metadatos no siempre
    // se cierra: se acumula lo recibido y se termina cuando termina el audio.
    const metadataChunks: Buffer[] = [];
    metadataStream?.on('data', (chunk: Buffer) => metadataChunks.push(Buffer.from(chunk)));
    let audio = await withTimeout(collect(audioStream), REQUEST_TIMEOUT_MS);
    // Cada evento es un mensaje: se parsean por separado para que uno corrupto no arrastre al resto.
    const metadata = metadataChunks.map((chunk) => chunk.toString('utf8'));
    if (audio.length === 0) throw new Error('Edge TTS devolvió un audio vacío');

    let boundaries = wordBoundaries(metadata, text);
    const span = speechSpan(metadata);
    if (this.#trimSilence && span) {
      const trimmed = trimMp3(audio, span.startMs - LEAD_MS, span.endMs + TAIL_MS);
      audio = trimmed.audio;
      boundaries = boundaries.map((b) => ({
        ...b,
        audioOffsetMs: Math.max(0, b.audioOffsetMs - trimmed.startMs),
      }));
    }
    return { audio, durationMs: Math.round(mp3DurationMs(audio)), boundaries };
  }

  async #connect(voice: string): Promise<MsEdgeTTS> {
    if (this.#client && this.#voice === voice) return this.#client;
    this.close();
    const client = new MsEdgeTTS();
    await client.setMetadata(voice, OUTPUT, { wordBoundaryEnabled: true });
    this.#client = client;
    this.#voice = voice;
    return client;
  }
}

interface WordEntry {
  Type?: string;
  Data?: { Offset?: number; Duration?: number; text?: { Text?: string } };
}

function wordEntries(messages: string[]): WordEntry[] {
  return messages
    .flatMap(parseMessage)
    .flatMap((message) => ((message as { Metadata?: unknown[] }).Metadata ?? []) as WordEntry[])
    .filter((e) => e.Type === 'WordBoundary' && typeof e.Data?.Offset === 'number');
}

/**
 * Edge informa cada palabra con su texto y su momento, pero no su posición en el texto
 * enviado. Se ubica buscando cada palabra en orden a partir de la anterior; una palabra
 * que no se encuentra (el motor la normalizó) simplemente no genera marca.
 */
export function wordBoundaries(messages: string[], text: string): TtsBoundary[] {
  const boundaries: TtsBoundary[] = [];
  let cursor = 0;
  for (const entry of wordEntries(messages)) {
    const word = entry.Data!.text?.Text;
    if (!word) continue;
    const at = text.indexOf(word, cursor);
    if (at === -1) continue;
    const duration = entry.Data!.Duration;
    boundaries.push({
      textOffset: at,
      textLength: word.length,
      audioOffsetMs: entry.Data!.Offset! / TICKS_PER_MS,
      ...(typeof duration === 'number' ? { durationMs: duration / TICKS_PER_MS } : {}),
    });
    cursor = at + word.length;
  }
  return boundaries;
}

/**
 * Desde el inicio de la primera palabra hasta el fin de la última, con todas las marcas
 * (aunque su texto no se haya ubicado): recortar según `wordBoundaries` podría cortar
 * una palabra final que el motor normalizó ("1914" → "mil novecientos catorce").
 */
export function speechSpan(messages: string[]): { startMs: number; endMs: number } | null {
  const entries = wordEntries(messages);
  if (entries.length === 0) return null;
  const startMs = Math.min(...entries.map((e) => e.Data!.Offset!)) / TICKS_PER_MS;
  const endMs =
    Math.max(...entries.map((e) => e.Data!.Offset! + (e.Data!.Duration ?? 0))) / TICKS_PER_MS;
  return { startMs, endMs };
}

/**
 * Un mensaje suele ser un objeto JSON. Si no se puede parsear entero (varios objetos
 * pegados), se separa por balance de llaves; lo que no se entiende se descarta.
 */
function parseMessage(message: string): unknown[] {
  try {
    return [JSON.parse(message)];
  } catch {
    return [...jsonObjects(message)];
  }
}

/** Objetos JSON concatenados en un mismo texto, separados por balance de llaves. */
function* jsonObjects(stream: string): Generator<unknown> {
  let depth = 0;
  let start = -1;
  let inString = false;
  for (let i = 0; i < stream.length; i++) {
    const char = stream[i];
    if (inString) {
      if (char === '\\') i++;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        try {
          yield JSON.parse(stream.slice(start, i + 1));
        } catch {
          /* mensaje incompleto o corrupto: se ignora */
        }
        start = -1;
      }
    }
  }
}

function escapeXml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function collect(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`sin respuesta en ${ms / 1000} s`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
