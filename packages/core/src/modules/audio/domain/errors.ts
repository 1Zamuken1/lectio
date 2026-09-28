import { AppError } from '../../../common/errors/app-error.js';

export class AudioAlreadyExistsError extends AppError {
  constructor() {
    super(409, 'AUDIO_ALREADY_EXISTS', 'Este capítulo ya tiene audio con esa voz.');
  }
}

/** RF-24: capítulos generándose a la vez por usuario. */
export class AudioConcurrencyLimitError extends AppError {
  constructor(limit: number) {
    super(
      429,
      'AUDIO_CONCURRENCY_LIMIT',
      `Ya tienes ${limit} capítulos generándose; espera a que termine alguno.`,
      { limit },
    );
  }
}

/** RF-23: la cuota mensual no alcanza para este capítulo. */
export class TtsQuotaExceededError extends AppError {
  constructor(details: { required: number; remaining: number; resetsAt: string }) {
    super(
      429,
      'TTS_QUOTA_EXCEEDED',
      'No te alcanza la cuota de este mes para este capítulo.',
      details,
    );
  }
}

/** El audio de los libros públicos lo genera el sistema, no los usuarios. */
export class PublicBookAudioError extends AppError {
  constructor() {
    super(403, 'PUBLIC_BOOK_AUDIO', 'El audio de los libros públicos lo genera Lectio.');
  }
}

export class VoiceNotAvailableError extends AppError {
  constructor(available: string[]) {
    super(400, 'VOICE_NOT_AVAILABLE', 'Esa voz no está disponible para el idioma del libro.', {
      available,
    });
  }
}

export class VoiceNotFoundError extends AppError {
  constructor() {
    super(404, 'VOICE_NOT_FOUND', 'No existe esa voz.');
  }
}

export class VoiceSampleNotReadyError extends AppError {
  constructor() {
    super(404, 'VOICE_SAMPLE_NOT_READY', 'La muestra de esta voz todavía se está generando.');
  }
}

export class MediaUrlError extends AppError {
  constructor(code: 'MEDIA_URL_INVALID' | 'MEDIA_URL_EXPIRED') {
    super(
      403,
      code,
      code === 'MEDIA_URL_EXPIRED'
        ? 'El enlace venció; pide de nuevo el estado del audio.'
        : 'Enlace no válido.',
    );
  }
}
