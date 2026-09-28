import { Controller, Get, Headers, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  OptionalAuth,
  OptionalUser,
  type SessionUser,
} from '../../../auth/infrastructure/http/decorators.js';
import { ChaptersService, matchesEtag } from '../../application/chapters.service.js';
import { ChapterDto } from './dto.js';

interface CachedResponse {
  setHeader(name: string, value: string): void;
  status(code: number): CachedResponse;
  end(): void;
  json(body: unknown): void;
}

@ApiTags('chapters')
@ApiBearerAuth()
@Controller('chapters')
export class ChaptersController {
  constructor(private readonly chapters: ChaptersService) {}

  @Get(':id')
  @OptionalAuth()
  @ApiOperation({
    summary: 'Contenido de un capítulo para leer',
    description:
      'Con If-None-Match igual al ETag responde 304 sin cuerpo: el capítulo no se vuelve a descargar. Sin sesión solo en libros públicos.',
  })
  @ApiHeader({ name: 'If-None-Match', required: false })
  @ApiOkResponse({ type: ChapterDto, headers: { ETag: { description: 'Versión del capítulo' } } })
  @ApiResponse({ status: 304, description: 'No cambió desde el ETag enviado.' })
  @ApiForbiddenResponse({ description: 'BOOK_FORBIDDEN' })
  @ApiNotFoundResponse({ description: 'CHAPTER_NOT_FOUND' })
  async read(
    @OptionalUser() user: SessionUser | null,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res() response: CachedResponse,
  ): Promise<void> {
    const { etag, chapter } = await this.chapters.read(user?.userId ?? null, id);
    response.setHeader('ETag', etag);
    // El navegador lo guarda, pero lo revalida siempre: si el libro se reprocesa, se entera.
    response.setHeader('Cache-Control', 'private, no-cache');
    if (matchesEtag(ifNoneMatch, etag)) return response.status(304).end();
    response.json(chapter());
  }
}
