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
export { StorageModule } from './modules/storage/storage.module.js';
export {
  FILE_STORAGE,
  storageKeys,
  mediaTypeOf,
  type FileStorage,
} from './modules/storage/file-storage.js';
export { BooksModule } from './modules/books/books.module.js';
export { BookProcessingModule } from './modules/books/book-processing.module.js';
export { BooksService } from './modules/books/application/books.service.js';
export { uuidv7 } from './common/ids/uuid.js';
export { ChaptersModule } from './modules/chapters/chapters.module.js';
export { ReadingProgressModule } from './modules/reading-progress/reading-progress.module.js';
