import { ApiProperty } from '@nestjs/swagger';

export class SentenceDto {
  @ApiProperty({ description: 'Clave de sincronización entre lectura y audio.' })
  index!: number;

  @ApiProperty({ description: 'Bloque del HTML (atributo data-b); -1 = anuncio del capítulo.' })
  blockIndex!: number;

  @ApiProperty({ description: 'Inicio [start, end) dentro del texto del bloque.' })
  start!: number;

  @ApiProperty()
  end!: number;

  @ApiProperty({ description: 'false = la oración no se narra (número de página, cita…).' })
  narrated!: boolean;
}

export class NoteDto {
  @ApiProperty({ example: 'fn3' })
  id!: string;

  @ApiProperty({ example: '<p>…</p>' })
  html!: string;
}

export class ChapterDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  bookId!: string;

  @ApiProperty()
  orderIndex!: number;

  @ApiProperty()
  title!: string;

  @ApiProperty({ type: [String] })
  ancestors!: string[];

  @ApiProperty({ enum: ['narrative', 'front_matter', 'back_matter', 'notes'] })
  kind!: string;

  @ApiProperty({
    description:
      'HTML sanitizado: bloques con data-b, llamadas a nota como <a data-lectio-note>, imágenes con la ruta del EPUB (ver GET /books/:id/resources).',
  })
  contentHtml!: string;

  @ApiProperty({ type: [SentenceDto] })
  sentences!: SentenceDto[];

  @ApiProperty({ type: [NoteDto] })
  notes!: NoteDto[];
}
