import { Module } from '@nestjs/common';
import { ConfigModule, HealthModule, PrismaModule, RedisModule } from '@lectio/core';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [ConfigModule, PrismaModule, RedisModule, HealthModule],
  controllers: [HealthController],
})
export class AppModule {}
