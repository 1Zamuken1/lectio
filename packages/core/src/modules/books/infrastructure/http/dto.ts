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

export class LibraryProgressDto {
  @ApiProperty({ example: 4, description: 'orderIndex del capítulo actual.' })
  chapterOrder!: number;

  @ApiProperty({ example: 27 })
  totalChapters!: number;

  @ApiProperty({ enum: ['reading', 'listening'] })
  mode!: string;
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

  @ApiProperty({ description: 'Del catálogo público de Lectio (sin dueño, no se puede borrar).' })
  isPublic!: boolean;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'marianela',
    description: 'Solo libros públicos: /libros/:slug.',
  })
  slug!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: LibraryProgressDto, nullable: true, required: false })
  progress?: LibraryProgressDto | null;

  static from(book: BookSummary): BookSummaryDto {
    return {
      id: book.id,
      title: book.title,
      author: book.author,
      language: book.language,
      status: book.status,
      errorCode: book.errorCode,
      coverUrl: book.hasCover ? `/api/v1/books/${book.id}/cover` : null,
      isPublic: book.isPublic,
      slug: book.slug,
      createdAt: book.createdAt.toISOString(),
      ...(book.progress !== undefined ? { progress: book.progress } : {}),
    };
  }
}

export class ChapterAudioDto {
  @ApiProperty({ example: 'gonzalo' })
  voiceId!: string;

  @ApiProperty({ enum: ['pending', 'processing', 'ready', 'error'] })
  status!: string;
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

  @ApiProperty({
    type: [ChapterAudioDto],
    description: 'Audio pedido para este capítulo, por voz.',
  })
  audio!: ChapterAudioDto[];

  static from(chapter: ChapterSummary): ChapterSummaryDto {
    return { ...chapter, audio: chapter.audio.map((a) => ({ ...a })) };
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
