import { Injectable, Logger } from '@nestjs/common';
import { ApiConfig } from '../config.js';
import { ApiException } from '../common/api-exception.js';

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);
  constructor(private readonly config: ApiConfig) {}

  async transcribe(audio: Buffer, mimeType: string, onPartialTranscript?: (transcript: string) => void): Promise<string> {
    const { apiKey, baseUrl, model } = this.config.asr;
    if (!apiKey || !baseUrl) {
      throw new ApiException(503, 'SERVICE_NOT_CONFIGURED', '语音转写服务尚未配置');
    }

    let transcript = '';
    const startedAt = performance.now();
    let headersMs: number | undefined;
    let firstTextMs: number | undefined;
    let succeeded = false;
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(90_000),
        body: JSON.stringify({
          model,
          stream: true,
          messages: [{
            role: 'user',
            content: [{ type: 'input_audio', input_audio: {
              data: `data:${mimeType};base64,${audio.toString('base64')}`,
            } }],
          }],
          asr_options: { enable_itn: false },
        }),
      });
      headersMs = Math.round(performance.now() - startedAt);
      if (!response.ok) throw new Error('上游转写失败');
      if (!response.body) throw new Error('转写响应无效');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let completed = false;
      const readEvent = (line: string) => {
        if (!line.startsWith('data: ')) return;
        const data = line.slice(6).trim();
        if (data === '[DONE]') {
          completed = true;
          return;
        }
        if (!data) return;
        const chunk = JSON.parse(data) as { choices?: { delta?: { content?: unknown }; message?: { content?: unknown } }[] };
        const content = chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content;
        if (typeof content === 'string') {
          if (content && firstTextMs === undefined) firstTextMs = Math.round(performance.now() - startedAt);
          transcript += content;
          onPartialTranscript?.(content);
        }
      };
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) readEvent(line.trimEnd());
        if (completed) {
          await reader.cancel();
          break;
        }
        if (done) {
          if (buffer) readEvent(buffer.trimEnd());
          break;
        }
      }
      transcript = transcript.trim();
      succeeded = Boolean(transcript);
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new ApiException(504, 'UPSTREAM_TIMEOUT', '语音转写超时，请重试');
      }
      throw new ApiException(502, 'TRANSCRIPTION_FAILED', '语音转写失败，请重试或重新录音');
    } finally {
      this.logger.log(JSON.stringify({
        event: 'asr_timing', model, audioBytes: audio.length,
        region: process.env.VERCEL_REGION ?? 'local', headersMs, firstTextMs,
        totalMs: Math.round(performance.now() - startedAt), succeeded,
      }));
    }

    if (!transcript) {
      throw new ApiException(422, 'EMPTY_TRANSCRIPT', '未识别出语音，请检查录音后重试');
    }
    return transcript;
  }
}
