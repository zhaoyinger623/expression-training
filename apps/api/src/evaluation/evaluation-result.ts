import type { DimensionFeedback, Evaluation, MindMapNode } from '@expression/shared';

const dimensionNames = ['观点与论证', '结构与连贯', '表达清晰度', '论题回应度', '具体性与例证', '权衡与边界'];

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
  if ((value.userMindMap !== undefined && !Array.isArray(value.userMindMap)) ||
    (value.referenceMindMap !== undefined && !Array.isArray(value.referenceMindMap)) ||
    (value.referenceAnswer !== undefined && (!isText(value.referenceAnswer) || (value.referenceAnswer.match(/[\u3400-\u9fff]/g)?.length ?? 0) < 500))) throw new Error('思维导图或参考答案无效');
  const parseMindMap = (items: unknown[], depth = 0): MindMapNode[] => {
    if (depth > 3 || items.length > 8) throw new Error('思维导图层级或节点过多');
    return items.map((item) => {
      if (!isRecord(item) || !isText(item.label) || !Array.isArray(item.children)) throw new Error('思维导图节点无效');
      return { label: item.label, children: parseMindMap(item.children, depth + 1) };
    });
  };
  if (!Array.isArray(value.dimensions) || value.dimensions.length !== dimensionNames.length) {
    throw new Error('评估必须包含六个维度');
  }
  const dimensions: DimensionFeedback[] = [];
  for (const item of value.dimensions) {
    if (!isRecord(item) ||
      !dimensionNames.includes(item.name as string) ||
      typeof item.score !== 'number' || !Number.isInteger(item.score) || item.score < 0 || item.score > 10 ||
      !isText(item.reason) || !isText(item.suggestion)
    ) throw new Error('评估维度字段无效');
    dimensions.push({ name: item.name as DimensionFeedback['name'], score: item.score, reason: item.reason, suggestion: item.suggestion });
  }
  if (new Set(dimensions.map((item) => item.name)).size !== dimensionNames.length) {
    throw new Error('评估维度不能重复');
  }
  if (value.overallScore !== undefined && (typeof value.overallScore !== 'number' || !Number.isInteger(value.overallScore) || value.overallScore < 0 || value.overallScore > 10)) throw new Error('总分无效');
  if (value.evidenceQuotes !== undefined && (!Array.isArray(value.evidenceQuotes) || value.evidenceQuotes.length > 6 || !value.evidenceQuotes.every((item) =>
    isRecord(item) && (item.kind === 'strength' || item.kind === 'improvement') && isText(item.text) && isText(item.feedback) && transcript.includes(item.text)))) {
    throw new Error('逐句点评必须引用回答原文');
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
    overallScore: Math.round(dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length),
    summary: value.summary,
    userMindMap: parseMindMap((value.userMindMap ?? []) as unknown[]),
    referenceMindMap: parseMindMap((value.referenceMindMap ?? []) as unknown[]),
    referenceAnswer: typeof value.referenceAnswer === 'string' ? value.referenceAnswer : '',
    evidenceQuotes: Array.isArray(value.evidenceQuotes) ? value.evidenceQuotes as Evaluation['evidenceQuotes'] : [],
    featuredQuote,
    dimensions: dimensions.sort((a, b) => dimensionNames.indexOf(a.name) - dimensionNames.indexOf(b.name)),
    strengths: value.strengths,
    issues: value.issues,
    nextStep: value.nextStep,
  };
}
