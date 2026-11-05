import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { usePracticeStore } from "../../../stores/practiceStore";
const MindMap = lazy(() =>
  import("./MindMap").then((module) => ({ default: module.MindMap })),
);
import styles from "../practice.module.less";
import common from "../../../components/common.module.less";

function renderHighlightedLine(line: string) {
  return line
    .split(/(==[^=]+==)/g)
    .map((part, index) =>
      part.startsWith("==") && part.endsWith("==") ? (
        <mark key={index} className={styles["reference-highlight"]}>
          {part.slice(2, -2)}
        </mark>
      ) : (
        part
      ),
    );
}

function ScoreRadar({
  dimensions,
}: {
  dimensions: { name: string; score: number }[];
}) {
  const center = 180;
  const radius = 112;
  const labelRadius = 158;
  const pointAt = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / dimensions.length - Math.PI / 2;
    return `${center + (Math.cos(angle) * radius * value) / 10},${center + (Math.sin(angle) * radius * value) / 10}`;
  };
  const labelAt = (index: number) => {
    const angle = (Math.PI * 2 * index) / dimensions.length - Math.PI / 2;
    return {
      x: center + Math.cos(angle) * labelRadius,
      y: center + Math.sin(angle) * labelRadius,
    };
  };
  const points = dimensions
    .map((item, index) => pointAt(index, item.score))
    .join(" ");

  return (
    <section
      className={styles["score-radar"]}
      aria-labelledby="score-radar-title"
    >
      <div className={styles["score-radar-heading"]}>
        <h3 id="score-radar-title">六维评分</h3>
        <p>看看这次表达各方面的表现</p>
      </div>
      <svg
        className={styles["score-radar-chart"]}
        viewBox="0 0 360 360"
        role="img"
        aria-labelledby="score-radar-title score-radar-description"
      >
        <desc id="score-radar-description">
          {dimensions.map((item) => `${item.name}：${item.score}分`).join("；")}
        </desc>
        {Array.from({ length: 5 }, (_, ring) => {
          const value = (ring + 1) * 2;
          const ringPoints = dimensions
            .map((_, index) => pointAt(index, value))
            .join(" ");
          return (
            <polygon
              key={value}
              points={ringPoints}
              className={styles["radar-grid"]}
            />
          );
        })}
        {dimensions.map((item, index) => {
          const angle = (Math.PI * 2 * index) / dimensions.length - Math.PI / 2;
          const endX = center + Math.cos(angle) * radius;
          const endY = center + Math.sin(angle) * radius;
          const label = labelAt(index);
          const anchor =
            label.x < center - 12
              ? "end"
              : label.x > center + 12
                ? "start"
                : "middle";
          return (
            <g key={item.name}>
              <line
                x1={center}
                y1={center}
                x2={endX}
                y2={endY}
                className={styles["radar-axis"]}
              />
              <text
                x={label.x}
                y={label.y}
                textAnchor={anchor}
                className={styles["radar-label"]}
              >
                <tspan x={label.x} dy="-0.35em">
                  {item.name}
                </tspan>
                <tspan x={label.x} dy="1.4em" className={styles["radar-value"]}>
                  {item.score} / 10
                </tspan>
              </text>
            </g>
          );
        })}
        <polygon points={points} className={styles["radar-score-area"]} />
        {dimensions.map((item, index) => {
          const [cx, cy] = pointAt(index, item.score).split(",");
          return (
            <circle
              key={item.name}
              cx={cx}
              cy={cy}
              r="4"
              className={styles["radar-score-point"]}
            />
          );
        })}
      </svg>
    </section>
  );
}

export function PracticeFeedback() {
  const [selectedStyle, setSelectedStyle] = useState<number | null>(null);
  const {
    comparison,
    topic,
    results,
    selected,
    setSelected,
    result,
    busy,
    pendingSave,
    answerAgain,
    loadTopic,
  } = usePracticeStore();
  const feedbackTitle = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    feedbackTitle.current?.focus();
  }, [selected, results.length]);

  if (!result) return null;

  return (
    <div className={styles["result-view"]}>
      {results.length === 2 && (
        <>
          <details
            className={`${styles["comparison-view"]} ${styles["feedback-disclosure"]}`}
          >
            <summary>查看两次评分</summary>
            <p>分数仅供参考；是否进步，需要结合两轮原话判断。</p>
            <table>
              <thead>
                <tr>
                  <th scope="col">评估维度</th>
                  <th scope="col">首次</th>
                  <th scope="col">第二次</th>
                  <th scope="col">分数变化</th>
                </tr>
              </thead>
              <tbody>
                {results[0].evaluation.dimensions.map((dimension) => {
                  const second = results[1].evaluation.dimensions.find(
                    (item) => item.name === dimension.name,
                  )!;
                  const change = second.score - dimension.score;
                  return (
                    <tr key={dimension.name}>
                      <th scope="row">{dimension.name}</th>
                      <td>{dimension.score}</td>
                      <td>{second.score}</td>
                      <td>
                        {change > 0
                          ? `+${change}`
                          : change === 0
                            ? "持平"
                            : change}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </details>
          {comparison && (
            <section
              className={styles["answer-comparison"]}
              aria-labelledby="answer-comparison-title"
            >
              <header className={styles["comparison-hero"]}>
                <div>
                  <span className={styles["comparison-eyebrow"]}>
                    ✣ 进化轨迹核心研判
                  </span>
                  <h2
                    id="answer-comparison-title"
                    tabIndex={-1}
                    ref={selected === 1 ? feedbackTitle : undefined}
                  >
                    {comparison.summary}
                  </h2>
                  <p>结合两轮原话，看看表达思路与论证方式发生了哪些变化。</p>
                </div>
              </header>
              <div className={styles["comparison-section-heading"]}>
                <h3>两轮原话并列实录与递进</h3>
                <span>左右对照 · 基于实际回答</span>
              </div>
              <div className={styles["comparison-change-list"]}>
                {comparison.changes.map((change, index) => (
                  <article className={styles["comparison-change"]} key={index}>
                    <div className={styles["comparison-change-heading"]}>
                      <h4>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        {change.dimension}
                      </h4>
                      <span
                        className={`${styles["comparison-status"]} ${styles[`comparison-status-${change.status}`]}`}
                      >
                        {change.status === "improved"
                          ? "有所提升"
                          : change.status === "regressed"
                            ? "仍需加强"
                            : "继续巩固"}
                      </span>
                    </div>
                    <div className={styles["comparison-quotes"]}>
                      <div className={styles["comparison-first"]}>
                        <span>第 1 轮回答</span>
                        <blockquote>“{change.firstQuote}”</blockquote>
                        <small>首次表达</small>
                      </div>
                      <div className={styles["comparison-second"]}>
                        <span>第 2 轮回答</span>
                        <blockquote>“{change.secondQuote}”</blockquote>
                        <small>
                          {change.status === "improved"
                            ? "表达有所推进"
                            : change.status === "regressed"
                              ? "这里仍可打磨"
                              : "保持了原有表达"}
                        </small>
                      </div>
                    </div>
                    <p className={styles["comparison-explanation"]}>
                      <strong>变化点评</strong>
                      {change.explanation}
                    </p>
                  </article>
                ))}
              </div>
              <div className={styles["comparison-action"]}>
                <h3>仍需注意与下一次练习建议</h3>
                <p>
                  {comparison.remainingIssue} {comparison.nextAction}
                </p>
              </div>
            </section>
          )}

          {!comparison && (
            <p>本次没有可核对的原话对比，可切换查看两轮回答与反馈。</p>
          )}
          <div
            className={styles["round-selector"]}
            role="group"
            aria-label="查看作答结果"
          >
            {results.map((item, index) => (
              <button
                key={item.attempt.id}
                type="button"
                aria-pressed={selected === index}
                onClick={() => setSelected(index)}
              >
                {index === 0 ? "首次回答与反馈" : "第二次回答与反馈"}
              </button>
            ))}
          </div>
        </>
      )}
      <section
        className={styles["transcript-view"]}
        aria-labelledby="transcript-title"
      >
        <div className={common["section-title-row"]}>
          <h2 id="transcript-title">
            {results.length === 2
              ? selected === 0
                ? "首次回答"
                : "第二次回答"
              : "你的回答"}
          </h2>
          <span>转写文本 · 只读</span>
        </div>
        <p className={styles["transcript-text"]}>{result.attempt.transcript}</p>
      </section>
      <section
        className={styles["feedback-view"]}
        aria-labelledby="feedback-title"
      >
        <header className={styles["feedback-summary-card"]}>
          <picture className={styles["feedback-avatar-wrap"]}>
            <source
              media="(prefers-reduced-motion: reduce)"
              srcSet="/companion-still.png"
            />
            <img
              className={styles["feedback-avatar"]}
              src="/transcribing-companion.gif"
              alt=""
              width="160"
              height="160"
            />
          </picture>
          <div className={styles["feedback-summary-copy"]}>
            <span className={styles["feedback-summary-label"]}>
              <span aria-hidden="true">♧</span> 复盘总结 ·{" "}
              {selected === 0 && results.length === 2
                ? "首次回答"
                : results.length === 2
                  ? "第二次回答"
                  : "本次练习"}
            </span>
            <h2
              id="feedback-title"
              tabIndex={-1}
              ref={comparison && selected === 1 ? undefined : feedbackTitle}
            >
              {result.evaluation.summary}
            </h2>
            <div className={styles["feedback-companion"]}>
              <p>獭獭陪你看看，哪些地方可以表达得更清楚。</p>
            </div>
          </div>
        </header>
        <section
          className={styles["evidence-feedback"]}
          aria-labelledby="evidence-title"
        >
          <h3 id="evidence-title">从你的原话来看</h3>
          <div className={styles["evidence-list"]}>
            {result.evaluation.evidenceQuotes.map((item, index) => (
              <article
                className={`${styles["evidence-card"]} ${styles[`evidence-${item.kind}`]}`}
                key={`${item.kind}-${index}`}
              >
                <span className={styles["evidence-kind"]}>
                  {item.kind === "strength" ? "表达亮点" : "可以更清楚"}
                </span>
                <blockquote>“{item.text}”</blockquote>
                <p>{item.feedback}</p>
              </article>
            ))}
          </div>
        </section>
        <section className={styles["feedback-action-area"]}>
          <div className={styles["feedback-next-bottom"]}>
            <span className={styles["feedback-next-icon"]} aria-hidden="true">
              ⚑
            </span>
            <div className={styles["feedback-next-content"]}>
              <span className={styles["next-step-label"]}>微习惯提升指引</span>
              <p>
                <strong>下一步行动：</strong>
                {result.evaluation.nextStep}
              </p>
              <div className={styles["feedback-action-buttons"]}>
                {results.length === 1 && (
                  <button
                    className={`${styles["button"]} ${common["button-primary"]}`}
                    type="button"
                    disabled={busy}
                    onClick={answerAgain}
                  >
                    <span aria-hidden="true">♩</span> 同题再答一次
                  </button>
                )}
                <button
                  className={`${styles["button"]} ${results.length === 1 ? common["button-secondary"] : common["button-primary"]}`}
                  type="button"
                  disabled={busy || !!pendingSave}
                  onClick={() => void loadTopic()}
                >
                  <span aria-hidden="true">↻</span> 换一题练习
                </button>
              </div>
            </div>
          </div>
        </section>
        <section
          className={styles["overall-score"]}
          aria-label={`本次总分 ${result.evaluation.overallScore} 分，共 10 分`}
        >
          <div className={styles["overall-score-copy"]}>
            <span>本次练习 · 六个维度</span>
            <h3>本次总分</h3>
            <p>把表达的整体表现，变成下一步练习的起点。</p>
          </div>
          <div className={styles["overall-score-value"]}>
            <strong>{result.evaluation.overallScore}</strong>
            <span>/ 10</span>
          </div>
          <div className={styles["score-track"]} aria-hidden="true">
            <i style={{ width: `${result.evaluation.overallScore * 10}%` }} />
          </div>
        </section>
        <ScoreRadar dimensions={result.evaluation.dimensions} />
        <section
          className={`${styles["feedback-disclosure"]} ${styles["mindmap-disclosure"]}`}
          aria-labelledby="mindmap-title"
        >
          <h3 className={styles["mindmap-disclosure-title"]} id="mindmap-title">
            看看回答思路
          </h3>
          <div className={styles["mindmap-grid"]}>
            <Suspense fallback={<p>正在整理思路…</p>}>
              <MindMap
                title="你的回答与待改进点"
                center={topic?.title ?? "你的回答"}
                nodes={result.evaluation.userMindMap}
                variant="user"
              />
              <MindMap
                title="参考回答思路"
                center="清晰表达的结构"
                nodes={result.evaluation.referenceMindMap}
                variant="reference"
              />
            </Suspense>
          </div>
        </section>
        <details
          open
          className={styles["feedback-disclosure"]}
          key={`dimensions-${result.attempt.id}`}
        >
          <summary>查看六个维度的具体反馈</summary>
          <div className={styles["dimension-list"]}>
            {result.evaluation.dimensions.map((item) => (
              <article className={styles["dimension-row"]} key={item.name}>
                <div className={styles["dimension-top"]}>
                  <h3>{item.name}</h3>
                  <span>
                    {item.score}
                    <small> / 10</small>
                  </span>
                </div>
                <div className={styles["dimension-cards"]}>
                  <section className={`${styles["dimension-card"]} ${styles["dimension-strength"]}`}>
                    <h4>优点</h4>
                    <p>{item.strength}</p>
                  </section>
                  <section className={`${styles["dimension-card"]} ${styles["dimension-weakness"]}`}>
                    <h4>缺点</h4>
                    <p>{item.weakness}</p>
                  </section>
                </div>
              </article>
            ))}
          </div>
        </details>
        <details
          className={styles["feedback-disclosure"]}
          key={`reference-${result.attempt.id}`}
        >
          <summary>读一份参考回答</summary>
          <section className={styles["reference-answer"]}>
            <h3>参考文字答案</h3>
            <div className={styles["reference-answer-body"]}>
              {result.evaluation.referenceAnswer
                .split("\n")
                .map((line, index) => (
                  <p key={index}>{renderHighlightedLine(line)}</p>
                ))}
            </div>
          </section>
          {result.evaluation.expressionMethod?.recommendedStyle && (
            <section className={`${styles["reference-answer"]} ${styles["expression-method"]}`}>
              <h3>换一种方式表达</h3>
              <p className={styles["expression-method-name"]}>推荐风格：{result.evaluation.expressionMethod.recommendedStyle} · 结构：{result.evaluation.expressionMethod.structure}</p>
              <p className={styles["expression-method-suitable"]}>{result.evaluation.expressionMethod.rationale} {result.evaluation.expressionMethod.suitableFor}</p>
              <ol>
                {result.evaluation.expressionMethod.steps.map((step, index) => <li key={index}>{step}</li>)}
              </ol>
              {result.evaluation.expressionMethod.sentenceStarters.length > 0 && (
                <div className={styles["sentence-starters"]}>
                  <h4>可以借用的句式开头</h4>
                  {result.evaluation.expressionMethod.sentenceStarters.map((starter, index) => <p key={index}>“{starter}”</p>)}
                </div>
              )}
              {result.evaluation.expressionMethod.styleExamples.length > 0 && (
                <div className={styles["style-examples"]}>
                  <h4>同一观点，不同表达风格</h4>
                  {(() => {
                    const examples = result.evaluation.expressionMethod.styleExamples;
                    const recommendedIndex = examples.findIndex((example) => example.name === result.evaluation.expressionMethod.recommendedStyle);
                    const activeIndex = selectedStyle !== null && examples[selectedStyle] ? selectedStyle : Math.max(recommendedIndex, 0);
                    return <>
                  <div className={styles["style-tabs"]} role="tablist" aria-label="表达风格示范">
                    {result.evaluation.expressionMethod.styleExamples.map((example, index) => (
                      <button key={example.name} type="button" role="tab" aria-selected={activeIndex === index} onClick={() => setSelectedStyle(index)}>
                        <span className={`${styles["otter-avatar"]} ${styles[["otter-analyst", "otter-storyteller", "otter-workplace", "otter-host"][index]]}`} aria-hidden="true" />
                        {example.name}{example.name === result.evaluation.expressionMethod.recommendedStyle ? " · 推荐" : ""}
                      </button>
                    ))}
                  </div>
                  <p className={styles["style-sample"]} role="tabpanel">{examples[activeIndex].sample}</p>
                    </>;
                  })()}
                </div>
              )}
            </section>
          )}
        </details>
      </section>
    </div>
  );
}
