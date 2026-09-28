import { ApiProperty } from '@nestjs/swagger';
import type { BookDetail, BookSummary, ChapterSummary } from '../../domain/model.js';

const STATUSES = ['pending', 'processing', 'ready', 'error'];
const KINDS = ['narrative', 'front_matter', 'back_matter', 'notes'];

export class UploadResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['pending'] })
  status!: 'pending';
}

export class BookSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ nullable: true, type: String, example: 'Marianela' })
  title!: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'Benito Pérez Galdós' })
  author!: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'es' })
  language!: string | null;

  @ApiProperty({ enum: STATUSES, description: 'pending → processing → ready | error' })
  status!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Si status = error: DRM_PROTECTED, INVALID_ARCHIVE, NO_TEXT_CONTENT…',
  })
  errorCode!: string | null;

  @ApiProperty({ nullable: true, type: String, example: '/api/v1/books/<id>/cover' })
  coverUrl!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  static from(book: BookSummary): BookSummaryDto {
    return {
      id: book.id,
      title: book.title,
      author: book.author,
      language: book.language,
      status: book.status,
      errorCode: book.errorCode,
      coverUrl: book.hasCover ? `/api/v1/books/${book.id}/cover` : null,
      createdAt: book.createdAt.toISOString(),
    };
  }
}

export class ChapterSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 4 })
  orderIndex!: number;

  @ApiProperty({ example: '-I- Perdido' })
  title!: string;

  @ApiProperty({
    type: [String],
    example: ['Capítulos'],
    description: 'Niveles superiores del índice.',
  })
  ancestors!: string[];

  @ApiProperty({ enum: KINDS, description: 'Por defecto el cliente muestra solo narrative.' })
  kind!: string;

  @ApiProperty({ description: 'Caracteres de narración (lo que cuenta para la cuota).' })
  characterCount!: number;

  @ApiProperty()
  sentenceCount!: number;

  static from(chapter: ChapterSummary): ChapterSummaryDto {
    return { ...chapter };
  }
}

export class BookDetailDto extends BookSummaryDto {
  @ApiProperty({ nullable: true, type: Number })
  pipelineVersion!: number | null;

  @ApiProperty({ type: [ChapterSummaryDto], description: 'Vacío hasta que el libro está ready.' })
  chapters!: ChapterSummaryDto[];

  static fromDetail(book: BookDetail): BookDetailDto {
    return {
      ...BookSummaryDto.from(book),
      pipelineVersion: book.pipelineVersion,
      chapters: book.chapters.map(ChapterSummaryDto.from),
    };
  }
}
