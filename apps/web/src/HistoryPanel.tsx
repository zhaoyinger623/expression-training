import { useEffect, useState } from 'react';
import type { PracticeSummary } from '@expression/shared';
import { getPracticeHistory } from './practiceStore';

const dateFormat = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' });

export function HistoryPanel({ onOpen, openingId, detailError }: {
  onOpen: (id: string) => void;
  openingId: string | null;
  detailError: string;
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

  return <section className="history-view" aria-labelledby="history-title">
    <div className="section-title-row"><h1 id="history-title">练习历史</h1><span>保存在此浏览器</span></div>
    {(error || detailError) && <div className="error-notice" role="alert"><p>{error || detailError}</p>
      {error && <button className="text-button" type="button" disabled={loading || !!openingId} onClick={() => void load(items.length)}>重新读取记录</button>}
    </div>}
    {!loading && !error && items.length === 0 && <div className="history-empty"><h2>还没有练习记录</h2><p>完成一次回答后，论题、回答文本与反馈会自动保存在此浏览器。</p></div>}
    <ul className="history-list">{items.map((item) => <li key={item.id}>
      <button type="button" disabled={!!openingId || loading} onClick={() => onOpen(item.id)}>
        <strong>{item.topicTitle}</strong>
        <span><time dateTime={item.updatedAt}>{dateFormat.format(new Date(item.updatedAt))}</time> · {item.attemptCount} 次回答{openingId === item.id ? ' · 正在打开…' : ''}</span>
      </button>
    </li>)}</ul>
    {loading && <p className="status-text" role="status">正在读取练习记录…</p>}
    {!loading && items.length < total && !error && <button className="button button-secondary" type="button" disabled={!!openingId} onClick={() => void load(items.length)}>加载更多</button>}
  </section>;
}
