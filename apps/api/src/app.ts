import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { APP_CONFIG, ErrorFilter, type AppConfig } from '@lectio/core';
import { AppModule } from './app.module.js';

/**
 * Crea y configura la aplicación (prefijo, errores, CORS, OpenAPI). La usan `main.ts` y
 * los tests de integración, así ambos ven exactamente la misma API.
 */
export async function createApp(options: { logger?: false } = {}): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, ...options });
  const config = app.get<AppConfig>(APP_CONFIG);

  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ErrorFilter());
  app.enableShutdownHooks();
  // Solo los orígenes configurados (nunca "*"): las peticiones de sesión llevan credenciales.
  app.enableCors({
    origin: config.CORS_ORIGINS,
    credentials: true,
    exposedHeaders: ['ETag', 'Content-Range', 'Accept-Ranges', 'Content-Length'],
  });

  const openApi = new DocumentBuilder()
    .setTitle('Lectio API')
    .setDescription(
      'Biblioteca de EPUB que se leen y se escuchan con voz neuronal, sincronizados por oración.',
    )
    .setVersion('1')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, openApi));
  return app;
}
