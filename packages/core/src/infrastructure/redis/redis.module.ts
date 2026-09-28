import { Global, Inject, Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';

/** Conexión a Redis para uso general (salud, límites). BullMQ abre las suyas. */
@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    // BullMQ exige maxRetriesPerRequest: null en sus conexiones; aquí se usa igual.
    super(config.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
  }

  async onModuleDestroy(): Promise<void> {
    this.disconnect();
  }
}

@Global()
@Module({ providers: [RedisService], exports: [RedisService] })
export class RedisModule {}
