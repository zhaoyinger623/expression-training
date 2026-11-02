import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from './config.js';
import { ApiExceptionFilter } from './common/api-exception.filter.js';
import { HealthController } from './health.controller.js';
import { TopicsModule } from './topics/topics.module.js';
import { TranscriptionModule } from './transcription/transcription.module.js';
import { EvaluationModule } from './evaluation/evaluation.module.js';

@Module({
  imports: [ConfigModule, TopicsModule, TranscriptionModule, EvaluationModule],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }],
})
export class AppModule {}
