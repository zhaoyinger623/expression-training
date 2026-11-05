import styles from './history.module.less';
import common from '../../components/common.module.less';
import { useEffect, useState } from 'react';
import type { PracticeSummary } from '@expression/shared';
import { getPracticeHistory } from '../../storage/practiceStorage';

const dateFormat = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' });

const durationLabel = (seconds: number) => {
  const roundedSeconds = Math.round(seconds);
  return `${Math.floor(roundedSeconds / 60)} 分 ${roundedSeconds % 60} 秒`;
};

export default function HistoryPage({ onOpen, onContinue, openingId, detailError, openDisabled }: {
  onOpen: (id: string) => void;
  onContinue: (id: string) => void;
  openingId: string | null;
  detailError: string;
  openDisabled: boolean;
}) {
  const [items, setItems] = useState<PracticeSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(offset = 0) {
    setLoading(true);
    setError('');
    try {
      const response = await getPracticeHistory(offset);
      setItems((previous) => offset === 0 ? response.items : [...previous, ...response.items]);
      setTotal(response.total);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '读取历史记录失败，请重试。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, []);

  return <section className={styles['history-view']} aria-labelledby="history-title">
    <div className={common['section-title-row']}><h1 id="history-title">练习历史</h1></div>
    {openDisabled && !openingId && <p className={common['status-text']} role="status">可以浏览历史列表。当前练习仍在处理或有待保存的结果，完成后即可打开其他练习；可点击“练习”返回。</p>}
    {(error || detailError) && <div className={styles['error-notice']} role="alert"><p>{error || detailError}</p>
      {error && <button className={common['text-button']} type="button" disabled={loading || !!openingId} onClick={() => void load(items.length)}>重新读取记录</button>}
    </div>}
    {!loading && !error && items.length === 0 && <div className={styles['history-empty']}><h2>还没有练习记录</h2><p>完成一次回答后，论题、回答文本与反馈会自动保存在此浏览器。</p></div>}
    <ul className={styles['history-list']}>{items.map((item) => <li className={styles['history-card']} key={item.id}>
      <div className={styles['history-card-copy']}>
        <div className={styles['history-meta']}><span className={item.attemptCount === 2 ? styles['history-complete'] : styles['history-in-progress']}>{item.attemptCount === 2 ? '✓ 已完成 2 轮练习 · 含变化对比' : '◷ 第 1 轮已完成 · 建议继续第 2 轮'}</span><span><time dateTime={item.updatedAt}>{dateFormat.format(new Date(item.updatedAt))}</time> · 累计用时 {durationLabel(item.totalDurationSeconds)}</span></div>
        <button className={styles['history-title']} type="button" disabled={openDisabled || loading} onClick={() => onOpen(item.id)}>{item.topicTitle}</button>
        {item.attemptCount === 2 ? <div className={styles['history-insights']}>
          {item.scoreChange !== null && <span>◖ 总分变化 {item.scoreChange > 0 ? '+' : ''}{item.scoreChange} 分</span>}
          {item.improvedDimensions > 0 && <span>◇ {item.improvedDimensions} 个维度有提升</span>}
          <span>◎ 逻辑复盘完成</span>
        </div> : <p className={styles['history-transcript']}>“{item.firstTranscript}”</p>}
      </div>
      <button className={item.attemptCount === 2 ? styles['history-open-action'] : styles['history-continue-action']} type="button" disabled={openDisabled || loading} onClick={() => item.attemptCount === 2 ? onOpen(item.id) : onContinue(item.id)}>{openingId === item.id ? '正在打开…' : item.attemptCount === 2 ? '查看反馈与对比 →' : '🎙 继续第 2 轮练习'}</button>
    </li>)}</ul>
    {loading && <p className={common['status-text']} role="status">正在读取练习记录…</p>}
    {!loading && items.length < total && !error && <button className={`${common['button']} ${common['button-secondary']}`} type="button" disabled={!!openingId} onClick={() => void load(items.length)}>加载更多</button>}
  </section>;
}
