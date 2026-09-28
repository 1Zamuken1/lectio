import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';
import type { AudioRequestResult, AudioState, Usage } from '../../application/audio.service.js';
import type { AvailableVoice } from '../../domain/voices.js';

const STATES = ['none', 'pending', 'processing', 'ready', 'error'];

export class RequestAudioDto {
  @ApiProperty({
    required: false,
    example: 'gonzalo',
    description:
      'Perfil de voz (GET /voices). Si se omite, el de por defecto del idioma del libro.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  voiceId?: string;
}

export class QuotaDto {
  @ApiProperty({ example: 181550 })
  remaining!: number;
}

export class AudioRequestResponseDto {
  @ApiProperty({ format: 'uuid' })
  chapterId!: string;

  @ApiProperty({ example: 'gonzalo' })
  voiceId!: string;

  @ApiProperty({ enum: ['pending', 'processing'] })
  status!: string;

  @ApiProperty({
    type: QuotaDto,
    required: false,
    description: 'Solo al crear la solicitud (202).',
  })
  quota?: QuotaDto;

  static from(result: AudioRequestResult): AudioRequestResponseDto {
    const base = { chapterId: result.chapterId, voiceId: result.voiceId, status: result.status };
    return result.created ? { ...base, quota: { remaining: result.remaining } } : base;
  }
}

export class AudioProgressDto {
  @ApiProperty({ example: 42, description: 'Unidades de voz sintetizadas.' })
  done!: number;

  @ApiProperty({ example: 180, description: '0 mientras el worker no lo toma.' })
  total!: number;
}

export class AudioStateDto {
  @ApiProperty({ format: 'uuid' })
  chapterId!: string;

  @ApiProperty({ example: 'gonzalo' })
  voiceId!: string;

  @ApiProperty({ enum: STATES })
  status!: string;

  @ApiProperty({
    type: AudioProgressDto,
    nullable: true,
    description: 'Solo en pending/processing.',
  })
  progress!: AudioProgressDto | null;

  @ApiProperty({ nullable: true, type: String, description: 'URL firmada; admite Range (206).' })
  audioUrl!: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'URL firmada del alignment.json.' })
  alignmentUrl!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'date-time',
    description: 'Vencimiento de las URL.',
  })
  expiresAt!: string | null;

  @ApiProperty({ nullable: true, type: Number, example: 245310 })
  durationMs!: number | null;

  @ApiProperty({ nullable: true, type: String, example: 'edge' })
  provider!: string | null;

  @ApiProperty({
    description: 'El perfil de voz cambió desde que se generó; se puede pedir de nuevo.',
  })
  outdated!: boolean;

  static from(state: AudioState): AudioStateDto {
    return { ...state, expiresAt: state.expiresAt?.toISOString() ?? null };
  }
}

export class UsageDto {
  @ApiProperty({ format: 'date-time' })
  periodStart!: string;

  @ApiProperty({ format: 'date-time' })
  resetsAt!: string;

  @ApiProperty({ example: 300000 })
  quota!: number;

  @ApiProperty({ example: 99790, description: 'Cobrado este mes (audio ya generado).' })
  consumed!: number;

  @ApiProperty({ example: 18660, description: 'Reservado por el audio que se está generando.' })
  reserved!: number;

  @ApiProperty({ example: 181550 })
  remaining!: number;

  @ApiProperty({ example: 84213, description: 'Histórico, desde que existe la cuenta.' })
  totalCharactersProcessed!: number;

  static from(usage: Usage): UsageDto {
    return {
      ...usage,
      periodStart: usage.periodStart.toISOString(),
      resetsAt: usage.resetsAt.toISOString(),
    };
  }
}

export class VoiceDto {
  @ApiProperty({ example: 'gonzalo' })
  id!: string;

  @ApiProperty({ example: 'Gonzalo' })
  name!: string;

  @ApiProperty({ example: 'es' })
  language!: string;

  @ApiProperty({ description: 'La que se usa si no se elige ninguna.' })
  isDefault!: boolean;

  @ApiProperty({ example: '/api/v1/voices/gonzalo/sample' })
  sampleUrl!: string;

  static from(voice: AvailableVoice): VoiceDto {
    return { ...voice, sampleUrl: `/api/v1/voices/${encodeURIComponent(voice.id)}/sample` };
  }
}
