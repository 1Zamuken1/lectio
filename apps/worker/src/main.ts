import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { HealthService, QUEUES } from '@lectio/core';
import { WorkerModule } from './worker.module.js';

// Contexto de aplicación, sin servidor HTTP.
const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
app.enableShutdownHooks();
app.flushLogs(); // sin listen() nadie las vuelca: los logs quedarían retenidos

const logger = new Logger('Worker');
const health = await app.get(HealthService).check();
if (health.status !== 'ok') {
  logger.error(`Dependencias sin responder: ${JSON.stringify(health)}`);
  await app.close();
  process.exit(1);
}
logger.log(`Worker listo · colas: ${Object.values(QUEUES).join(', ')}`);
