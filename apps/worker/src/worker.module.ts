import { Module } from '@nestjs/common';
import { ConfigModule, HealthModule, PrismaModule, QueuesModule, RedisModule } from '@lectio/core';

/**
 * El worker registra los processors de las colas (fases 2 y 4) y ningún controlador: nunca
 * recibe tráfico HTTP, así el proceso que abre archivos subidos no queda expuesto.
 */
@Module({
  imports: [ConfigModule, PrismaModule, RedisModule, QueuesModule, HealthModule],
})
export class WorkerModule {}
