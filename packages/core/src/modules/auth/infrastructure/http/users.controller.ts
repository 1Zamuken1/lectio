import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from '../../application/auth.service.js';
import { UnauthorizedError } from '../../domain/errors.js';
import { CurrentUser, type SessionUser } from './decorators.js';
import { MeDto } from './dto.js';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly auth: AuthService) {}

  @Get('me')
  @ApiOperation({ summary: 'La cuenta de la sesión actual' })
  @ApiOkResponse({ type: MeDto })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED: falta el access token o venció.' })
  async me(@CurrentUser() session: SessionUser): Promise<MeDto> {
    const user = await this.auth.currentUser(session.userId);
    if (!user) throw new UnauthorizedError('La cuenta ya no existe.');
    return { id: user.id, email: user.email, createdAt: user.createdAt.toISOString() };
  }
}
