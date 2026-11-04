import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ApiConfig } from './config.js';
import { attachRealtimeTranscription } from './transcription/realtime-transcription.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ApiConfig);
  app.enableCors({ origin: config.webOrigin });
  attachRealtimeTranscription(app.getHttpServer(), config);
  await app.listen(config.port);
}

void bootstrap();
