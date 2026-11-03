import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseComparison } from '../dist/evaluation/evaluation-result.js';
import { EvaluationController } from '../dist/evaluation/evaluation.controller.js';
import { EvaluationService } from '../dist/evaluation/evaluation.service.js';

const first = '探索可以让人成长。';
const second = '比如先去不同岗位实习，能了解自己适合什么工作。';
const comparison = {
  summary: '补充了具体情境',
  changes: [{ dimension: '具体性与例证', status: 'improved', firstQuote: first, secondQuote: second, explanation: '用岗位实习说明探索的价值。' }],
  remainingIssue: '尚未说明经济压力的影响。', nextAction: '结尾补充一个适用条件。',
};
const topic = { id: 'topic', title: '稳定还是探索', description: '', source: 'preset', createdAt: '2026-11-03T00:00:00Z' };
const dimensions = ['观点与论证', '结构与连贯', '表达清晰度', '论题回应度', '具体性与例证', '权衡与边界'].map(name => ({ name, score: 5, reason: '依据', suggestion: '建议' }));
const evaluation = { summary: '反馈', nextStep: '举例', featuredQuote: null, dimensions, strengths: [], issues: [] };
const config = { llm: { apiKey: 'test', baseUrl: 'https://example.invalid', model: 'test' } };

test('仅保留两轮原文均可核对的变化，允许持平或退步', () => {
  for (const status of ['improved', 'unchanged', 'regressed']) {
    const change = { ...comparison.changes[0], status };
    assert.deepEqual(parseComparison({ ...comparison, changes: [change, { ...change, firstQuote: '伪造原话' }] }, first, second), { ...comparison, changes: [change] });
  }
});
test('对比缺失、字段错误、引用错轮或无可靠变化时省略', () => {
  for (const value of [undefined, null, {}, { ...comparison, nextAction: '' }, { ...comparison, changes: [] }, { ...comparison, changes: [{ ...comparison.changes[0], secondQuote: first }] }]) {
    assert.equal(parseComparison(value, first, second), undefined);
  }
});
test('同一次模型调用生成对比，错误对比不阻断正常评估', async () => {
  const original = globalThis.fetch;
  const requests = [];
  let comparisonOutput = comparison;
  globalThis.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    const content = JSON.stringify({ ...evaluation, comparison: comparisonOutput });
    return new Response(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n`);
  };
  try {
    const service = new EvaluationService(config);
    const attempt = { id: 'answer', transcript: second, round: 2 };
    const result = await service.evaluate(topic, attempt, undefined, { transcript: first, nextStep: '举例' });
    assert.deepEqual(result.comparison, comparison);
    assert.equal(requests.length, 1);
    assert.equal(JSON.parse(requests[0].messages[1].content).firstAnswer.transcript, first);
    comparisonOutput = { ...comparison, changes: [{ ...comparison.changes[0], firstQuote: '伪造引用' }] };
    const degraded = await service.evaluate(topic, attempt, undefined, { transcript: first, nextStep: '举例' });
    assert.equal(degraded.comparison, undefined);
    assert.equal(degraded.attemptId, 'answer');
    assert.equal(degraded.overallScore, 5);
    const firstRound = await service.evaluate(topic, { ...attempt, round: 1 });
    assert.equal(firstRound.comparison, undefined);
  } finally { globalThis.fetch = original; }
});
test('SSE 边界拒绝首轮携带对比上下文和非法首次回答，兼容无上下文第二轮', async () => {
  let calls = 0;
  const controller = new EvaluationController({ evaluate: async () => { calls++; return { ...evaluation, comparison }; } }, config);
  async function request(body) {
    const events = [];
    await controller.createStream(body, { setHeader() {}, flushHeaders() {}, write(chunk) { events.push(JSON.parse(chunk.slice(6))); }, end() {} });
    return events;
  }
  const body = { topic, round: 2, durationSeconds: 10, transcript: second };
  for (const input of [{ ...body, round: 1, firstAnswer: { transcript: first, nextStep: '举例' } }, { ...body, firstAnswer: { transcript: '', nextStep: '举例' } }]) {
    assert.equal((await request(input))[0].error.code, 'INVALID_REQUEST');
  }
  assert.equal(calls, 0);
  const event = (await request(body))[0];
  assert.equal(event.type, 'complete');
  assert.equal(event.result.evaluation.comparison, undefined);
  assert.deepEqual(event.result.comparison, comparison);
});
