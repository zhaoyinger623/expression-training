import type { AnswerComparison, DimensionFeedback, Evaluation, MindMapNode } from '@expression/shared';

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
  if (!isRecord(value.expressionMethod) || !isText(value.expressionMethod.recommendedStyle) || !isText(value.expressionMethod.structure) || !isText(value.expressionMethod.rationale) || !isText(value.expressionMethod.suitableFor) ||
    !Array.isArray(value.expressionMethod.steps) || value.expressionMethod.steps.length < 2 || value.expressionMethod.steps.length > 5 || !value.expressionMethod.steps.every(isText) ||
    !Array.isArray(value.expressionMethod.sentenceStarters) || value.expressionMethod.sentenceStarters.length < 1 || value.expressionMethod.sentenceStarters.length > 4 || !value.expressionMethod.sentenceStarters.every(isText) ||
    !Array.isArray(value.expressionMethod.styleExamples) || value.expressionMethod.styleExamples.length < 2 || value.expressionMethod.styleExamples.length > 4 ||
    !value.expressionMethod.styleExamples.every((item) => isRecord(item) && isText(item.name) && isText(item.sample))) {
    throw new Error('通用表达方法无效');
  }
  const parseMindMap = (items: unknown[], depth = 0): MindMapNode[] => {
    if (depth > 3 || items.length > 8) throw new Error('思维导图层级或节点过多');
    return items.map((item) => {
      if (!isRecord(item) || !isText(item.label) || (item.children !== undefined && !Array.isArray(item.children))) throw new Error('思维导图节点无效');
      return { label: item.label, children: parseMindMap((item.children ?? []) as unknown[], depth + 1) };
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
      !isText(item.strength) || !isText(item.weakness)
    ) throw new Error('评估维度字段无效');
    dimensions.push({ name: item.name as DimensionFeedback['name'], score: item.score, strength: item.strength, weakness: item.weakness });
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
    expressionMethod: value.expressionMethod as Evaluation['expressionMethod'],
    evidenceQuotes: Array.isArray(value.evidenceQuotes) ? value.evidenceQuotes as Evaluation['evidenceQuotes'] : [],
    featuredQuote,
    dimensions: dimensions.sort((a, b) => dimensionNames.indexOf(a.name) - dimensionNames.indexOf(b.name)),
    strengths: value.strengths,
    issues: value.issues,
    nextStep: value.nextStep,
  };
}

/** 对比不合格时仅省略对比，不影响本轮评估。 */
export function parseComparison(value: unknown, firstTranscript: string, secondTranscript: string): AnswerComparison | undefined {
  if (!isRecord(value) || !isText(value.summary) || !isText(value.remainingIssue) || !isText(value.nextAction) ||
    !Array.isArray(value.changes) || value.changes.length > 2) return undefined;
  const changes: AnswerComparison['changes'] = [];
  for (const item of value.changes) {
    if (!isRecord(item) || !dimensionNames.includes(item.dimension as string) ||
      !['improved', 'unchanged', 'regressed'].includes(item.status as string) ||
      !isText(item.firstQuote) || !firstTranscript.includes(item.firstQuote) ||
      !isText(item.secondQuote) || !secondTranscript.includes(item.secondQuote) || !isText(item.explanation)) return undefined;
    changes.push({ dimension: item.dimension as DimensionFeedback['name'], status: item.status as AnswerComparison['changes'][number]['status'],
      firstQuote: item.firstQuote, secondQuote: item.secondQuote, explanation: item.explanation });
  }
  // 任一变化失去依据时，整体摘要及建议也可能引用它，因此一并省略对比。
  if (!changes.length) return undefined;
  return { summary: value.summary, changes, remainingIssue: value.remainingIssue, nextAction: value.nextAction };
}
