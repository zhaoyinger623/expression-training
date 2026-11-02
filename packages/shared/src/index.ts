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
