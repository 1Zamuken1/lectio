import { AppError } from '../../../common/errors/app-error.js';

export class ChapterNotInBookError extends AppError {
  constructor() {
    super(400, 'CHAPTER_NOT_IN_BOOK', 'Ese capítulo no es de este libro.');
  }
}

export class SentenceOutOfRangeError extends AppError {
  constructor(sentenceCount: number) {
    super(400, 'SENTENCE_OUT_OF_RANGE', 'La oración no existe en ese capítulo.', { sentenceCount });
  }
}

/** Un reloj adelantado no puede ganarle para siempre a los demás dispositivos. */
export class ClientTimeInFutureError extends AppError {
  constructor() {
    super(
      400,
      'CLIENT_TIME_IN_FUTURE',
      'La hora del dispositivo está adelantada más de 5 minutos.',
    );
  }
}
