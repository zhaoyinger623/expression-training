export type TopicSource = 'ai' | 'preset';

export interface Topic {
  id: string;
  title: string;
  description: string;
  source: TopicSource;
  createdAt: string;
}

export interface DimensionFeedback {
  name: '观点与论证' | '结构与连贯' | '表达清晰度';
  score: number;
  reason: string;
  suggestion: string;
}

export interface Evaluation {
  attemptId: string;
  summary: string;
  featuredQuote: { text: string; advice: string } | null;
  dimensions: DimensionFeedback[];
  strengths: string[];
  issues: string[];
  nextStep: string;
}

export interface Attempt {
  id: string;
  topicId: string;
  round: 1 | 2;
  transcript: string;
  durationSeconds: number;
  createdAt: string;
}

/** GET /api/topics/random 的响应。 */
export interface TopicResponse {
  topic: Topic;
}

/** POST /api/transcriptions；multipart 字段为 audio 和 durationSeconds。 */
export interface TranscriptionResponse {
  transcript: string;
}

/** multipart 的 metadata 字段以 JSON 字符串发送，audio 字段为录音文件。 */
export interface SubmitAttemptMetadata {
  practiceId: string;
  topic: Topic;
  round: 1 | 2;
  durationSeconds: number;
}

export interface SubmitAttemptResponse {
  attempt: Attempt;
  evaluation: Evaluation;
}

export interface Practice {
  id: string;
  topic: Topic;
  results: SubmitAttemptResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface PracticeSummary {
  id: string;
  topicTitle: string;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PracticeHistoryResponse {
  items: PracticeSummary[];
  total: number;
}

export type ApiErrorCode =
  | 'NOT_FOUND'
  | 'HTTP_ERROR'
  | 'INVALID_REQUEST'
  | 'AUDIO_TOO_LARGE'
  | 'UNSUPPORTED_AUDIO_FORMAT'
  | 'EMPTY_TRANSCRIPT'
  | 'TRANSCRIPTION_FAILED'
  | 'EVALUATION_FAILED'
  | 'UPSTREAM_TIMEOUT'
  | 'SERVICE_NOT_CONFIGURED'
  | 'INTERNAL_ERROR';

export interface ApiErrorResponse {
  code: ApiErrorCode;
  message: string;
}
