import { Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { TranscriptionResponse } from '@expression/shared';
import { ApiException } from '../common/api-exception.js';
import { TranscriptionService } from './transcription.service.js';
import { AudioUploadPipe, audioUploadOptions } from '../common/audio-upload.js';
import type { AudioUpload } from '../common/audio-upload.js';

@Controller('api/transcriptions')
export class TranscriptionController {
  constructor(private readonly transcription: TranscriptionService) {}

  @Post()
  @UseInterceptors(FileInterceptor('audio', audioUploadOptions))
  async create(
    @UploadedFile(new AudioUploadPipe()) audio: AudioUpload,
    @Body('durationSeconds') durationSeconds: unknown,
  ): Promise<TranscriptionResponse> {
    const duration = typeof durationSeconds === 'string' ? Number(durationSeconds) : NaN;
    if (!Number.isFinite(duration) || duration <= 0 || duration > 180) {
      throw new ApiException(400, 'INVALID_REQUEST', '录音时长必须大于 0 且不超过 180 秒');
    }
    return { transcript: await this.transcription.transcribe(audio.buffer, audio.mimetype) };
  }
}
