import { randomUUID } from 'node:crypto';
import { Body, Controller, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Attempt, SubmitAttemptResponse, Topic } from '@expression/shared';
import { AudioUploadPipe, audioUploadOptions } from '../common/audio-upload.js';
import type { AudioUpload } from '../common/audio-upload.js';
import { ApiException } from '../common/api-exception.js';
import { ApiConfig } from '../config.js';
import { EvaluationService } from '../evaluation/evaluation.service.js';
import { TranscriptionService } from '../transcription/transcription.service.js';

interface StreamResponse {
  setHeader(name: string, value: string): void;
  flushHeaders(): void;
  write(chunk: string): void;
  end(): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Controller('api/attempts')
export class AttemptsController {
  constructor(
    private readonly transcription: TranscriptionService,
    private readonly evaluation: EvaluationService,
    private readonly config: ApiConfig,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('audio', audioUploadOptions))
  async create(
    @UploadedFile(new AudioUploadPipe()) audio: AudioUpload,
    @Body('metadata') metadata: unknown,
  ): Promise<SubmitAttemptResponse> {
    if (typeof metadata !== 'string') {
      throw new ApiException(400, 'INVALID_REQUEST', '请提供 JSON 字符串格式的 metadata');
    }
    let data: unknown;
    try {
      data = JSON.parse(metadata);
    } catch {
      throw new ApiException(400, 'INVALID_REQUEST', 'metadata 不是有效的 JSON');
    }
    if (!isRecord(data) || !isRecord(data.topic)) {
      throw new ApiException(400, 'INVALID_REQUEST', 'metadata 必须包含完整论题');
    }
    const { topic, round, durationSeconds } = data;
    if ((round !== 1 && round !== 2) || typeof durationSeconds !== 'number' ||
      !Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 180
    ) throw new ApiException(400, 'INVALID_REQUEST', '轮次必须为 1 或 2，录音时长必须大于 0 且不超过 180 秒');
    if (typeof topic.id !== 'string' || !topic.id.trim() || topic.id.length > 200 ||
      typeof topic.title !== 'string' || !topic.title.trim() || topic.title.length > 200 ||
      typeof topic.description !== 'string' || topic.description.length > 1000 ||
      (topic.source !== 'ai' && topic.source !== 'preset') ||
      typeof topic.createdAt !== 'string' || !Number.isFinite(Date.parse(topic.createdAt))
    ) throw new ApiException(400, 'INVALID_REQUEST', '论题字段不完整或格式不正确');

    // 评估配置缺失时先返回，避免先转写录音产生无用调用。
    if (!this.config.llm.apiKey || !this.config.llm.baseUrl) {
      throw new ApiException(503, 'SERVICE_NOT_CONFIGURED', '回答评估服务尚未配置');
    }
    const transcript = await this.transcription.transcribe(audio.buffer, audio.mimetype);
    const attempt: Attempt = {
      id: randomUUID(), topicId: topic.id, round, transcript, durationSeconds,
      createdAt: new Date().toISOString(),
    };
    const evaluation = await this.evaluation.evaluate({
      id: topic.id, title: topic.title, description: topic.description,
      source: topic.source, createdAt: topic.createdAt,
    }, attempt);
    return { attempt, evaluation };
  }

  @Post('stream')
  @UseInterceptors(FileInterceptor('audio', audioUploadOptions))
  async createStream(
    @UploadedFile(new AudioUploadPipe()) audio: AudioUpload,
    @Body('metadata') metadata: unknown,
    @Res() response: StreamResponse,
  ): Promise<void> {
    const data = this.parseMetadata(metadata);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders();
    const send = (event: unknown) => response.write(`data: ${JSON.stringify(event)}\n\n`);
    try {
      if (!this.config.llm.apiKey || !this.config.llm.baseUrl) throw new ApiException(503, 'SERVICE_NOT_CONFIGURED', '回答评估服务尚未配置');
      const transcript = await this.transcription.transcribe(audio.buffer, audio.mimetype);
      send({ type: 'transcript', transcript });
      const topic = data.topic;
      const attempt: Attempt = { id: randomUUID(), topicId: topic.id, round: data.round, transcript, durationSeconds: data.durationSeconds, createdAt: new Date().toISOString() };
      send({ type: 'status', stage: 'evaluating' });
      const evaluation = await this.evaluation.evaluate(topic, attempt);
      send({ type: 'complete', result: { attempt, evaluation } });
    } catch (error) {
      const status = error instanceof ApiException ? error.getResponse() : null;
      const body = typeof status === 'object' && status !== null ? status : { code: 'INTERNAL_ERROR', message: '处理失败，请重试' };
      send({ type: 'error', error: body });
    } finally {
      response.end();
    }
  }

  private parseMetadata(metadata: unknown): { topic: Topic; round: 1 | 2; durationSeconds: number } {
    if (typeof metadata !== 'string') throw new ApiException(400, 'INVALID_REQUEST', '请提供 JSON 字符串格式的 metadata');
    let data: unknown;
    try { data = JSON.parse(metadata); } catch { throw new ApiException(400, 'INVALID_REQUEST', 'metadata 不是有效的 JSON'); }
    if (!isRecord(data) || !isRecord(data.topic)) throw new ApiException(400, 'INVALID_REQUEST', 'metadata 必须包含完整论题');
    const { topic, round, durationSeconds } = data;
    if ((round !== 1 && round !== 2) || typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 180 ||
      typeof topic.id !== 'string' || !topic.id.trim() || topic.id.length > 200 || typeof topic.title !== 'string' || !topic.title.trim() || topic.title.length > 200 ||
      typeof topic.description !== 'string' || topic.description.length > 1000 || (topic.source !== 'ai' && topic.source !== 'preset') ||
      typeof topic.createdAt !== 'string' || !Number.isFinite(Date.parse(topic.createdAt))) throw new ApiException(400, 'INVALID_REQUEST', '论题、轮次或录音时长格式不正确');
    return { topic: topic as unknown as Topic, round, durationSeconds };
  }
}
