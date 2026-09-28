import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, type SessionUser } from '../../../auth/infrastructure/http/decorators.js';
import { ReadingProgressService } from '../../application/reading-progress.service.js';
import { PositionDto, SaveProgressDto, SaveProgressResponseDto } from './dto.js';

@ApiTags('progress')
@ApiBearerAuth()
@Controller('books/:id/progress')
export class ReadingProgressController {
  constructor(private readonly progress: ReadingProgressService) {}

  @Put()
  @ApiOperation({
    summary: 'Guarda la posición en el libro',
    description:
      'Gana el clientUpdatedAt más reciente: si ya había uno posterior (de otro dispositivo), no se sobrescribe y se devuelve la posición vigente.',
  })
  @ApiOkResponse({ type: SaveProgressResponseDto })
  @ApiBadRequestResponse({
    description:
      'CHAPTER_NOT_IN_BOOK, SENTENCE_OUT_OF_RANGE, CLIENT_TIME_IN_FUTURE o VALIDATION_FAILED',
  })
  async save(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) bookId: string,
    @Body() body: SaveProgressDto,
  ): Promise<SaveProgressResponseDto> {
    const result = await this.progress.save(user.userId, bookId, {
      ...body,
      clientUpdatedAt: new Date(body.clientUpdatedAt),
    });
    return result.applied
      ? { applied: true, clientUpdatedAt: new Date(body.clientUpdatedAt).toISOString() }
      : { applied: false, current: PositionDto.from(result.current) };
  }

  @Get()
  @ApiOperation({ summary: 'Posición actual en el libro (o el inicio si no hay)' })
  @ApiOkResponse({ type: PositionDto })
  async get(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) bookId: string,
  ): Promise<PositionDto> {
    return PositionDto.from(await this.progress.get(user.userId, bookId));
  }
}
