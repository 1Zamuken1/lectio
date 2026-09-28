import { Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '@lectio/core';
import { createApp } from './app.js';

const app = await createApp();
const config = app.get<AppConfig>(APP_CONFIG);
await app.listen(config.API_PORT);
Logger.log(
  `API en http://localhost:${config.API_PORT}/api/v1 · documentación en http://localhost:${config.API_PORT}/api/docs`,
  'Lectio',
);
