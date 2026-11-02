import type { PipeTransform } from '@nestjs/common';
import { ApiException } from './api-exception.js';

export interface AudioUpload {
  buffer: Buffer;
  mimetype: string;
}

export const audioUploadOptions = {
  limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 1, fieldSize: 16 * 1024 },
};

/** 两个录音入口共用校验，内部转写服务直接接收已校验的音频。 */
export class AudioUploadPipe implements PipeTransform {
  transform(audio: AudioUpload | undefined): AudioUpload {
    if (!audio?.buffer.length) {
      throw new ApiException(400, 'INVALID_REQUEST', '请上传非空录音文件');
    }
    const mimetype = audio.mimetype.split(';')[0].toLowerCase();
    if (!['audio/webm', 'video/webm', 'audio/mp4', 'video/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3'].includes(mimetype)) {
      throw new ApiException(415, 'UNSUPPORTED_AUDIO_FORMAT', '请上传 WebM、MP4/M4A、WAV 或 MP3 录音');
    }
    return { buffer: audio.buffer, mimetype };
  }
}
