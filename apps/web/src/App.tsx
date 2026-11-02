import { useEffect, useRef, useState } from 'react';
import type { SubmitAttemptResponse, Topic } from '@expression/shared';
import { getTopic, submitAttempt } from './api';
import { useRecorder } from './useRecorder';

function MicIcon({ recording }: { recording: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      {recording ? <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" /> : <>
        <rect x="9" y="2.5" width="6" height="12" rx="3" />
        <path d="M5.5 10.5a6.5 6.5 0 0 0 13 0M12 17v4M8.5 21h7" strokeLinecap="round" />
      </>}
    </svg>
  );
}

function App() {
  const [topic, setTopic] = useState<Topic | null>(null);
  const [loadingTopic, setLoadingTopic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<SubmitAttemptResponse[]>([]);
  const [selected, setSelected] = useState(0);
  const [showAnswer, setShowAnswer] = useState(true);
  const [audioUrl, setAudioUrl] = useState('');
  const recorder = useRecorder();
  const feedbackTitle = useRef<HTMLHeadingElement>(null);
  const recording = recorder.phase === 'recording';
  const requesting = recorder.phase === 'requesting';
  const busy = loadingTopic || submitting || recording || requesting;
  const result = results[selected];

  async function loadTopic() {
    setLoadingTopic(true);
    setError('');
    try {
      const response = await getTopic(topic?.id);
      setTopic(response.topic);
      setResults([]);
      setSelected(0);
      setShowAnswer(true);
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

  useEffect(() => {
    if (!showAnswer && result) feedbackTitle.current?.focus();
  }, [showAnswer, selected, results.length]);

  async function submit() {
    if (!topic || !recorder.audio) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await submitAttempt(recorder.audio, {
        topic, round: results.length === 0 ? 1 : 2, durationSeconds: recorder.seconds,
      });
      setResults((previous) => [...previous, response]);
      setSelected(results.length);
      setShowAnswer(false);
      recorder.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '提交失败，请重试。');
    } finally {
      setSubmitting(false);
    }
  }

  function answerAgain() {
    recorder.reset();
    setError('');
    setShowAnswer(true);
  }

  const time = `${String(Math.floor(recorder.seconds / 60)).padStart(2, '0')}:${String(Math.floor(recorder.seconds % 60)).padStart(2, '0')}`;

  return (
    <div className="app-shell">
      <header className="site-header"><a className="site-name" href="#main">言序</a></header>
      <main id="main" className="main-content">
        <section className={`topic-view ${!showAnswer ? 'topic-view-compact' : ''}`} aria-labelledby="topic-title" aria-busy={loadingTopic}>
          <div className="topic-topline">
            <p className="intro-line">一次练习，从一个值得思考的问题开始。</p>
            <button className="next-topic" type="button" disabled={busy} onClick={() => void loadTopic()}>
              {loadingTopic ? '获取中…' : '换一题'} <span aria-hidden="true">↗</span>
            </button>
          </div>
          <h1 id="topic-title" className="topic-title">{topic?.title ?? (loadingTopic ? '正在准备论题…' : '论题暂时无法获取')}</h1>
          {topic && <p className="topic-description">{topic.description}</p>}
          {loadingTopic && <p className="status-text" role="status">正在获取新的论题，请稍候。</p>}
        </section>

        {(error || recorder.error) && <div className="error-notice" role="alert">
          <p>{error || recorder.error}</p>
          {!topic && !loadingTopic && <button className="button button-secondary" type="button" onClick={() => void loadTopic()}>重新获取论题</button>}
        </div>}

        {topic && showAnswer && <section className="answer-view" aria-labelledby="answer-title">
          <div className="answer-heading">
            <h2 id="answer-title">{results.length ? '把想法再说一次' : '把想法说出来'}</h2>
            <p id="recording-hint">建议作答 1–3 分钟，3 分钟时自动结束。录音上限 6 MiB。</p>
            {results.length === 1 && <p className="practice-focus">本次重点：{results[0].evaluation.nextStep}</p>}
          </div>
          <div className="answer-center">
            {(recording || recorder.phase === 'recorded') && <div className="recording-time" aria-label={`录音时长 ${time}`}>{time}</div>}
            {(recorder.phase === 'idle' || requesting || recording) && <>
              <button className={`mic-control ${recording ? 'is-recording' : ''}`} type="button"
                disabled={loadingTopic || submitting || requesting} aria-label={recording ? '结束录音' : '开始录音'} aria-describedby="recording-hint"
                onClick={() => { setError(''); if (recording) recorder.stop(); else void recorder.start(); }}>
                <MicIcon recording={recording} />
              </button>
              <p className="mic-caption" role="status">{requesting ? '请允许浏览器使用麦克风…' : recording ? '正在录音，点击方块结束' : '点击话筒，开始回答'}</p>
            </>}
            {recorder.phase === 'recorded' && <div className="recording-review">
              <audio controls src={audioUrl} aria-label="回听本次录音" />
              <div className="recording-actions">
                <button className="button button-secondary" type="button" disabled={submitting} onClick={() => { setError(''); recorder.reset(); }}>重新录音</button>
                <button className="button button-primary" type="button" disabled={submitting || loadingTopic} onClick={() => void submit()}>
                  {submitting ? '处理中…' : error ? '重试提交' : '提交回答'}
                </button>
              </div>
              {submitting && <p className="status-text" role="status">正在转写并评估，请稍候…</p>}
            </div>}
            {results.length === 1 && !recording && !requesting && !submitting && <button className="text-button" type="button" onClick={() => { recorder.reset(); setError(''); setShowAnswer(false); }}>返回首次反馈</button>}
          </div>
        </section>}

        {!showAnswer && result && <div className="result-view">
          {results.length === 2 && <>
            <section className="comparison-view" aria-labelledby="comparison-title">
              <h2 id="comparison-title">两次作答对比</h2>
              <table>
                <thead><tr><th scope="col">评估维度</th><th scope="col">首次</th><th scope="col">第二次</th><th scope="col">分数变化</th></tr></thead>
                <tbody>{results[0].evaluation.dimensions.map((dimension) => {
                  const second = results[1].evaluation.dimensions.find((item) => item.name === dimension.name)!;
                  const change = second.score - dimension.score;
                  return <tr key={dimension.name}><th scope="row">{dimension.name}</th><td>{dimension.score}</td><td>{second.score}</td><td>{change > 0 ? `+${change}` : change === 0 ? '持平' : change}</td></tr>;
                })}</tbody>
              </table>
            </section>
            <div className="round-selector" role="group" aria-label="查看作答结果">{results.map((item, index) => <button key={item.attempt.id} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}>{index === 0 ? '首次回答与反馈' : '第二次回答与反馈'}</button>)}</div>
          </>}
          <section className="transcript-view" aria-labelledby="transcript-title">
            <div className="section-title-row"><h2 id="transcript-title">{results.length === 2 ? (selected === 0 ? '首次回答' : '第二次回答') : '你的回答'}</h2><span>转写文本 · 只读</span></div>
            <p className="transcript-text">{result.attempt.transcript}</p>
          </section>
          <section className="feedback-view" aria-labelledby="feedback-title">
            <div className="feedback-heading"><h2 id="feedback-title" tabIndex={-1} ref={feedbackTitle}>{result.evaluation.summary}</h2></div>
            <div className={`feedback-main ${!result.evaluation.featuredQuote ? 'feedback-main-single' : ''}`}>
              {result.evaluation.featuredQuote && <div className="feedback-quote"><span className="quote-mark" aria-hidden="true">“</span><blockquote>{result.evaluation.featuredQuote.text}</blockquote><p>{result.evaluation.featuredQuote.advice}</p></div>}
              <div className="feedback-next">
                <h3>{results.length === 1 ? '再答一次时，试试这样做' : '下次练习，试试这样做'}</h3>
                <p>{result.evaluation.nextStep}</p>
                {results.length === 1 ? <button className="button button-primary" type="button" disabled={loadingTopic} onClick={answerAgain}>同题再答一次 <span aria-hidden="true">↗</span></button>
                  : <button className="button button-primary" type="button" disabled={loadingTopic} onClick={() => void loadTopic()}>换一题继续练习 <span aria-hidden="true">↗</span></button>}
              </div>
            </div>
            <div className="feedback-details">
              {result.evaluation.strengths.length > 0 && <div><h3>已经做得好的</h3><ul>{result.evaluation.strengths.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
              {result.evaluation.issues.length > 0 && <div><h3>可以改进的</h3><ul>{result.evaluation.issues.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
            </div>
            <div className="dimension-list">{result.evaluation.dimensions.map((item) => <article className="dimension-row" key={item.name}>
              <div className="dimension-top"><h3>{item.name}</h3><span>{item.score}<small> / 10</small></span></div>
              <p>{item.reason}</p><p className="dimension-suggestion">{item.suggestion}</p>
            </article>)}</div>
          </section>
        </div>}
      </main>
      <footer className="site-footer"><span>言序 · 把想法说得更清楚</span><span>练习，从下一句话开始。</span></footer>
    </div>
  );
}

export default App;
