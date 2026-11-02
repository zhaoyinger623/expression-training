import { Module } from '@nestjs/common';
import { TranscriptionController } from './transcription.controller.js';
import { TranscriptionService } from './transcription.service.js';

@Module({
  controllers: [TranscriptionController],
  providers: [TranscriptionService],
  exports: [TranscriptionService],
})
export class TranscriptionModule {}
