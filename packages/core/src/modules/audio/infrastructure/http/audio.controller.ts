import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, type SessionUser } from '../../../auth/infrastructure/http/decorators.js';
import { AudioService } from '../../application/audio.service.js';
import { AudioRequestResponseDto, AudioStateDto, RequestAudioDto } from './dto.js';

const chapterId = new ParseUUIDPipe({ version: '7' });

@ApiTags('audio')
@ApiBearerAuth()
@Controller('chapters/:id/audio')
export class AudioController {
  constructor(private readonly audio: AudioService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Pide el audio de un capítulo con una voz',
    description:
      'Reserva los caracteres del capítulo de la cuota mensual y lo encola; consulta GET hasta que status sea ready. Si ya se está generando, responde 200 con el estado (idempotente).',
  })
  @ApiAcceptedResponse({ type: AudioRequestResponseDto, description: 'Encolado.' })
  @ApiOkResponse({ type: AudioRequestResponseDto, description: 'Ya se estaba generando.' })
  @ApiBadRequestResponse({ description: 'VOICE_NOT_AVAILABLE (incluye available)' })
  @ApiForbiddenResponse({ description: 'BOOK_FORBIDDEN o PUBLIC_BOOK_AUDIO' })
  @ApiConflictResponse({ description: 'AUDIO_ALREADY_EXISTS' })
  @ApiTooManyRequestsResponse({
    description:
      'AUDIO_CONCURRENCY_LIMIT (incluye limit) o TTS_QUOTA_EXCEEDED (incluye required, remaining y resetsAt)',
  })
  async request(
    @CurrentUser() user: SessionUser,
    @Param('id', chapterId) id: string,
    @Body() body: RequestAudioDto,
    @Res({ passthrough: true }) response: { status(code: number): unknown },
  ): Promise<AudioRequestResponseDto> {
    const result = await this.audio.request(user.userId, id, body.voiceId);
    response.status(result.created ? 202 : 200);
    return AudioRequestResponseDto.from(result);
  }

  @Get()
  @ApiOperation({
    summary: 'Estado del audio de un capítulo con una voz',
    description:
      'Con status ready trae las URL firmadas del MP3 y de la alineación; mientras se genera, el progreso.',
  })
  @ApiQuery({ name: 'voice', required: false, example: 'gonzalo' })
  @ApiOkResponse({ type: AudioStateDto })
  async state(
    @CurrentUser() user: SessionUser,
    @Param('id', chapterId) id: string,
    @Query('voice') voice?: string,
  ): Promise<AudioStateDto> {
    return AudioStateDto.from(await this.audio.state(user.userId, id, voice || undefined));
  }
}
