// @lectio/core: dominio, casos de uso y adaptadores compartidos por apps/api y apps/worker
// (docs/lectio-arquitectura-api.md §1.2). Cada app registra los módulos que necesita.

export { ConfigModule, APP_CONFIG } from './config/config.module.js';
export { loadConfig, type AppConfig } from './config/env.js';
export { AppError } from './common/errors/app-error.js';
export { ErrorFilter } from './common/errors/error.filter.js';
export { PrismaModule } from './infrastructure/prisma/prisma.module.js';
export { PrismaService } from './infrastructure/prisma/prisma.service.js';
export { QUEUES, QueuesModule } from './infrastructure/queues/queues.module.js';
export { RedisModule, RedisService } from './infrastructure/redis/redis.module.js';
export { HealthModule } from './modules/health/health.module.js';
export {
  HealthService,
  type DependencyHealth,
  type HealthReport,
} from './modules/health/health.service.js';
export { validationPipe } from './common/validation.js';
export { AuthModule } from './modules/auth/auth.module.js';
export { AuthService } from './modules/auth/application/auth.service.js';
export { JwtAuthGuard } from './modules/auth/infrastructure/http/jwt-auth.guard.js';
export {
  CurrentUser,
  Public,
  type SessionUser,
} from './modules/auth/infrastructure/http/decorators.js';
