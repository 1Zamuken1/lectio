import { Module } from '@nestjs/common';
import {
  BookProcessingModule,
  ConfigModule,
  HealthModule,
  PrismaModule,
  QueuesModule,
  RedisModule,
  StorageModule,
} from '@lectio/core';

/**
 * El worker registra los processors de las colas (libros; el audio llega en la fase 4) y ningún controlador: nunca
 * recibe tráfico HTTP, así el proceso que abre archivos subidos no queda expuesto.
 */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    QueuesModule,
    StorageModule,
    HealthModule,
    BookProcessingModule,
  ],
})
export class WorkerModule {}
