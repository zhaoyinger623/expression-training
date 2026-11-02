import { Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { TranscriptionResponse } from '@expression/shared';
import { ApiException } from '../common/api-exception.js';
import { TranscriptionService } from './transcription.service.js';

@Controller('api/transcriptions')
export class TranscriptionController {
  constructor(private readonly transcription: TranscriptionService) {}

  @Post()
  @UseInterceptors(FileInterceptor('audio', {
    limits: { fileSize: 6 * 1024 * 1024, files: 1, fields: 1, fieldSize: 1024 },
  }))
  async create(
    @UploadedFile() audio: { buffer: Buffer; mimetype: string } | undefined,
    @Body('durationSeconds') durationSeconds: unknown,
  ): Promise<TranscriptionResponse> {
    if (!audio?.buffer.length) {
      throw new ApiException(400, 'INVALID_REQUEST', '请上传非空录音文件');
    }
    const duration = typeof durationSeconds === 'string' ? Number(durationSeconds) : NaN;
    if (!Number.isFinite(duration) || duration <= 0 || duration > 180) {
      throw new ApiException(400, 'INVALID_REQUEST', '录音时长必须大于 0 且不超过 180 秒');
    }
    const mimeType = audio.mimetype.split(';')[0].toLowerCase();
    if (!['audio/webm', 'video/webm', 'audio/mp4', 'video/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3'].includes(mimeType)) {
      throw new ApiException(415, 'UNSUPPORTED_AUDIO_FORMAT', '请上传 WebM、MP4/M4A、WAV 或 MP3 录音');
    }
    return { transcript: await this.transcription.transcribe(audio.buffer, mimeType) };
  }
}
