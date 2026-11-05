import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AnswerComparison, Practice, SubmitAttemptResponse, Topic } from '@expression/shared';
import { evaluateAttempt, getTopic, transcribeAudio } from '../api/practice';
import { getPractice, savePractice } from '../storage/practiceStorage';
import { useRecorder } from '../hooks/useRecorder';

const PracticeContext = createContext<ReturnType<typeof usePracticeState> | null>(null);

export function PracticeProvider({ children }: { children: ReactNode }) {
  const practice = usePracticeState();
  return <PracticeContext.Provider value={practice}>{children}</PracticeContext.Provider>;
}

export function usePracticeStore() {
  return useContext(PracticeContext)!;
}

function usePracticeState() {
  const [topic, setTopic] = useState<Topic | null>(null);
  const [loadingTopic, setLoadingTopic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [streamTranscript, setStreamTranscript] = useState('');
  const [evaluationCharacters, setEvaluationCharacters] = useState(0);
  const [error, setError] = useState('');
  const [results, setResults] = useState<SubmitAttemptResponse[]>([]);
  const [comparison, setComparison] = useState<AnswerComparison>();
  const [selected, setSelected] = useState(0);
  const [showAnswer, setShowAnswer] = useState(true);
  const [audioUrl, setAudioUrl] = useState('');
  const [practiceId, setPracticeId] = useState<string>(() => crypto.randomUUID());
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState('');
  const [pendingSave, setPendingSave] = useState<Practice | null>(null);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const recorder = useRecorder();
  const recording = recorder.phase === 'recording';
  const requesting = recorder.phase === 'requesting';
  const busy = loadingTopic || submitting || recording || requesting || recorder.realtimeStatus === 'finalizing' || saving || openingId !== null;
  const result = results[selected];

  async function loadTopic() {
    setLoadingTopic(true);
    setError('');
    try {
      const response = await getTopic(topic?.id);
      setTopic(response.topic);
      setResults([]);
      setComparison(undefined);
      setSelected(0);
      setShowAnswer(true);
      setPracticeId(crypto.randomUUID());
      setCreatedAt('');
      recorder.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '获取论题失败，请重试。');
    } finally {
      setLoadingTopic(false);
    }
  }

  useEffect(() => {
    // 延迟至 effect 稳定后请求，避免开发模式 StrictMode 重放造成重复出题。
    const timer = setTimeout(() => { void loadTopic(); }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!recorder.audio) { setAudioUrl(''); return; }
    const url = URL.createObjectURL(recorder.audio);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [recorder.audio]);

  async function submit() {
    if (!topic || !recorder.audio) return;
    setSubmitting(true);
    setError('');
    try {
      setStreamTranscript('');
      setEvaluationCharacters(0);
      const durationSeconds = recorder.seconds;
      const transcript = recorder.realtimeStatus === 'complete'
        ? recorder.transcript
        : await transcribeAudio(recorder.audio, durationSeconds, setStreamTranscript);
      setStreamTranscript(transcript);
      const response = await evaluateAttempt({
        topic, round: results.length === 0 ? 1 : 2, durationSeconds, transcript,
        ...(results[0] ? { firstAnswer: { transcript: results[0].attempt.transcript, nextStep: results[0].evaluation.nextStep } } : {}),
      }, setEvaluationCharacters);
      const { comparison: nextComparison, ...answer } = response;
      const nextResults = [...results, answer];
      setResults(nextResults);
      setComparison(nextComparison);
      setSelected(results.length);
      setShowAnswer(false);
      recorder.reset();
      const now = new Date().toISOString();
      const started = createdAt || now;
      setCreatedAt(started);
      await persist({ id: practiceId, topic, results: nextResults, ...(nextComparison ? { comparison: nextComparison } : {}), createdAt: started, updatedAt: now });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '提交失败，请重试。');
    } finally {
      setSubmitting(false);
    }
  }

  async function persist(practice: Practice) {
    setSaving(true);
    setSaveError('');
    try {
      await savePractice(practice);
      setPendingSave(null);
    } catch (cause) {
      setPendingSave(practice);
      setSaveError(cause instanceof Error ? cause.message : '本地历史保存失败。');
    } finally {
      setSaving(false);
    }
  }

  function answerAgain() {
    recorder.reset();
    setError('');
    setShowAnswer(true);
  }

  async function openPractice(id: string, continuePractice = false) {
    setOpeningId(id);
    setError('');
    try {
      const practice = await getPractice(id);
      setPracticeId(practice.id);
      setCreatedAt(practice.createdAt);
      setTopic(practice.topic);
      setResults(practice.results);
      setComparison(practice.comparison);
      setSelected(practice.results.length - 1);
      setShowAnswer(continuePractice && practice.results.length === 1);
      recorder.reset();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '读取练习失败，请重试。');
      return false;
    } finally {
      setOpeningId(null);
    }
  }

  return { comparison, topic, loadingTopic, submitting, streamTranscript, evaluationCharacters, error, setError, results, selected, setSelected, showAnswer, setShowAnswer, audioUrl, openingId, pendingSave, setPendingSave, saveError, setSaveError, saving, recorder, recording, requesting, busy, result, loadTopic, submit, persist, answerAgain, openPractice };
}
