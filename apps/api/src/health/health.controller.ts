import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { HealthService, Public } from '@lectio/core';

interface StatusResponse {
  status(code: number): StatusResponse;
  json(body: unknown): void;
}

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** Estado de la API y sus dependencias. 503 si la base o Redis no responden. */
  @Get()
  @ApiOkResponse({ description: 'La API, Postgres y Redis responden.' })
  @ApiServiceUnavailableResponse({ description: 'Alguna dependencia no responde.' })
  async check(@Res() response: StatusResponse): Promise<void> {
    const report = await this.health.check();
    response
      .status(report.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
      .json(report);
  }
}
