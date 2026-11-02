import { Module } from '@nestjs/common';
import { EvaluationModule } from '../evaluation/evaluation.module.js';
import { TranscriptionModule } from '../transcription/transcription.module.js';
import { AttemptsController } from './attempts.controller.js';

@Module({ imports: [TranscriptionModule, EvaluationModule], controllers: [AttemptsController] })
export class AttemptsModule {}
