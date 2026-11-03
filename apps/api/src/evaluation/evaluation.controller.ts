import { randomUUID } from 'node:crypto';
import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Attempt, EvaluateAttemptRequest, Topic } from '@expression/shared';
import { ApiException } from '../common/api-exception.js';
import { ApiConfig } from '../config.js';
import { EvaluationService } from './evaluation.service.js';

interface StreamResponse {
  setHeader(name: string, value: string): void;
  flushHeaders(): void;
  write(chunk: string): void;
  end(): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Controller('api/evaluations')
export class EvaluationController {
  constructor(private readonly evaluation: EvaluationService, private readonly config: ApiConfig) {}

  @Post('stream')
  async createStream(@Body() body: unknown, @Res() response: StreamResponse): Promise<void> {
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders();
    const send = (event: unknown) => response.write(`data: ${JSON.stringify(event)}\n\n`);
    try {
      if (!isRecord(body) || !isRecord(body.topic)) throw new ApiException(400, 'INVALID_REQUEST', '请求必须包含论题、轮次、时长和转写文本');
      const { topic, round, durationSeconds, transcript } = body;
      if ((round !== 1 && round !== 2) || typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 180 ||
        typeof transcript !== 'string' || !transcript.trim() || transcript.length > 30_000 ||
        typeof topic.id !== 'string' || !topic.id.trim() || topic.id.length > 200 ||
        typeof topic.title !== 'string' || !topic.title.trim() || topic.title.length > 200 ||
        typeof topic.description !== 'string' || topic.description.length > 1000 ||
        (topic.source !== 'ai' && topic.source !== 'preset') ||
        typeof topic.createdAt !== 'string' || !Number.isFinite(Date.parse(topic.createdAt))) {
        throw new ApiException(400, 'INVALID_REQUEST', '论题、轮次、录音时长或转写文本格式不正确');
      }
      let firstAnswer: EvaluateAttemptRequest['firstAnswer'];
      if (body.firstAnswer !== undefined) {
        const first = body.firstAnswer;
        if (round !== 2 || !isRecord(first) || typeof first.transcript !== 'string' || !first.transcript.trim() || first.transcript.length > 30_000 ||
          typeof first.nextStep !== 'string' || !first.nextStep.trim() || first.nextStep.length > 4000) {
          throw new ApiException(400, 'INVALID_REQUEST', '首次回答或练习建议格式不正确');
        }
        firstAnswer = { transcript: first.transcript, nextStep: first.nextStep };
      }
      if (!this.config.llm.apiKey || !this.config.llm.baseUrl) throw new ApiException(503, 'SERVICE_NOT_CONFIGURED', '回答评估服务尚未配置');
      const validatedTopic = topic as unknown as Topic;
      const attempt: Attempt = {
        id: randomUUID(), topicId: validatedTopic.id, round, transcript: transcript.trim(), durationSeconds,
        createdAt: new Date().toISOString(),
      };
      const { comparison, ...evaluation } = await this.evaluation.evaluate(validatedTopic, attempt, (text) => send({ type: 'delta', text }), firstAnswer);
      send({ type: 'complete', result: { attempt, evaluation, ...(comparison ? { comparison } : {}) } });
    } catch (error) {
      const responseBody = error instanceof ApiException ? error.getResponse() : { code: 'INTERNAL_ERROR', message: '评估失败，请重试' };
      send({ type: 'error', error: responseBody });
    } finally {
      response.end();
    }
  }
}
