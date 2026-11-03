import { Body, Controller, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { TranscriptionResponse } from '@expression/shared';
import { ApiException } from '../common/api-exception.js';
import { TranscriptionService } from './transcription.service.js';
import { AudioUploadPipe, audioUploadOptions } from '../common/audio-upload.js';
import type { AudioUpload } from '../common/audio-upload.js';

interface StreamResponse {
  setHeader(name: string, value: string): void;
  flushHeaders(): void;
  write(chunk: string): void;
  end(): void;
}

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

  @Post('stream')
  @UseInterceptors(FileInterceptor('audio', audioUploadOptions))
  async createStream(
    @UploadedFile(new AudioUploadPipe()) audio: AudioUpload,
    @Body('durationSeconds') durationSeconds: unknown,
    @Res() response: StreamResponse,
  ): Promise<void> {
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders();
    const send = (event: unknown) => response.write(`data: ${JSON.stringify(event)}\n\n`);
    try {
      const duration = typeof durationSeconds === 'string' ? Number(durationSeconds) : NaN;
      if (!Number.isFinite(duration) || duration <= 0 || duration > 180) {
        throw new ApiException(400, 'INVALID_REQUEST', '录音时长必须大于 0 且不超过 180 秒');
      }
      const transcript = await this.transcription.transcribe(audio.buffer, audio.mimetype, (partial) => send({ type: 'delta', text: partial }));
      send({ type: 'complete', transcript });
    } catch (error) {
      const responseBody = error instanceof ApiException ? error.getResponse() : { code: 'INTERNAL_ERROR', message: '转写失败，请重试' };
      send({ type: 'error', error: responseBody });
    } finally {
      response.end();
    }
  }
}
