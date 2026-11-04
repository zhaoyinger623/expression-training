import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { WebSocket, WebSocketServer } from 'ws';
import { attachRealtimeTranscription } from '../dist/transcription/realtime-transcription.js';

function messages(socket) {
  const queue = [];
  const waiting = [];
  socket.on('message', data => {
    const event = JSON.parse(data.toString());
    const next = waiting.shift();
    if (next) next(event); else queue.push(event);
  });
  return () => queue.length ? Promise.resolve(queue.shift()) : new Promise(resolve => waiting.push(resolve));
}
async function setup(t, onUpstream) {
  const upstream = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await once(upstream, 'listening');
  upstream.on('connection', (socket, request) => {
    assert.equal(request.headers.authorization, 'Bearer test-key');
    assert.match(request.url, /model=qwen3-asr-flash-realtime/);
    socket.on('message', data => onUpstream(socket, JSON.parse(data.toString())));
  });
  const server = createServer();
  const wss = attachRealtimeTranscription(server, {
    asr: { apiKey: 'test-key' }, webOrigin: 'http://localhost:5173',
    realtimeAsr: { url: `ws://127.0.0.1:${upstream.address().port}`, model: 'qwen3-asr-flash-realtime' },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    for (const client of wss.clients) client.terminate();
    for (const client of upstream.clients) client.terminate();
    wss.close();
    upstream.close();
    await new Promise(resolve => server.close(resolve));
  });
  const connect = (origin = 'http://localhost:5173') => new WebSocket(`ws://127.0.0.1:${server.address().port}/api/transcriptions/realtime`, { origin });
  return { connect, upstream };
}
const emit = (socket, event) => socket.send(JSON.stringify(event));

test('实时 PCM 转发、草稿替换、按句确认、结束后才完成', { timeout: 5000 }, async t => {
  const audio = Buffer.from([1, 0, 255, 127]);
  let received = false;
  const { connect } = await setup(t, (socket, event) => {
    if (event.type === 'session.update') {
      assert.equal(event.session.sample_rate, 16000);
      assert.equal(event.session.input_audio_format, 'pcm');
      emit(socket, { type: 'session.updated' });
    } else if (event.type === 'input_audio_buffer.append') {
      assert.deepEqual(Buffer.from(event.audio, 'base64'), audio);
      received = true;
      emit(socket, { type: 'conversation.item.input_audio_transcription.text', item_id: 'a', text: '我', stash: '认为' });
      emit(socket, { type: 'conversation.item.input_audio_transcription.text', item_id: 'a', text: '我认为', stash: '可以' });
      emit(socket, { type: 'conversation.item.input_audio_transcription.completed', item_id: 'a', transcript: '我认为可以。' });
    } else if (event.type === 'session.finish') {
      emit(socket, { type: 'conversation.item.input_audio_transcription.completed', item_id: 'b', transcript: '最后一句。' });
      emit(socket, { type: 'session.finished' });
    }
  });
  const socket = connect();
  const next = messages(socket);
  assert.deepEqual(await next(), { type: 'ready' });
  socket.send(audio);
  assert.equal((await next()).transcript, '我认为');
  assert.equal((await next()).transcript, '我认为可以');
  assert.equal((await next()).transcript, '我认为可以。');
  socket.send(JSON.stringify({ type: 'finish' }));
  assert.equal((await next()).transcript, '我认为可以。最后一句。');
  assert.deepEqual(await next(), { type: 'complete', transcript: '我认为可以。最后一句。' });
  assert.equal(received, true);
});

test('没有语音或仍有未确认草稿时不提交不完整转写', { timeout: 5000 }, async t => {
  for (const draft of [false, true]) {
    const { connect } = await setup(t, (socket, event) => {
      if (event.type === 'session.update') emit(socket, { type: 'session.updated' });
      if (event.type === 'session.finish') {
        if (draft) emit(socket, { type: 'conversation.item.input_audio_transcription.text', item_id: 'a', text: '', stash: '不完整' });
        emit(socket, { type: 'session.finished' });
      }
    });
    const socket = connect();
    const next = messages(socket);
    await next();
    socket.send(JSON.stringify({ type: 'finish' }));
    if (draft) await next();
    const error = await next();
    assert.equal(error.type, 'error');
    assert.equal(error.error.code, draft ? 'TRANSCRIPTION_FAILED' : 'EMPTY_TRANSCRIPT');
  }
});

test('WebSocket 拒绝其他来源且不创建上游会话', { timeout: 5000 }, async t => {
  const { connect, upstream } = await setup(t, () => assert.fail('不得转发'));
  const socket = connect('https://other.invalid');
  const [, response] = await once(socket, 'unexpected-response');
  assert.equal(response.statusCode, 403);
  assert.equal(upstream.clients.size, 0);
  socket.terminate();
  socket.on('error', () => {});
});

test('上游断开返回错误，浏览器取消会关闭上游', { timeout: 5000 }, async t => {
  let peer;
  const { connect } = await setup(t, (socket, event) => {
    peer = socket;
    if (event.type === 'session.update') emit(socket, { type: 'session.updated' });
  });
  let socket = connect();
  let next = messages(socket);
  await next();
  peer.close();
  assert.equal((await next()).type, 'error');
  socket = connect();
  next = messages(socket);
  await next();
  const closed = once(peer, 'close');
  socket.close();
  await closed;
});

test('拒绝奇数字节 PCM 帧和未知控制指令', { timeout: 5000 }, async t => {
  const { connect } = await setup(t, (socket, event) => {
    if (event.type === 'session.update') emit(socket, { type: 'session.updated' });
  });
  for (const data of [Buffer.from([1]), JSON.stringify({ type: 'arbitrary' })]) {
    const socket = connect();
    const next = messages(socket);
    await next();
    socket.send(data);
    assert.equal((await next()).error.code, 'INVALID_REQUEST');
  }
});
