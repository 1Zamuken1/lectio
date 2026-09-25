import type { VoiceKind } from '../narration/dialogue.js';

/**
 * Puerto de TTS (docs/lectio-arquitectura-api.md §1.4). El pipeline no llama a ningún
 * servicio: define el contrato y calcula fragmentos y alineación. Cada proveedor
 * (Edge, Kokoro, Azure...) es un adaptador que vive fuera de este paquete.
 */

export interface TtsBoundary {
  /** Posición de la palabra dentro del texto enviado. */
  textOffset: number;
  textLength: number;
  /** Momento en que empieza a sonar, desde el inicio del audio de ese fragmento. */
  audioOffsetMs: number;
  /** Cuánto dura la palabra, si el proveedor lo informa. */
  durationMs?: number;
}

export interface TtsResult {
  /** Audio en el formato común acordado (MP3 24 kHz mono). */
  audio: Buffer;
  durationMs: number;
  /** Marcas por palabra. Vacío si el proveedor no las entrega. */
  boundaries: TtsBoundary[];
}

export interface TtsProvider {
  readonly name: string;
  /** Tamaño máximo de texto por solicitud. */
  readonly maxChunkChars: number;
  synthesize(input: {
    text: string;
    voiceId: string;
    language: string;
    /** Tramo de narración o de diálogo: el proveedor puede leerlos con prosodias distintas. */
    kind?: VoiceKind;
  }): Promise<TtsResult>;
}

/** Tiempos de cada oración narrada dentro del audio del capítulo (`alignment.json`). */
export interface Alignment {
  version: 1;
  durationMs: number;
  /** true si el proveedor no dio marcas de palabra y los tiempos se estimaron por longitud. */
  approximate: boolean;
  sentences: Array<{ index: number; startMs: number; endMs: number }>;
}
