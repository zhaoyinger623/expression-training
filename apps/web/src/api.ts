import type { SubmitAttemptMetadata, SubmitAttemptResponse, TopicResponse } from '@expression/shared';

const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

async function request<T>(path: string, options: RequestInit, timeout: number): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, { ...options, signal: AbortSignal.timeout(timeout) });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error('等待时间过长，请重试。');
    }
    throw new Error('暂时无法连接服务，请检查网络或后端是否启动。');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.message === 'string' ? body.message : '请求失败，请稍后重试。');
  }
  return response.json() as Promise<T>;
}

export function getTopic(excludeTopicId?: string): Promise<TopicResponse> {
  const query = excludeTopicId ? `?excludeTopicId=${encodeURIComponent(excludeTopicId)}` : '';
  return request(`/api/topics/random${query}`, {}, 25_000);
}

export function submitAttempt(audio: Blob, metadata: SubmitAttemptMetadata): Promise<SubmitAttemptResponse> {
  const form = new FormData();
  const extension = audio.type.includes('mp4') ? 'm4a' : 'webm';
  form.append('audio', audio, `recording.${extension}`);
  form.append('metadata', JSON.stringify(metadata));
  return request('/api/attempts', { method: 'POST', body: form }, 135_000);
}
