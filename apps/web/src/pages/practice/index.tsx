import { usePracticeStore } from '../../stores/practiceStore';
import { MicIcon, RefreshIcon } from './components/Icons';
import { PracticeFeedback } from './components/PracticeFeedback';
import styles from './practice.module.less';
import common from '../../components/common.module.less';
import { recordingMode } from '../../config/recording';

export default function PracticePage() {
  const { topic, loadingTopic, submitting, streamTranscript, evaluationCharacters, error, setError, results, showAnswer, setShowAnswer, audioUrl, pendingSave, recorder, recording, requesting, busy, result, loadTopic, submit } = usePracticeStore();
  const time = `${String(Math.floor(recorder.seconds / 60)).padStart(2, '0')}:${String(Math.floor(recorder.seconds % 60)).padStart(2, '0')}`;

  return <>
    <section className={`${styles['topic-view']} ${!showAnswer ? styles['topic-view-compact'] : ''}`} aria-labelledby="topic-title" aria-busy={loadingTopic}>
      <div className={styles['topic-topline']}>
        <p className={styles['intro-line']}>今天，慢慢聊一个问题。</p>
        <button className={styles['next-topic']} type="button" disabled={busy || !!pendingSave} onClick={() => void loadTopic()}>
          {loadingTopic ? '获取中…' : '换一题'} <RefreshIcon />
        </button>
      </div>
      <h1 id="topic-title" className={styles['topic-title']}>{topic?.title ?? (loadingTopic ? '正在准备论题…' : '论题暂时无法获取')}</h1>
      {topic && <p className={styles['topic-description']}>{topic.description}</p>}
      {loadingTopic && <div className={styles['topic-loading']}><p className={common['status-text']} role="status">正在获取新的论题，请稍候。</p><p className={styles['practice-slogan']}>自信表达自己，让每一次发言掷地有声</p></div>}
    </section>

    {(error || recorder.error) && <div className={common['error-notice']} role="alert">
      <p>{error || recorder.error}</p>
      {!topic && !loadingTopic && <button className={`${styles['button']} ${common['button-secondary']}`} type="button" onClick={() => void loadTopic()}>重新获取论题</button>}
    </div>}
    {topic && showAnswer && <section className={styles['answer-view']} aria-labelledby="answer-title">
      <div className={styles['answer-heading']}>
        <h2 id="answer-title">{results.length ? '把想法再说一次' : '把想法说出来'}</h2>
        <p id="recording-hint">建议作答 1–3 分钟，3 分钟时自动结束。</p>
        {recordingMode === 'realtime' && <p className={common['status-text']}>开始录音后会实时上传语音并转写，可先回听再提交评估。</p>}
        {results.length === 1 && <p className={styles['practice-focus']}>本次重点：{results[0].evaluation.nextStep}</p>}
      </div>
      <div className={styles['answer-center']}>
        <div className={styles['companion-scene']} aria-hidden="true">
          <picture>
            <source media="(prefers-reduced-motion: reduce)" srcSet="/companion-still.png" />
            <img className={styles['recording-companion']} src={recording ? '/recording-companion.gif' : submitting ? '/transcribing-companion.gif' : '/companion-still.png'} alt="" width="112" height="112" />
          </picture>
        </div>
        <p className={styles['companion-message']}>{recording ? '慢慢说，停顿一下也没关系。' : submitting ? '正在整理你的回答，稍等一会儿。' : recorder.phase === 'recorded' ? '说完了，可以先听听自己的声音。' : '慢慢想，准备好了就开始。'}</p>
        {(recording || recorder.phase === 'recorded') && <div className={styles['recording-time']} aria-label={`录音时长 ${time}`}>{time}</div>}
        {(recorder.phase === 'idle' || requesting || recording) && <>
          <button className={`${styles['mic-control']} ${recording ? styles['is-recording'] : ''}`} type="button"
            disabled={loadingTopic || submitting || requesting} aria-label={recording ? '结束录音' : '开始录音'} aria-describedby="recording-hint"
            onClick={() => { setError(''); if (recording) recorder.stop(); else void recorder.start(); }}>
            <MicIcon recording={recording} />
          </button>
          <p className={styles['mic-caption']} role="status">{requesting ? (recorder.realtimeStatus === 'connecting' ? '正在连接实时转写…' : '请允许浏览器使用麦克风…') : recording ? '正在录音，点击方块结束' : '点击话筒，开始回答'}</p>
        </>}
        {recorder.phase === 'recorded' && <div className={styles['recording-review']}>
          <div className={styles['recording-review-controls']}>
            <audio controls src={audioUrl} aria-label="回听本次录音" />
            <div className={styles['recording-actions']}>
              <button className={`${styles['button']} ${common['button-secondary']}`} type="button" disabled={submitting || recorder.realtimeStatus === 'finalizing'} onClick={() => { setError(''); recorder.reset(); }}>重新录音</button>
              <button className={`${styles['button']} ${common['button-primary']}`} type="button" disabled={submitting || loadingTopic || recorder.realtimeStatus === 'finalizing'} onClick={() => void submit()}>
                {submitting ? '处理中…' : recorder.realtimeStatus === 'finalizing' ? '正在确认转写…' : error ? '重试提交' : '提交回答'}
              </button>
            </div>
          </div>
          {submitting && <div className={styles['stream-progress']} role="status"><p>{streamTranscript ? (evaluationCharacters ? '正在梳理表达亮点和练习建议…' : '文字整理好了，正在分析你的表达…') : '正在把你的声音整理成文字…'}</p>{streamTranscript && <p className={styles['stream-transcript']}>{streamTranscript}</p>}</div>}
        </div>}
        {recordingMode === 'realtime' && recorder.phase !== 'idle' && !submitting && <div className={styles['stream-progress']}>
          <p className={common['status-text']} role="status">{recorder.realtimeStatus === 'failed'
            ? `${recorder.realtimeError}。录音会保留，提交时将使用完整录音重新转写。`
            : recorder.realtimeStatus === 'finalizing' ? '录音已结束，正在确认最后一段文字…'
              : recorder.realtimeStatus === 'complete' ? '转写已完成，可回听后提交。'
                : recorder.realtimeStatus === 'connecting' ? (requesting ? '正在准备录音并连接实时转写…' : '正在连接实时转写，录音已开始，连接后会补传开头的语音。') : '边说边转写，文字会实时更新。'}</p>
          {recorder.transcript && <p className={styles['stream-transcript']} aria-label="实时转写文本">{recorder.transcript}</p>}
        </div>}
        {results.length === 1 && !recording && !requesting && !submitting && <button className={common['text-button']} type="button" onClick={() => { recorder.reset(); setError(''); setShowAnswer(false); }}>返回首次反馈</button>}
      </div>
    </section>}

    {!showAnswer && result && <PracticeFeedback />}
  </>;
}
