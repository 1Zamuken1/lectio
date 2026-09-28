import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AppError } from '../../../../common/errors/app-error.js';
import { CurrentUser, type SessionUser } from '../../../auth/infrastructure/http/decorators.js';
import { ResourceNotFoundError } from '../../../chapters/domain/errors.js';
import { BooksService } from '../../application/books.service.js';
import { BookDetailDto, BookSummaryDto, UploadResponseDto } from './dto.js';

interface UploadedEpub {
  originalname: string;
  buffer: Buffer;
}

interface BinaryResponse {
  setHeader(name: string, value: string): void;
  send(body: Buffer): void;
}

const bookId = new ParseUUIDPipe({ version: '7' });

/**
 * Las imágenes vienen del EPUB y un SVG puede traer scripts: abierto directamente desde la
 * API, se muestra aislado (sandbox, sin scripts ni recursos externos).
 */
const IMAGE_CSP = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox";

@ApiTags('books')
@ApiBearerAuth()
@Controller('books')
export class BooksController {
  constructor(private readonly books: BooksService) {}

  @Post()
  @HttpCode(202)
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Sube un EPUB',
    description:
      'Lo guarda y lo encola: el worker lo procesa en segundo plano. Consulta GET /books/:id hasta que status sea ready o error.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Archivo .epub sin DRM' },
      },
    },
  })
  @ApiAcceptedResponse({ type: UploadResponseDto })
  @ApiConflictResponse({ description: 'BOOK_ALREADY_EXISTS: ya lo subiste; incluye bookId.' })
  @ApiPayloadTooLargeResponse({ description: 'El archivo supera MAX_UPLOAD_MB.' })
  upload(
    @CurrentUser() user: SessionUser,
    @UploadedFile() file: UploadedEpub | undefined,
  ): Promise<UploadResponseDto> {
    return this.books.upload(
      user.userId,
      file ? { originalName: file.originalname, data: file.buffer } : undefined,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Tu biblioteca, del más reciente al más antiguo' })
  @ApiOkResponse({ type: [BookSummaryDto] })
  async list(@CurrentUser() user: SessionUser): Promise<BookSummaryDto[]> {
    return (await this.books.list(user.userId)).map(BookSummaryDto.from);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un libro con sus capítulos' })
  @ApiOkResponse({ type: BookDetailDto })
  @ApiForbiddenResponse({ description: 'BOOK_FORBIDDEN: es de otra persona.' })
  @ApiNotFoundResponse({ description: 'BOOK_NOT_FOUND' })
  async detail(
    @CurrentUser() user: SessionUser,
    @Param('id', bookId) id: string,
  ): Promise<BookDetailDto> {
    return BookDetailDto.fromDetail(await this.books.detail(user.userId, id));
  }

  @Get(':id/report')
  @ApiOperation({ summary: 'Reporte del pipeline: clasificación, limpieza y advertencias' })
  @ApiOkResponse({
    description: 'El reporte tal como lo guarda el pipeline (null si aún no termina).',
  })
  report(@CurrentUser() user: SessionUser, @Param('id', bookId) id: string): Promise<unknown> {
    return this.books.report(user.userId, id);
  }

  @Get(':id/cover')
  @ApiOperation({ summary: 'Portada del libro' })
  @ApiProduces('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml')
  @ApiNotFoundResponse({ description: 'COVER_NOT_FOUND: el libro no tiene portada.' })
  async cover(
    @CurrentUser() user: SessionUser,
    @Param('id', bookId) id: string,
    @Res() response: BinaryResponse,
  ): Promise<void> {
    const cover = await this.books.cover(user.userId, id);
    if (!cover) throw new AppError(404, 'COVER_NOT_FOUND', 'Este libro no tiene portada.');
    response.setHeader('Content-Type', cover.mediaType);
    response.setHeader('Cache-Control', 'private, max-age=86400');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', IMAGE_CSP);
    response.send(cover.data);
  }

  @Get(':id/resources')
  @ApiOperation({
    summary: 'Imagen de un capítulo',
    description: 'path es la ruta que aparece en el HTML del capítulo (la del EPUB).',
  })
  @ApiQuery({ name: 'path', example: 'OEBPS/img/figura.png' })
  @ApiNotFoundResponse({ description: 'RESOURCE_NOT_FOUND' })
  async resource(
    @CurrentUser() user: SessionUser,
    @Param('id', bookId) id: string,
    @Query('path') path: string | undefined,
    @Res() response: BinaryResponse,
  ): Promise<void> {
    const resource = path ? await this.books.resource(user.userId, id, path) : null;
    if (!resource) throw new ResourceNotFoundError();
    response.setHeader('Content-Type', resource.mediaType);
    // Las imágenes de un libro no cambian: se pueden guardar un día.
    response.setHeader('Cache-Control', 'private, max-age=86400');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', IMAGE_CSP);
    response.send(resource.data);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Borra un libro con sus capítulos, audio y progreso' })
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'BOOK_FORBIDDEN' })
  @ApiConflictResponse({ description: 'BOOK_BUSY: hay audio generándose.' })
  remove(@CurrentUser() user: SessionUser, @Param('id', bookId) id: string): Promise<void> {
    return this.books.remove(user.userId, id);
  }
}
