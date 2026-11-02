import { useEffect, useRef, useState } from 'react';
import type { MindMapNode, Practice, SubmitAttemptResponse, Topic } from '@expression/shared';
import { getTopic, submitAttempt } from './api';
import { getPractice, savePractice } from './practiceStore';
import { useRecorder } from './useRecorder';
import { HistoryPanel } from './HistoryPanel';

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

function MindMap({ title, center, nodes, variant }: { title: string; center: string; nodes: MindMapNode[]; variant: 'user' | 'reference' }) {
  return <section className={`mindmap-view mindmap-${variant}`} aria-label={title}>
    <h3>{title}</h3>
    <div className="mindmap"><strong className="mindmap-center">{center}</strong><ul>{nodes.map((node, index) => <MindMapBranch key={`${node.label}-${index}`} node={node} index={index} />)}</ul></div>
  </section>;
}

function MindMapBranch({ node, index }: { node: MindMapNode; index: number }) {
  return <li className={`branch-tone-${index % 4}`}><span>{node.label}</span>{node.children.length > 0 && <ul>{node.children.map((child, childIndex) => <MindMapBranch key={`${child.label}-${childIndex}`} node={child} index={childIndex} />)}</ul>}</li>;
}

function renderHighlightedLine(line: string) {
  return line.split(/(==[^=]+==)/g).map((part, index) => part.startsWith('==') && part.endsWith('==')
    ? <mark key={index}>{part.slice(2, -2)}</mark>
    : part);
}

function App() {
  const [topic, setTopic] = useState<Topic | null>(null);
  const [loadingTopic, setLoadingTopic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [streamTranscript, setStreamTranscript] = useState('');
  const [error, setError] = useState('');
  const [results, setResults] = useState<SubmitAttemptResponse[]>([]);
  const [selected, setSelected] = useState(0);
  const [showAnswer, setShowAnswer] = useState(true);
  const [audioUrl, setAudioUrl] = useState('');
  const [practiceId, setPracticeId] = useState<string>(() => crypto.randomUUID());
  const [showHistory, setShowHistory] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState('');
  const [pendingSave, setPendingSave] = useState<Practice | null>(null);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const recorder = useRecorder();
  const feedbackTitle = useRef<HTMLHeadingElement>(null);
  const recording = recorder.phase === 'recording';
  const requesting = recorder.phase === 'requesting';
  const busy = loadingTopic || submitting || recording || requesting || saving || openingId !== null;
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

  useEffect(() => {
    if (!showAnswer && result) feedbackTitle.current?.focus();
  }, [showAnswer, selected, results.length]);

  async function submit() {
    if (!topic || !recorder.audio) return;
    setSubmitting(true);
    setError('');
    try {
      setStreamTranscript('');
      const response = await submitAttempt(recorder.audio, {
        topic, round: results.length === 0 ? 1 : 2, durationSeconds: recorder.seconds,
      }, setStreamTranscript);
      const nextResults = [...results, response];
      setResults(nextResults);
      setSelected(results.length);
      setShowAnswer(false);
      recorder.reset();
      const now = new Date().toISOString();
      const started = createdAt || now;
      setCreatedAt(started);
      await persist({ id: practiceId, topic, results: nextResults, createdAt: started, updatedAt: now });
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

  async function openPractice(id: string) {
    setOpeningId(id);
    setError('');
    try {
      const practice = await getPractice(id);
      setPracticeId(practice.id);
      setCreatedAt(practice.createdAt);
      setTopic(practice.topic);
      setResults(practice.results);
      setSelected(practice.results.length - 1);
      setShowAnswer(false);
      recorder.reset();
      setShowHistory(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '读取练习失败，请重试。');
    } finally {
      setOpeningId(null);
    }
  }

  const time = `${String(Math.floor(recorder.seconds / 60)).padStart(2, '0')}:${String(Math.floor(recorder.seconds % 60)).padStart(2, '0')}`;

  return (
    <div className="app-shell">
      <header className="site-header"><a className="site-name" href="#main">言序</a>
        <nav className="header-actions" aria-label="练习导航">
          <button type="button" disabled={busy || !!pendingSave} aria-pressed={!showHistory} onClick={() => { setError(''); setShowHistory(false); }}>练习</button>
          <button type="button" disabled={busy || !!pendingSave} aria-pressed={showHistory} onClick={() => { setError(''); setShowHistory(true); }}>历史记录</button>
        </nav>
      </header>
      <main id="main" className="main-content">
        {pendingSave && <div className="error-notice" role="alert">
          <p>{saveError || '正在保存本地历史…'} 回答与反馈已生成，历史尚未保存。请在离开或刷新页面前重试保存。</p>
          <button className="text-button" type="button" disabled={busy} onClick={() => void persist(pendingSave)}>{saving ? '保存中…' : '重试保存'}</button>
          <button className="text-button" type="button" disabled={busy} onClick={() => { setPendingSave(null); setSaveError(''); }}>暂不保存，继续使用</button>
        </div>}
        {showHistory ? <HistoryPanel onOpen={(id) => void openPractice(id)} openingId={openingId} detailError={error} /> : <>
        <section className={`topic-view ${!showAnswer ? 'topic-view-compact' : ''}`} aria-labelledby="topic-title" aria-busy={loadingTopic}>
          <div className="topic-topline">
            <p className="intro-line">一次练习，从一个值得思考的问题开始。</p>
            <button className="next-topic" type="button" disabled={busy || !!pendingSave} onClick={() => void loadTopic()}>
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
            <p id="recording-hint">建议作答 1–3 分钟，3 分钟时自动结束。录音上限 4 MiB。</p>
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
              {submitting && <div className="stream-progress" role="status"><p>{streamTranscript ? '转写完成，正在生成评估…' : '正在转写录音…'}</p>{streamTranscript && <p className="stream-transcript">{streamTranscript}</p>}</div>}
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
            <section className="overall-score" aria-label={`本次总分 ${result.evaluation.overallScore} 分，共 10 分`}>
              <div className="overall-score-copy"><span>OVERALL SCORE · 6 DIMENSIONS</span><h3>本次总分</h3><p>把表达的整体表现，变成下一步练习的起点。</p></div>
              <div className="overall-score-value"><strong>{result.evaluation.overallScore}</strong><span>/ 10</span></div>
              <div className="score-track" aria-hidden="true"><i style={{ width: `${result.evaluation.overallScore * 10}%` }} /></div>
            </section>
            <div className="mindmap-grid">
              <MindMap title="你的回答与待改进点" center={topic?.title ?? '你的回答'} nodes={result.evaluation.userMindMap} variant="user" />
              <MindMap title="参考回答思路" center="清晰表达的结构" nodes={result.evaluation.referenceMindMap} variant="reference" />
            </div>
            <div className="dimension-list">{result.evaluation.dimensions.map((item) => <article className="dimension-row" key={item.name}>
              <div className="dimension-top"><h3>{item.name}</h3><span>{item.score}<small> / 10</small></span></div>
              <p>{item.reason}</p><p className="dimension-suggestion">{item.suggestion}</p>
            </article>)}</div>
            <section className="reference-answer"><h3>参考文字答案</h3><div className="reference-answer-body">{result.evaluation.referenceAnswer.split('\n').map((line, index) => <p key={index}>{renderHighlightedLine(line)}</p>)}</div></section>
            <section className="evidence-feedback" aria-labelledby="evidence-title">
              <h3 id="evidence-title">从你的原话来看</h3>
              <div className="evidence-list">{result.evaluation.evidenceQuotes.map((item, index) => <article className={`evidence-card evidence-${item.kind}`} key={`${item.kind}-${index}`}>
                <span className="evidence-kind">{item.kind === 'strength' ? '表达亮点' : '可以更清楚'}</span>
                <blockquote>“{item.text}”</blockquote>
                <p>{item.feedback}</p>
              </article>)}</div>
            </section>
            <section className="feedback-next feedback-next-bottom">
              <div><span className="next-step-label">NEXT STEP</span><h3>{results.length === 1 ? '再答一次时，试试这样做' : '下次练习，试试这样做'}</h3><p>{result.evaluation.nextStep}</p></div>
              {results.length === 1 ? <button className="button button-primary" type="button" disabled={busy} onClick={answerAgain}>同题再答一次 <span aria-hidden="true">↗</span></button>
                : <button className="button button-primary" type="button" disabled={busy || !!pendingSave} onClick={() => void loadTopic()}>换一题继续练习 <span aria-hidden="true">↗</span></button>}
            </section>
          </section>
        </div>}
        </>}
      </main>
      <footer className="site-footer"><span>言序 · 把想法说得更清楚</span><span>练习，从下一句话开始。</span></footer>
    </div>
  );
}

export default App;
