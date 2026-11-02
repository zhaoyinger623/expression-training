import { useState } from 'react';
import type { DimensionFeedback, Topic } from '@expression/shared';

type PreviewState = 'ready' | 'recording' | 'result';

const topics: Topic[] = [
  {
    id: 'ai-decisions',
    title: '为了提高效率，我们是否应该让 AI 替我们做更多决定？',
    description: '从效率、个人判断与责任三个角度，选定立场并回应一种可能的反对意见。',
    source: 'preset',
    createdAt: '2026-11-02T00:00:00.000Z',
  },
  {
    id: 'clear-opinion',
    title: '公开表达时，观点鲜明比保持中立更重要吗？',
    description: '想一想表达的目的、信息是否充分，以及如何面对不同意见。',
    source: 'preset',
    createdAt: '2026-11-02T00:00:00.000Z',
  },
  {
    id: 'remote-work',
    title: '远程办公是否比办公室工作更有利于团队协作？',
    description: '结合沟通效率、专注时间与团队信任，说明你的判断适用于什么情况。',
    source: 'preset',
    createdAt: '2026-11-02T00:00:00.000Z',
  },
];

const examples: {
  transcript: string;
  heading: string;
  quote: string;
  quoteAdvice: string;
  nextStep: string;
  dimensions: DimensionFeedback[];
}[] = [
  {
    transcript: '我认为 AI 可以帮助我们处理重复、信息量大的决定，但不应该替我们做所有决定。比如安排日程，它能快速比较时间和地点，省下很多精力。可是涉及职业选择或人际关系时，个人的价值取向很重要，AI 很难替我们承担后果。有人可能会说，让 AI 多做决定可以减少人的偏见。这个观点有道理，不过 AI 也可能继承训练数据中的偏见。所以我认为，适合的做法是让 AI 提供选项和理由，最终决定仍由人作出。',
    heading: '观点已经清楚，下一步让论证更扎实。',
    quote: '适合的做法是让 AI 提供选项和理由，最终决定仍由人作出。',
    quoteAdvice: '这个结论明确。下次可以说明：人该用什么标准检查 AI 给出的理由？',
    nextStep: '加入一个具体决策场景，说明 AI 提供了什么信息、你如何判断，以及最终由谁承担责任。',
    dimensions: [
      { name: '观点与论证', score: 8, reason: '立场明确，并用日程安排与职业选择说明了适用边界。', suggestion: '可以再补充一个具体情境，说明人如何核查 AI 给出的理由。' },
      { name: '结构与连贯', score: 7, reason: '先表态、再举例、接着回应反方，整体顺序清楚。', suggestion: '从“职业选择”转到“反方观点”时，加一句过渡会更自然。' },
      { name: '表达清晰度', score: 8, reason: '句子长度适中，结论容易理解。', suggestion: '结尾可把“提供选项和理由”说得更具体一些。' },
    ],
  },
  {
    transcript: '我认为公开表达时，观点鲜明通常比保持中立更重要。听众需要知道我真正的判断，才能回应我。不过观点鲜明不等于说得绝对。比如面对一个信息还不充分的社会议题，我可以先说明自己倾向哪种看法，再指出哪些事实可能改变判断。有人可能觉得这样不够坚定，但我认为承认不确定性，反而能让讨论更诚实。',
    heading: '立场鲜明，也保留了讨论空间。',
    quote: '观点鲜明不等于说得绝对。',
    quoteAdvice: '这句话抓住了论题的关键区别。下次可以用一个更具体的场景证明它。',
    nextStep: '举一个你亲自参与过的讨论，说明表达立场后如何认真听取反对意见。',
    dimensions: [
      { name: '观点与论证', score: 8, reason: '明确支持表达立场，同时区分了鲜明与绝对。', suggestion: '把“社会议题”换成具体例子，论证会更可信。' },
      { name: '结构与连贯', score: 8, reason: '先给判断，再说明边界，最后回应反对意见。', suggestion: '结尾可重申听众为何需要知道你的立场。' },
      { name: '表达清晰度', score: 7, reason: '关键词使用准确，但部分句子较长。', suggestion: '把“面对一个信息还不充分的社会议题”一句拆开说。' },
    ],
  },
  {
    transcript: '我认为远程办公不一定比办公室工作更有利于协作，关键要看任务类型。需要独立思考和写作的工作，远程办公能减少打断，让每个人准备更充分；但遇到复杂问题，需要快速澄清误解时，同处一室往往更有效。有人会说线上会议也能解决问题，我同意，但它很难完全替代临时讨论。所以我倾向于让团队根据任务安排工作地点。',
    heading: '你指出了协作方式的适用条件。',
    quote: '关键要看任务类型。',
    quoteAdvice: '这个判断让回答有了清楚的主线。下次可以说明怎样判断任务需要哪种协作方式。',
    nextStep: '选一个真实团队任务，比较远程与同场协作各自会遇到什么问题。',
    dimensions: [
      { name: '观点与论证', score: 8, reason: '用独立工作和复杂问题区分了两种场景。', suggestion: '补充一个具体团队任务，帮助听众理解判断标准。' },
      { name: '结构与连贯', score: 7, reason: '比较、回应反方和结论的顺序清楚。', suggestion: '从“线上会议”转到最终建议时，可以补一句总结。' },
      { name: '表达清晰度', score: 8, reason: '用词直接，听众容易抓住“任务类型”这条主线。', suggestion: '把最后一句的“根据任务”具体说成两种安排。' },
    ],
  },
];

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="9" y="2.5" width="6" height="12" rx="3" />
      <path d="M5.5 10.5a6.5 6.5 0 0 0 13 0M12 17v4M8.5 21h7" strokeLinecap="round" />
    </svg>
  );
}

function App() {
  const [previewState, setPreviewState] = useState<PreviewState>('ready');
  const [topicIndex, setTopicIndex] = useState(0);
  const topic = topics[topicIndex];
  const example = examples[topicIndex];

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="site-name" href="#main" onClick={() => setPreviewState('ready')}>言序</a>
        <span className="preview-note">静态界面预览 · 内容为示例</span>
      </header>

      <main id="main" className="main-content">
        <section className={`topic-view ${previewState === 'result' ? 'topic-view-compact' : ''}`} aria-labelledby="topic-title">
          <div className="topic-topline">
            <p className="intro-line">一次练习，从一个值得思考的问题开始。</p>
            <button className="next-topic" type="button" onClick={() => { setTopicIndex((current) => (current + 1) % topics.length); setPreviewState('ready'); }}>
              换一题 <span aria-hidden="true">↗</span>
            </button>
          </div>
          <h1 id="topic-title" className="topic-title">{topic.title}</h1>
          <p className="topic-description">{topic.description}</p>
        </section>

        {previewState !== 'result' && (
          <section className="answer-view" aria-labelledby="answer-title">
            <div className="answer-heading">
              <h2 id="answer-title">把想法说出来</h2>
              <p>先说清你的立场，再解释为什么。建议作答 1–3 分钟。</p>
            </div>

            <div className="answer-center">
              {previewState === 'recording' && <div className="recording-time">01:24</div>}
              <button
                className={`mic-control ${previewState === 'recording' ? 'is-recording' : ''}`}
                type="button"
                aria-label={previewState === 'ready' ? '查看作答界面示例' : '查看回答与反馈示例'}
                onClick={() => setPreviewState(previewState === 'ready' ? 'recording' : 'result')}
              >
                <MicIcon />
              </button>
              <p className="mic-caption">{previewState === 'ready' ? '点击话筒，查看作答预览' : '录音界面示例 · 点击话筒查看反馈'}</p>
              {previewState === 'recording' && (
                <div className="waveform" aria-hidden="true">
                  {[18, 30, 44, 28, 56, 38, 66, 42, 24, 52, 72, 36, 58, 32, 46, 22, 62, 40, 26, 50, 34, 68, 28, 44, 20].map((height, index) => <i key={index} style={{ height: `${height}px` }} />)}
                </div>
              )}
            </div>
          </section>
        )}

        {previewState === 'result' && (
          <div className="result-view">
            <section className="transcript-view" aria-labelledby="transcript-title">
              <div className="section-title-row">
                <h2 id="transcript-title">你的回答</h2>
                <span>转写文本 · 只读</span>
              </div>
              <p className="transcript-text">{example.transcript}</p>
            </section>

            <section className="feedback-view" aria-labelledby="feedback-title">
              <div className="feedback-heading">
                <h2 id="feedback-title">{example.heading}</h2>
                <p>以下是示例反馈，展示未来评估结果的呈现方式。</p>
              </div>
              <div className="feedback-main">
                <div className="feedback-quote">
                  <span className="quote-mark" aria-hidden="true">“</span>
                  <blockquote>{example.quote}</blockquote>
                  <p>{example.quoteAdvice}</p>
                </div>
                <div className="feedback-next">
                  <h3>再答一次时，试试这样做</h3>
                  <p>{example.nextStep}</p>
                  <button className="button button-primary" type="button" onClick={() => setPreviewState('ready')}>同题再答一次 <span aria-hidden="true">↗</span></button>
                </div>
              </div>
              <div className="dimension-list">
                {example.dimensions.map((item) => (
                  <article className="dimension-row" key={item.name}>
                    <div className="dimension-top"><h3>{item.name}</h3><span>{item.score}<small> / 10</small></span></div>
                    <p>{item.reason}</p>
                    <p className="dimension-suggestion">{item.suggestion}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>

      <footer className="site-footer"><span>言序 · 把想法说得更清楚</span><span>练习，从下一句话开始。</span></footer>
    </div>
  );
}

export default App;
