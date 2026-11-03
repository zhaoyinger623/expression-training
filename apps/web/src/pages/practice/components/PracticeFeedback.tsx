import { useEffect, useRef } from 'react';
import { usePracticeStore } from '../../../stores/practiceStore';
import { MindMap } from './MindMap';
import styles from '../practice.module.less';
import common from '../../../components/common.module.less';

function renderHighlightedLine(line: string) {
  return line.split(/(==[^=]+==)/g).map((part, index) => part.startsWith('==') && part.endsWith('==')
    ? <mark key={index}>{part.slice(2, -2)}</mark>
    : part);
}

export function PracticeFeedback() {
  const { topic, results, selected, setSelected, result, busy, pendingSave, answerAgain, loadTopic } = usePracticeStore();
  const feedbackTitle = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    feedbackTitle.current?.focus();
  }, [selected, results.length]);

  if (!result) return null;

  return (
    <div className={styles['result-view']}>
      {results.length === 2 && <>
        <section className={styles['comparison-view']} aria-labelledby="comparison-title">
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
        <div className={styles['round-selector']} role="group" aria-label="查看作答结果">{results.map((item, index) => <button key={item.attempt.id} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}>{index === 0 ? '首次回答与反馈' : '第二次回答与反馈'}</button>)}</div>
      </>}
      <section className={styles['transcript-view']} aria-labelledby="transcript-title">
        <div className={common['section-title-row']}><h2 id="transcript-title">{results.length === 2 ? (selected === 0 ? '首次回答' : '第二次回答') : '你的回答'}</h2><span>转写文本 · 只读</span></div>
        <p className={styles['transcript-text']}>{result.attempt.transcript}</p>
      </section>
      <section className={styles['feedback-view']} aria-labelledby="feedback-title">
        <div className={styles['feedback-heading']}><h2 id="feedback-title" tabIndex={-1} ref={feedbackTitle}>{result.evaluation.summary}</h2></div>
        <div className={styles['feedback-companion']}><img src="/companion-still.png" alt="" width="64" height="64" /><p>一起看看，哪些地方可以更清楚。</p></div>
        <section className={styles['evidence-feedback']} aria-labelledby="evidence-title">
          <h3 id="evidence-title">从你的原话来看</h3>
          <div className={styles['evidence-list']}>{result.evaluation.evidenceQuotes.map((item, index) => <article className={`${styles['evidence-card']} ${styles[`evidence-${item.kind}`]}`} key={`${item.kind}-${index}`}>
            <span className={styles['evidence-kind']}>{item.kind === 'strength' ? '表达亮点' : '可以更清楚'}</span>
            <blockquote>“{item.text}”</blockquote>
            <p>{item.feedback}</p>
          </article>)}</div>
        </section>
        <section className={`${styles['feedback-next']} ${styles['feedback-next-bottom']}`}>
          <div><span className={styles['next-step-label']}>下一小步</span><h3>{results.length === 1 ? '再答一次时，试试这样做' : '下次练习，试试这样做'}</h3><p>{result.evaluation.nextStep}</p></div>
          {results.length === 1 ? <button className={`${styles['button']} ${common['button-primary']}`} type="button" disabled={busy} onClick={answerAgain}>同题再答一次 <span aria-hidden="true">↗</span></button>
            : <button className={`${styles['button']} ${common['button-primary']}`} type="button" disabled={busy || !!pendingSave} onClick={() => void loadTopic()}>换一题继续练习 <span aria-hidden="true">↗</span></button>}
        </section>
        <section className={styles['overall-score']} aria-label={`本次总分 ${result.evaluation.overallScore} 分，共 10 分`}>
          <div className={styles['overall-score-copy']}><span>本次练习 · 六个维度</span><h3>本次总分</h3><p>把表达的整体表现，变成下一步练习的起点。</p></div>
          <div className={styles['overall-score-value']}><strong>{result.evaluation.overallScore}</strong><span>/ 10</span></div>
          <div className={styles['score-track']} aria-hidden="true"><i style={{ width: `${result.evaluation.overallScore * 10}%` }} /></div>
        </section>
        <details className={styles['feedback-disclosure']} key={`maps-${result.attempt.id}`}>
          <summary>看看回答思路</summary>
        <div className={styles['mindmap-grid']}>
          <MindMap title="你的回答与待改进点" center={topic?.title ?? '你的回答'} nodes={result.evaluation.userMindMap} variant="user" />
          <MindMap title="参考回答思路" center="清晰表达的结构" nodes={result.evaluation.referenceMindMap} variant="reference" />
        </div>
        </details>
        <details className={styles['feedback-disclosure']} key={`dimensions-${result.attempt.id}`}>
          <summary>查看六个维度的具体反馈</summary>
        <div className={styles['dimension-list']}>{result.evaluation.dimensions.map((item) => <article className={styles['dimension-row']} key={item.name}>
          <div className={styles['dimension-top']}><h3>{item.name}</h3><span>{item.score}<small> / 10</small></span></div>
          <p>{item.reason}</p><p className={styles['dimension-suggestion']}>{item.suggestion}</p>
        </article>)}</div>
        </details>
        <details className={styles['feedback-disclosure']} key={`reference-${result.attempt.id}`}>
          <summary>读一份参考回答</summary>
        <section className={styles['reference-answer']}><h3>参考文字答案</h3><div className={styles['reference-answer-body']}>{result.evaluation.referenceAnswer.split('\n').map((line, index) => <p key={index}>{renderHighlightedLine(line)}</p>)}</div></section>
        </details>

      </section>
    </div>
  );
}
