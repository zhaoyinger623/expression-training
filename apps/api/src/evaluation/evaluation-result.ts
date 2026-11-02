import type { DimensionFeedback, Evaluation } from '@expression/shared';

const dimensionNames = ['观点与论证', '结构与连贯', '表达清晰度'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** 模型输出进入系统的唯一结构校验边界。 */
export function parseEvaluation(value: unknown, transcript: string): Omit<Evaluation, 'attemptId'> {
  if (!isRecord(value) || !isText(value.summary) || !isText(value.nextStep)) {
    throw new Error('评估摘要或建议无效');
  }
  if (!Array.isArray(value.dimensions) || value.dimensions.length !== 3) {
    throw new Error('评估必须包含三个维度');
  }
  const dimensions: DimensionFeedback[] = [];
  for (const item of value.dimensions) {
    if (!isRecord(item) ||
      (item.name !== '观点与论证' && item.name !== '结构与连贯' && item.name !== '表达清晰度') ||
      typeof item.score !== 'number' || !Number.isInteger(item.score) || item.score < 0 || item.score > 10 ||
      !isText(item.reason) || !isText(item.suggestion)
    ) throw new Error('评估维度字段无效');
    dimensions.push({ name: item.name, score: item.score, reason: item.reason, suggestion: item.suggestion });
  }
  if (new Set(dimensions.map((item) => item.name)).size !== 3) {
    throw new Error('评估维度不能重复');
  }
  if (!Array.isArray(value.strengths) || !value.strengths.every(isText) ||
    !Array.isArray(value.issues) || !value.issues.every(isText)
  ) throw new Error('评估优点或问题列表无效');

  let featuredQuote: Evaluation['featuredQuote'] = null;
  if (value.featuredQuote !== null) {
    const quote = value.featuredQuote;
    if (!isRecord(quote) || !isText(quote.text) || !isText(quote.advice) || !transcript.includes(quote.text)) {
      throw new Error('评估引用必须来自回答原文');
    }
    featuredQuote = { text: quote.text, advice: quote.advice };
  }

  return {
    summary: value.summary,
    featuredQuote,
    dimensions: dimensions.sort((a, b) => dimensionNames.indexOf(a.name) - dimensionNames.indexOf(b.name)),
    strengths: value.strengths,
    issues: value.issues,
    nextStep: value.nextStep,
  };
}
