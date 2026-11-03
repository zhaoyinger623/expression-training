import type { EvaluationStreamEvent, TranscriptionStreamEvent } from '@expression/shared';

const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export async function request<T>(path: string, options: RequestInit, timeout: number): Promise<T> {
  let response: Response;
  let body: unknown;
  try {
    response = await fetch(`${baseUrl}${path}`, { ...options, signal: AbortSignal.timeout(timeout) });
    body = await response.json();
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new Error('等待时间过长，请重试。');
    }
    if (error instanceof SyntaxError) throw new Error('服务响应格式不正确，请稍后重试。');
    throw new Error('暂时无法连接服务，请检查网络或后端是否启动。');
  }
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && 'message' in body ? body.message : null;
    throw new Error(typeof message === 'string' ? message : '请求失败，请稍后重试。');
  }
  return body as T;
}

export async function readStream<Event extends TranscriptionStreamEvent | EvaluationStreamEvent, Result>(path: string, body: BodyInit, receive: (event: Event, state: { transcript: string; result: Result | null; characters: number }) => void, state: { transcript: string; result: Result | null; characters: number }, incompleteMessage: string): Promise<Result> {
  let response: Response;
  try {
    const isForm = body instanceof FormData;
    response = await fetch(`${baseUrl}${path}`, { method: 'POST', body, headers: isForm ? undefined : { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(120_000) });
  } catch {
    throw new Error('暂时无法连接服务，请检查网络或后端是否启动。');
  }
  if (!response.body) throw new Error(response.ok ? '服务没有返回处理流，请稍后重试。' : `提交失败（HTTP ${response.status}），请重试。`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let streamError = '';
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';
    for (const chunk of chunks) {
      const line = chunk.split('\n').find((part) => part.startsWith('data: '));
      if (!line) continue;
      const event = JSON.parse(line.slice(6)) as Event;
      if (event.type === 'error') streamError = event.error.message;
      receive(event, state);
    }
    if (done) break;
  }
  if (streamError) throw new Error(streamError);
  if (!state.result) throw new Error(incompleteMessage);
  return state.result;
}
