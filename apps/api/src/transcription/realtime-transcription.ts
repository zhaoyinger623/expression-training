import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import type { ApiErrorCode, RealtimeTranscriptionEvent } from '@expression/shared';
import type { ApiConfig } from '../config.js';

/** 每个连接独立转发，不在进程内保存跨请求会话，适用于本地与 Vercel Functions。 */
export function attachRealtimeTranscription(server: Server, config: ApiConfig) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  server.on('upgrade', (request, socket, head) => {
    if (request.url?.split('?')[0] !== '/api/transcriptions/realtime') {
      socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      return;
    }
    // WebSocket 不经过浏览器 CORS；沿用 HTTP 接口的精确来源限制。
    if (request.headers.origin !== config.webOrigin) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    wss.handleUpgrade(request, socket, head, (client) => connectRealtimeSession(client, config));
  });
  return wss;
}

function connectRealtimeSession(client: WebSocket, config: ApiConfig) {
  const send = (event: RealtimeTranscriptionEvent) => {
    if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(event));
  };
  if (!config.asr.apiKey) {
    send({ type: 'error', error: { code: 'SERVICE_NOT_CONFIGURED', message: '实时转写服务尚未配置' } });
    client.close();
    return;
  }
  const url = new URL(config.realtimeAsr.url);
  url.searchParams.set('model', config.realtimeAsr.model);
  const upstream = new WebSocket(url, {
    headers: { Authorization: `Bearer ${config.asr.apiKey}`, 'OpenAI-Beta': 'realtime=v1' },
    handshakeTimeout: 15_000,
    maxPayload: 1024 * 1024,
  });
  let ready = false;
  let finishing = false;
  let closed = false;
  let audioBytes = 0;
  const items = new Map<string, { text: string; final: boolean }>();
  const transcript = () => [...items.values()].map(item => item.text).join('');
  const emit = (event: object) => upstream.send(JSON.stringify({ event_id: randomUUID(), ...event }));
  let finishTimer: ReturnType<typeof setTimeout> | undefined;
  const cleanup = () => {
    closed = true;
    clearTimeout(readyTimer);
    clearTimeout(sessionTimer);
    clearTimeout(finishTimer);
    upstream.close();
  };
  const fail = (message: string, code: ApiErrorCode = 'TRANSCRIPTION_FAILED') => {
    if (closed) return;
    send({ type: 'error', error: { code, message } });
    cleanup();
    client.close();
  };
  const readyTimer = setTimeout(() => fail('连接实时转写超时，提交后可使用完整录音转写', 'UPSTREAM_TIMEOUT'), 15_000);
  const sessionTimer = setTimeout(() => fail('实时录音会话超时，请提交录音或重新录制', 'UPSTREAM_TIMEOUT'), 210_000);
  upstream.on('open', () => {
    if (closed) { upstream.close(); return; }
    emit({ type: 'session.update', session: {
      input_audio_format: 'pcm', sample_rate: 16000,
      turn_detection: { type: 'server_vad', threshold: 0.0, silence_duration_ms: 400 },
    } });
  });
  upstream.on('message', (data) => {
    if (closed) return;
    try {
      const event = JSON.parse(data.toString()) as {
        type: string; item_id?: string; text?: string; stash?: string; transcript?: string;
      };
      if (event.type === 'session.updated') {
        clearTimeout(readyTimer);
        ready = true;
        send({ type: 'ready' });
      } else if (event.type === 'input_audio_buffer.committed' && event.item_id) {
        if (!items.has(event.item_id)) items.set(event.item_id, { text: '', final: false });
      } else if (event.type === 'conversation.item.input_audio_transcription.text' && event.item_id) {
        if (!items.get(event.item_id)?.final) {
          items.set(event.item_id, { text: `${event.text ?? ''}${event.stash ?? ''}`, final: false });
          send({ type: 'transcript', transcript: transcript() });
        }
      } else if (event.type === 'conversation.item.input_audio_transcription.completed' && event.item_id && typeof event.transcript === 'string') {
        items.set(event.item_id, { text: event.transcript, final: true });
        send({ type: 'transcript', transcript: transcript() });
      } else if (event.type === 'session.finished') {
        if (!finishing || [...items.values()].some(item => !item.final)) {
          fail('实时转写未完整结束，提交后可使用完整录音转写');
          return;
        }
        const text = transcript().trim();
        if (!text) { fail('未识别出语音，请检查录音后重试', 'EMPTY_TRANSCRIPT'); return; }
        send({ type: 'complete', transcript: text });
        cleanup();
        client.close();
      } else if (event.type === 'error' || event.type === 'conversation.item.input_audio_transcription.failed') {
        fail('实时转写失败，提交后可使用完整录音转写');
      }
    } catch {
      fail('实时转写响应无效，提交后可使用完整录音转写');
    }
  });
  client.on('message', (data, binary) => {
    if (closed) return;
    if (!ready || finishing) { fail('实时录音会话状态无效', 'INVALID_REQUEST'); return; }
    if (binary) {
      const audio = Buffer.concat(Array.isArray(data) ? data : [Buffer.from(data as ArrayBuffer)]);
      audioBytes += audio.length;
      if (!audio.length || audio.length % 2 || audioBytes > 180 * 16000 * 2) {
        fail('实时音频须为不超过 180 秒的 PCM16 数据', 'INVALID_REQUEST');
        return;
      }
      if (upstream.bufferedAmount > 1024 * 1024) { fail('实时上传网络过慢，提交后可使用完整录音转写'); return; }
      emit({ type: 'input_audio_buffer.append', audio: audio.toString('base64') });
    } else {
      try {
        const event = JSON.parse(data.toString());
        if (event.type !== 'finish') { fail('未知实时录音指令', 'INVALID_REQUEST'); return; }
        finishing = true;
        emit({ type: 'session.finish' });
        finishTimer = setTimeout(() => fail('等待实时转写收尾超时，提交后可使用完整录音转写', 'UPSTREAM_TIMEOUT'), 20_000);
      } catch {
        fail('实时录音指令无效', 'INVALID_REQUEST');
      }
    }
  });
  upstream.on('error', () => fail('无法连接实时转写服务，提交后可使用完整录音转写'));
  upstream.on('close', () => { if (!closed) fail('实时转写连接中断，提交后可使用完整录音转写'); });
  client.on('error', cleanup);
  client.on('close', cleanup);
}
