import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { RedisService } from '../../infrastructure/redis/redis.module.js';

export interface DependencyHealth {
  status: 'up' | 'down';
  latencyMs: number;
  error?: string;
}

export interface HealthReport {
  status: 'ok' | 'degraded';
  database: DependencyHealth;
  redis: DependencyHealth;
}

/** Estado de las dependencias: lo usan `GET /health` (api) y el arranque del worker. */
@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthReport> {
    const [database, redis] = await Promise.all([
      probe(() => this.prisma.$queryRaw`SELECT 1`),
      probe(async () => {
        if (this.redis.status === 'wait') await this.redis.connect();
        await this.redis.ping();
      }),
    ]);
    const status = database.status === 'up' && redis.status === 'up' ? 'ok' : 'degraded';
    return { status, database, redis };
  }
}

async function probe(action: () => Promise<unknown>): Promise<DependencyHealth> {
  const started = performance.now();
  try {
    await withTimeout(action(), 2000);
    return { status: 'up', latencyMs: Math.round(performance.now() - started) };
  } catch (error) {
    return {
      status: 'down',
      latencyMs: Math.round(performance.now() - started),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`sin respuesta en ${ms} ms`)), ms),
    ),
  ]);
}
