import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
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
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AppError } from '../../../../common/errors/app-error.js';
import { CurrentUser, type SessionUser } from '../../../auth/infrastructure/http/decorators.js';
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
    response.send(cover.data);
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
