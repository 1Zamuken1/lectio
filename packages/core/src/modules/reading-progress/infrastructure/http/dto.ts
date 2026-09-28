import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsISO8601, IsUUID, Min } from 'class-validator';
import type { Position } from '../../domain/model.js';

export class SaveProgressDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('7', { message: 'chapterId debe ser el id de un capítulo.' })
  chapterId!: string;

  @ApiProperty({ example: 143, description: 'Índice de la oración (Chapter.sentences[].index).' })
  @IsInt({ message: 'sentenceIndex debe ser un entero.' })
  @Min(0, { message: 'sentenceIndex no puede ser negativo.' })
  sentenceIndex!: number;

  @ApiProperty({ enum: ['reading', 'listening'] })
  @IsIn(['reading', 'listening'], { message: 'mode debe ser reading o listening.' })
  mode!: 'reading' | 'listening';

  @ApiProperty({
    format: 'date-time',
    example: '2026-09-28T09:58:12Z',
    description: 'Cuándo estuvo el usuario en esa posición (no cuándo se envía).',
  })
  @IsISO8601({ strict: true }, { message: 'clientUpdatedAt debe ser una fecha ISO 8601.' })
  clientUpdatedAt!: string;
}

export class PositionDto {
  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  chapterId!: string | null;

  @ApiProperty()
  sentenceIndex!: number;

  @ApiProperty({ enum: ['reading', 'listening'] })
  mode!: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  clientUpdatedAt!: string | null;

  static from(position: Position | null): PositionDto {
    if (!position)
      return { chapterId: null, sentenceIndex: 0, mode: 'reading', clientUpdatedAt: null };
    return { ...position, clientUpdatedAt: position.clientUpdatedAt.toISOString() };
  }
}

export class SaveProgressResponseDto {
  @ApiProperty({ description: 'false: había un progreso más reciente (de otro dispositivo).' })
  applied!: boolean;

  @ApiProperty({ format: 'date-time', required: false })
  clientUpdatedAt?: string;

  @ApiProperty({
    type: PositionDto,
    required: false,
    description: 'La posición vigente, si no se aplicó.',
  })
  current?: PositionDto;
}
