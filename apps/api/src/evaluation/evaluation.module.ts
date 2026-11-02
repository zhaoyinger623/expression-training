import { Module } from '@nestjs/common';
import { EvaluationService } from './evaluation.service.js';

@Module({ providers: [EvaluationService], exports: [EvaluationService] })
export class EvaluationModule {}
