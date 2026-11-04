import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TranscriptionService } from '../dist/transcription/transcription.service.js';

test('上游发送 DONE 但保持连接时立即完成，保留跨块中文片段并取消读取', async () => {
  const original = globalThis.fetch;
  let cancelled = false;
  const encoder = new TextEncoder();
  const payload = encoder.encode('data: {"choices":[{"delta":{"content":"你好"}}]}\n\ndata: [DONE]\n\n');
  globalThis.fetch = async () => new Response(new ReadableStream({
    start(controller) {
      const split = payload.indexOf(0xe4) + 1;
      controller.enqueue(payload.slice(0, split));
      controller.enqueue(payload.slice(split));
      // 故意不 close：完成标记应足以结束转写。
    },
    cancel() { cancelled = true; },
  }));
  try {
    const service = new TranscriptionService({ asr: { apiKey: 'test', baseUrl: 'https://example.invalid', model: 'test' } });
    const partials = [];
    assert.equal(await service.transcribe(Buffer.from('audio'), 'audio/webm', text => partials.push(text)), '你好');
    assert.deepEqual(partials, ['你好']);
    assert.equal(cancelled, true);
  } finally {
    globalThis.fetch = original;
  }
});
