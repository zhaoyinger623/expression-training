import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from './config.js';
import { ApiExceptionFilter } from './common/api-exception.filter.js';
import { HealthController } from './health.controller.js';
import { TopicsModule } from './topics/topics.module.js';
import { AttemptsModule } from './attempts/attempts.module.js';

@Module({
  imports: [ConfigModule, TopicsModule, AttemptsModule],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }],
})
export class AppModule {}
