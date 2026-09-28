import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type SessionUser } from '../../../auth/infrastructure/http/decorators.js';
import { AudioService } from '../../application/audio.service.js';
import { UsageDto } from './dto.js';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users/me/usage')
export class UsageController {
  constructor(private readonly audio: AudioService) {}

  @Get()
  @ApiOperation({
    summary: 'Consumo de TTS de este mes',
    description: 'remaining = quota − consumed − reserved. La cuota se reinicia el día 1 (UTC).',
  })
  @ApiOkResponse({ type: UsageDto })
  async usage(@CurrentUser() user: SessionUser): Promise<UsageDto> {
    return UsageDto.from(await this.audio.usage(user.userId));
  }
}
