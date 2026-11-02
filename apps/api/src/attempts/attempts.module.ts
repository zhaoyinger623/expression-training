import { Module } from '@nestjs/common';
import { EvaluationModule } from '../evaluation/evaluation.module.js';
import { TranscriptionModule } from '../transcription/transcription.module.js';
import { AttemptsController } from './attempts.controller.js';
import { PracticesModule } from '../practices/practices.module.js';

@Module({ imports: [TranscriptionModule, EvaluationModule, PracticesModule], controllers: [AttemptsController] })
export class AttemptsModule {}
