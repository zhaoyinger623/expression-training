import { Injectable } from '@nestjs/common';
import { ApiConfig } from '../config.js';
import { ApiException } from '../common/api-exception.js';

@Injectable()
export class TranscriptionService {
  constructor(private readonly config: ApiConfig) {}

  async transcribe(audio: Buffer, mimeType: string): Promise<string> {
    const { apiKey, baseUrl, model } = this.config.asr;
    if (!apiKey || !baseUrl) {
      throw new ApiException(503, 'SERVICE_NOT_CONFIGURED', '语音转写服务尚未配置');
    }

    let transcript: string;
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(60_000),
        body: JSON.stringify({
          model,
          stream: false,
          messages: [{
            role: 'user',
            content: [{ type: 'input_audio', input_audio: {
              data: `data:${mimeType};base64,${audio.toString('base64')}`,
            } }],
          }],
          asr_options: { enable_itn: false },
        }),
      });
      if (!response.ok) throw new Error('上游转写失败');
      const completion = await response.json() as {
        choices?: { message?: { content?: unknown } }[];
      } | null;
      const content = completion?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') throw new Error('转写响应无效');
      transcript = content.trim();
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new ApiException(504, 'UPSTREAM_TIMEOUT', '语音转写超时，请重试');
      }
      throw new ApiException(502, 'TRANSCRIPTION_FAILED', '语音转写失败，请重试或重新录音');
    }

    if (!transcript) {
      throw new ApiException(422, 'EMPTY_TRANSCRIPT', '未识别出语音，请检查录音后重试');
    }
    return transcript;
  }
}
