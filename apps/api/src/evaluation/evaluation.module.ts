import { Module } from '@nestjs/common';
import { EvaluationService } from './evaluation.service.js';
import { EvaluationController } from './evaluation.controller.js';

@Module({ controllers: [EvaluationController], providers: [EvaluationService], exports: [EvaluationService] })
export class EvaluationModule {}
