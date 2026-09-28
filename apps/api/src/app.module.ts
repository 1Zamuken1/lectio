import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import {
  APP_CONFIG,
  AuthModule,
  BooksModule,
  ChaptersModule,
  ConfigModule,
  HealthModule,
  JwtAuthGuard,
  PrismaModule,
  QueuesModule,
  ReadingProgressModule,
  RedisModule,
  StorageModule,
  type AppConfig,
} from '@lectio/core';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    HealthModule,
    QueuesModule,
    StorageModule,
    AuthModule,
    BooksModule,
    ChaptersModule,
    ReadingProgressModule,
    // Límite global por IP (arquitectura §1.8); las rutas sensibles lo ajustan con @Throttle.
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
        skipIf: () => !config.RATE_LIMIT_ENABLED,
      }),
    }),
  ],
  controllers: [HealthController],
  providers: [
    // Primero el límite de solicitudes, después la sesión: un ataque de fuerza bruta no llega a argon2.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
  ],
})
export class AppModule {}
