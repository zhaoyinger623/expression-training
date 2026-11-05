export type TopicSource = 'ai' | 'preset';

export interface Topic {
  id: string;
  title: string;
  description: string;
  source: TopicSource;
  createdAt: string;
}

export interface DimensionFeedback {
  name: '观点与论证' | '结构与连贯' | '表达清晰度' | '论题回应度' | '具体性与例证' | '权衡与边界';
  score: number;
  strength: string;
  weakness: string;
}

export interface Evaluation {
  attemptId: string;
  overallScore: number;
  summary: string;
  userMindMap: MindMapNode[];
  referenceMindMap: MindMapNode[];
  referenceAnswer: string;
  expressionMethod: {
    recommendedStyle: string;
    structure: string;
    rationale: string;
    suitableFor: string;
    steps: string[];
    sentenceStarters: string[];
    styleExamples: { name: string; sample: string }[];
  };
  evidenceQuotes: { kind: 'strength' | 'improvement'; text: string; feedback: string }[];
  featuredQuote: { text: string; advice: string } | null;
  dimensions: DimensionFeedback[];
  strengths: string[];
  issues: string[];
  nextStep: string;
}

export interface AnswerComparison {
  summary: string;
  changes: {
    dimension: DimensionFeedback['name'];
    status: 'improved' | 'unchanged' | 'regressed';
    firstQuote: string;
    secondQuote: string;
    explanation: string;
  }[];
  remainingIssue: string;
  nextAction: string;
}

export interface MindMapNode {
  label: string;
  children: MindMapNode[];
}

export type TranscriptionStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'complete'; transcript: string }
  | { type: 'error'; error: ApiErrorResponse };

/** 实时转写 WebSocket：客户端发送 16kHz 单声道 PCM16 二进制帧，结束时发送 { type: 'finish' }。 */
export type RealtimeTranscriptionEvent =
  | { type: 'ready' }
  | { type: 'transcript'; transcript: string }
  | { type: 'complete'; transcript: string }
  | { type: 'error'; error: ApiErrorResponse };

export type EvaluationStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'complete'; result: SubmitAttemptResponse }
  | { type: 'error'; error: ApiErrorResponse };

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
  topic: Topic;
  round: 1 | 2;
  durationSeconds: number;
}

export interface EvaluateAttemptRequest extends SubmitAttemptMetadata {
  transcript: string;
  firstAnswer?: { transcript: string; nextStep: string };
}

export interface SubmitAttemptResponse {
  attempt: Attempt;
  evaluation: Evaluation;
  comparison?: AnswerComparison;
}

export interface Practice {
  id: string;
  topic: Topic;
  results: SubmitAttemptResponse[];
  comparison?: AnswerComparison;
  createdAt: string;
  updatedAt: string;
}

export interface PracticeSummary {
  id: string;
  topicTitle: string;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
  totalDurationSeconds: number;
  firstTranscript: string;
  scoreChange: number | null;
  improvedDimensions: number;
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
