import { Global, Module } from '@nestjs/common';
import { loadConfig, type AppConfig } from './env.js';

/** Token de inyección de la configuración: `@Inject(APP_CONFIG) config: AppConfig`. */
export const APP_CONFIG = Symbol('APP_CONFIG');

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: (): AppConfig => loadConfig() }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
