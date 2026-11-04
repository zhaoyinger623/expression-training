import type { RealtimeTranscriptionEvent } from '@expression/shared';

export interface RealtimeSession {
  write(audio: ArrayBuffer): void;
  finish(): Promise<string>;
  cancel(): void;
}

export function connectRealtimeTranscription(onTranscript: (text: string) => void, onError: (message: string) => void): Promise<RealtimeSession> {
  const url = new URL(`${(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')}/api/transcriptions/realtime`, window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(url);
  let ended = false;
  let ready = false;
  let finishing = false;
  let resolveResult: (text: string) => void;
  let rejectResult: (error: Error) => void;
  const result = new Promise<string>((resolve, reject) => { resolveResult = resolve; rejectResult = reject; });
  // 识别可在用户点击提交之前失败；由 onError 呈现，finish 仍保留拒绝结果。
  void result.catch(() => {});
  return new Promise((resolve, reject) => {
    const close = () => {
      ended = true;
      clearTimeout(timer);
      clearTimeout(finishTimer);
      socket.close();
    };
    const fail = (message: string) => {
      if (ended) return;
      const error = new Error(message);
      close();
      reject(error);
      rejectResult(error);
      onError(message);
    };
    const timer = window.setTimeout(() => fail('连接实时转写超时'), 18_000);
    let finishTimer: number | undefined;
    socket.onmessage = ({ data }) => {
      if (ended) return;
      try {
        const event = JSON.parse(data) as RealtimeTranscriptionEvent;
        if (event.type === 'ready' && !ready) {
          ready = true;
          clearTimeout(timer);
          resolve({
            write(audio) {
              if (ended || finishing) return;
              if (socket.bufferedAmount > 1024 * 1024) { fail('实时上传网络过慢'); return; }
              socket.send(audio);
            },
            finish() {
              if (!ended && !finishing) {
                finishing = true;
                socket.send(JSON.stringify({ type: 'finish' }));
                finishTimer = window.setTimeout(() => fail('等待实时转写收尾超时'), 25_000);
              }
              return result;
            },
            cancel() {
              if (ended) return;
              close();
              rejectResult(new Error('录音已取消'));
            },
          });
        } else if (event.type === 'transcript') {
          onTranscript(event.transcript);
        } else if (event.type === 'complete') {
          if (!finishing || !event.transcript.trim()) { fail('实时转写没有返回完整文本'); return; }
          resolveResult(event.transcript);
          onTranscript(event.transcript);
          close();
        } else if (event.type === 'error') {
          fail(event.error.message);
        }
      } catch {
        fail('实时转写响应格式无效');
      }
    };
    socket.onerror = () => fail('无法连接实时转写服务');
    socket.onclose = () => { if (!ended) fail('实时转写连接中断'); };
  });
}
