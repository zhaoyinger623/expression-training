import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformWithOxc } from 'vite';

const source = readFileSync(new URL('../src/api/realtimeTranscription.ts', import.meta.url), 'utf8').replace('import.meta.env.VITE_API_BASE_URL', "'https://api.example.test'");
const { code } = await transformWithOxc(source, 'realtimeTranscription.ts');
function setup() {
  let socket;
  const errors = [];
  const sandbox = {
    URL, clearTimeout,
    window: { location: { href: 'https://web.example.test/' }, setTimeout },
    WebSocket: class {
      bufferedAmount = 0;
      sent = [];
      closed = false;
      constructor() { socket = this; }
      send(data) { this.sent.push(data); }
      close() { this.closed = true; }
    },
  };
  runInNewContext(code.replace('export function ', 'function ') + '\nglobalThis.connect = connectRealtimeTranscription;', sandbox);
  const session = sandbox.connect(() => {}, error => errors.push(error));
  const emit = event => socket.onmessage({ data: JSON.stringify(event) });
  return { session, socket, emit, errors };
}

test('连接期间可接收录音帧，ready 后按顺序补传，再发送新帧', async () => {
  const { session, socket, emit } = setup();
  const first = new ArrayBuffer(640), second = new ArrayBuffer(640), third = new ArrayBuffer(640);
  session.write(first); session.write(second);
  assert.equal(socket.sent.length, 0);
  emit({ type: 'ready' });
  await session.ready;
  session.write(third);
  assert.deepEqual(socket.sent, [first, second, third]);
  session.cancel();
  assert.equal(socket.closed, true);
});

test('连接成功前结束录音，也先补传所有尾帧再发 finish', async () => {
  const { session, socket, emit } = setup();
  const audio = new ArrayBuffer(320);
  session.write(audio);
  const result = session.finish();
  assert.equal(socket.sent.length, 0);
  emit({ type: 'ready' });
  await session.ready;
  assert.equal(socket.sent[0], audio);
  assert.deepEqual(JSON.parse(socket.sent[1]), { type: 'finish' });
  emit({ type: 'complete', transcript: '开头和尾句都在。' });
  assert.equal(await result, '开头和尾句都在。');
  assert.equal(socket.closed, true);
});

test('连接失败可反馈整段上传回退；取消后不补传音频', async () => {
  const failed = setup();
  failed.session.write(new ArrayBuffer(640));
  failed.socket.onerror();
  await assert.rejects(failed.session.ready, /无法连接/);
  await assert.rejects(failed.session.finish(), /无法连接/);
  assert.equal(failed.errors.length, 1);
  const cancelled = setup();
  cancelled.session.write(new ArrayBuffer(640));
  cancelled.session.cancel();
  cancelled.emit({ type: 'ready' });
  assert.equal(cancelled.socket.sent.length, 0);
  await assert.rejects(cancelled.session.ready, /取消/);
});
