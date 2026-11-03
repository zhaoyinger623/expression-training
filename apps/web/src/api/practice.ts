import type { EvaluateAttemptRequest, EvaluationStreamEvent, SubmitAttemptResponse, TopicResponse, TranscriptionStreamEvent } from '@expression/shared';

import { readStream, request } from './client';

export function getTopic(excludeTopicId?: string): Promise<TopicResponse> {
  const query = excludeTopicId ? `?excludeTopicId=${encodeURIComponent(excludeTopicId)}` : '';
  return request(`/api/topics/random${query}`, {}, 25_000);
}

export function transcribeAudio(audio: Blob, durationSeconds: number, onTranscript: (text: string) => void): Promise<string> {
  const form = new FormData();
  const extension = audio.type.includes('mp4') ? 'm4a' : 'webm';
  form.append('audio', audio, `recording.${extension}`);
  form.append('durationSeconds', String(durationSeconds));
  return readStream<TranscriptionStreamEvent, string>('/api/transcriptions/stream', form, (event, state) => {
    if (event.type === 'delta') {
      state.transcript += event.text;
      onTranscript(state.transcript);
    }
    if (event.type === 'complete') state.result = event.transcript;
  }, { transcript: '', result: '', characters: 0 }, '转写未返回完整文本，请重试。');
}

export function evaluateAttempt(input: EvaluateAttemptRequest, onProgress: (characters: number) => void): Promise<SubmitAttemptResponse> {
  return readStream<EvaluationStreamEvent, SubmitAttemptResponse>('/api/evaluations/stream', JSON.stringify(input), (event, state) => {
    if (event.type === 'delta') {
      state.characters += event.text.length;
      onProgress(state.characters);
    }
    if (event.type === 'complete') state.result = event.result;
  }, { transcript: '', characters: 0, result: null }, '服务未返回完整评估结果，请重试。');
}
