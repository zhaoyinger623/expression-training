import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { Topic } from '@expression/shared';
import { ApiConfig } from '../config.js';
import { presetTopics } from './preset-topics.js';

@Injectable()
export class TopicsService {
  private readonly logger = new Logger(TopicsService.name);

  constructor(private readonly config: ApiConfig) {}

  async random(excludeTopicId?: string): Promise<Topic> {
    const { apiKey, baseUrl, model } = this.config.llm;
    if (apiKey && baseUrl) {
      try {
        const themes = ['人生选择与成长', '职业发展', '职场协作', '生活方式', '家庭与关系', '学习与教育', '时间与精力', '消费与金钱', '健康与休息', '公共生活', '科技与生活'];
        const theme = themes[Math.floor(Math.random() * themes.length)];
        const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(15_000),
          body: JSON.stringify({
            model,
            stream: false,
            messages: [
              {
                role: 'system',
                content: '你是中文表达训练的出题教练。生成一道适合普通成年人用1–3分钟回答的辩证性论题：双方都有合理依据，允许条件性立场，贴近日常生活，不依赖专业知识，不预设正确答案。主题必须严格围绕本次指定领域，不要默认写成智能设备、人工智能或科技产品题；只有指定科技领域时才出科技题。不同题目要切换人生选择、个人成长、家庭关系、职业发展、职场合作、学习教育、生活习惯、时间管理、消费金钱、健康休息、社区与公共生活等领域，避免长期集中在同一类。仅输出JSON对象，包含title和description两个字符串字段；title是问题，最多200字符；description是简短作答提示，最多1000字符，不提供范文或替用户选择立场。',
              },
              { role: 'user', content: `请围绕“${theme}”生成一道新论题。` },
            ],
          }),
        });
        if (!response.ok) throw new Error('上游出题失败');
        const completion = await response.json() as {
          choices?: { message?: { content?: unknown } }[];
        } | null;
        const content = completion?.choices?.[0]?.message?.content;
        if (typeof content !== 'string') throw new Error('出题响应无效');
        const topic: unknown = JSON.parse(content);
        if (
          typeof topic !== 'object' || topic === null ||
          !('title' in topic) || typeof topic.title !== 'string' ||
          !topic.title.trim() || topic.title.trim().length > 200 ||
          !('description' in topic) || typeof topic.description !== 'string' ||
          !topic.description.trim() || topic.description.trim().length > 1000
        ) throw new Error('论题结构无效');

        return {
          id: randomUUID(), title: topic.title.trim(), description: topic.description.trim(),
          source: 'ai', createdAt: new Date().toISOString(),
        };
      } catch {
        this.logger.warn('AI 出题未完成，已回退预置题库');
      }
    }

    const candidates = presetTopics.filter((topic) => topic.id !== excludeTopicId);
    const topic = candidates[Math.floor(Math.random() * candidates.length)];
    return { ...topic, source: 'preset', createdAt: new Date().toISOString() };
  }
}
