import { Controller, Get, Headers, Inject, Param, Query, Res } from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { resolveVoice } from '@lectio/tts';
import { AppError } from '../../../../common/errors/app-error.js';
import { Public } from '../../../auth/infrastructure/http/decorators.js';
import { FILE_STORAGE, mediaTypeOf, type FileStorage } from '../../../storage/file-storage.js';
import { MediaUrlSigner } from '../../application/media-urls.js';
import { sampleKey } from '../../application/voice-samples.service.js';
import { VoiceNotFoundError, VoiceSampleNotReadyError } from '../../domain/errors.js';
import { availableVoices } from '../../domain/voices.js';
import { parseRange } from './range.js';
import { VoiceDto } from './dto.js';

interface MediaResponse extends NodeJS.WritableStream {
  status(code: number): MediaResponse;
  setHeader(name: string, value: string | number): void;
  end(): this;
}

/** Solo el audio y la alineación se sirven firmados; nada más del storage. */
const SIGNED_KEY =
  /^books\/[0-9a-f-]{36}\/audio\/[A-Za-z0-9-]+\/[0-9a-f-]{36}\.[0-9a-f]+\.(mp3|alignment\.json)$/;

/**
 * Sirve archivos del storage con soporte de Range (206), que el reproductor necesita para
 * adelantar y retroceder (docs/lectio-arquitectura-api.md §1.7). Con R2 o S3 esto lo hace
 * el propio storage; en local, la API.
 */
async function sendFile(
  storage: FileStorage,
  key: string,
  rangeHeader: string | undefined,
  response: MediaResponse,
  cacheControl: string,
): Promise<void> {
  const size = await storage.size(key);
  if (size === null) throw new AppError(404, 'MEDIA_NOT_FOUND', 'El archivo no existe.');
  const range = parseRange(rangeHeader, size);
  response.setHeader('Content-Type', mediaTypeOf(key));
  response.setHeader('Accept-Ranges', 'bytes');
  response.setHeader('Cache-Control', cacheControl);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (range === 'unsatisfiable') {
    response.setHeader('Content-Range', `bytes */${size}`);
    response.status(416).end();
    return;
  }
  const file = await storage.openRead(key, range ?? undefined);
  if (!file) throw new AppError(404, 'MEDIA_NOT_FOUND', 'El archivo no existe.');
  if (range) {
    response.status(206);
    response.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
    response.setHeader('Content-Length', range.end - range.start + 1);
  } else {
    response.status(200);
    response.setHeader('Content-Length', size);
  }
  file.stream.pipe(response);
}

@ApiTags('audio')
@Controller('media')
export class MediaController {
  constructor(
    private readonly signer: MediaUrlSigner,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Audio o alineación con URL firmada',
    description:
      'No usa la sesión: el permiso va en la URL (la entrega GET /chapters/:id/audio). Admite Range.',
  })
  @ApiQuery({ name: 'key' })
  @ApiQuery({ name: 'exp' })
  @ApiQuery({ name: 'sig' })
  @ApiHeader({ name: 'Range', required: false, example: 'bytes=0-' })
  @ApiProduces('audio/mpeg', 'application/json')
  @ApiOkResponse({ description: 'El archivo completo.' })
  @ApiResponse({ status: 206, description: 'El tramo pedido con Range.' })
  @ApiForbiddenResponse({ description: 'MEDIA_URL_INVALID o MEDIA_URL_EXPIRED' })
  async media(
    @Query() query: { key?: string; exp?: string; sig?: string },
    @Headers('range') range: string | undefined,
    @Res() response: MediaResponse,
  ): Promise<void> {
    const key = this.signer.verify(query);
    if (!SIGNED_KEY.test(key)) throw new AppError(403, 'MEDIA_URL_INVALID', 'Enlace no válido.');
    // Las claves llevan la versión de la voz: el contenido de una clave nunca cambia.
    await sendFile(this.storage, key, range, response, 'private, max-age=3600, immutable');
  }
}

@ApiTags('voices')
@Controller('voices')
export class VoicesController {
  constructor(@Inject(FILE_STORAGE) private readonly storage: FileStorage) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Voces disponibles, con su muestra',
    description: 'La de por defecto primero.',
  })
  @ApiQuery({ name: 'language', required: false, example: 'es' })
  @ApiOkResponse({ type: [VoiceDto] })
  list(@Query('language') language?: string): VoiceDto[] {
    return availableVoices(language || undefined).map(VoiceDto.from);
  }

  @Get(':id/sample')
  @Public()
  @ApiOperation({ summary: 'Muestra de unos segundos de una voz' })
  @ApiProduces('audio/mpeg')
  @ApiNotFoundResponse({ description: 'VOICE_NOT_FOUND o VOICE_SAMPLE_NOT_READY' })
  async sample(
    @Param('id') id: string,
    @Headers('range') range: string | undefined,
    @Res() response: MediaResponse,
  ): Promise<void> {
    const voice = availableVoices().find((v) => v.id.toLowerCase() === id.toLowerCase());
    if (!voice) throw new VoiceNotFoundError();
    const key = sampleKey(resolveVoice(voice.id, voice.language));
    if ((await this.storage.size(key)) === null) throw new VoiceSampleNotReadyError();
    await sendFile(this.storage, key, range, response, 'public, max-age=86400');
  }
}
