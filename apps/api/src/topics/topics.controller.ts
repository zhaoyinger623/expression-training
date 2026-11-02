import { Controller, Get, Query } from '@nestjs/common';
import type { TopicResponse } from '@expression/shared';
import { ApiException } from '../common/api-exception.js';
import { TopicsService } from './topics.service.js';

@Controller('api/topics')
export class TopicsController {
  constructor(private readonly topics: TopicsService) {}

  @Get('random')
  async random(@Query('excludeTopicId') excludeTopicId?: unknown): Promise<TopicResponse> {
    if (excludeTopicId !== undefined && (
      typeof excludeTopicId !== 'string' || !excludeTopicId.trim() || excludeTopicId.length > 200
    )) throw new ApiException(400, 'INVALID_REQUEST', 'excludeTopicId 必须为 1–200 字符的题目 ID');

    return { topic: await this.topics.random(excludeTopicId as string | undefined) };
  }
}
