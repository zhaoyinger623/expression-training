import { Controller, Get, Param, Query } from '@nestjs/common';
import type { Practice, PracticeHistoryResponse } from '@expression/shared';
import { ApiException } from '../common/api-exception.js';
import { PracticeStore } from './practice.store.js';

@Controller('api/practices')
export class PracticesController {
  constructor(private readonly store: PracticeStore) {}

  @Get()
  list(@Query('offset') offset?: unknown): PracticeHistoryResponse {
    const value = offset === undefined ? 0 : typeof offset === 'string' && /^\d+$/.test(offset) ? Number(offset) : NaN;
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new ApiException(400, 'INVALID_REQUEST', 'offset 必须为非负整数');
    }
    return this.store.list(value);
  }

  @Get(':id')
  detail(@Param('id') id: string): Practice {
    if (!id.trim() || id.length > 200) throw new ApiException(400, 'INVALID_REQUEST', '练习 ID 格式不正确');
    const practice = this.store.find(id);
    if (!practice) throw new ApiException(404, 'NOT_FOUND', '未找到这次练习');
    return practice;
  }
}
