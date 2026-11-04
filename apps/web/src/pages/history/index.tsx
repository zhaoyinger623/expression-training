import styles from './history.module.less';
import common from '../../components/common.module.less';
import { useEffect, useState } from 'react';
import type { PracticeSummary } from '@expression/shared';
import { getPracticeHistory } from '../../storage/practiceStorage';

const dateFormat = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' });

export default function HistoryPage({ onOpen, openingId, detailError, openDisabled }: {
  onOpen: (id: string) => void;
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
    <div className={common['section-title-row']}><h1 id="history-title">练习历史</h1><span>保存在此浏览器</span></div>
    {openDisabled && !openingId && <p className={common['status-text']} role="status">可以浏览历史列表。当前练习仍在处理或有待保存的结果，完成后即可打开其他练习；可点击“练习”返回。</p>}
    {(error || detailError) && <div className={styles['error-notice']} role="alert"><p>{error || detailError}</p>
      {error && <button className={common['text-button']} type="button" disabled={loading || !!openingId} onClick={() => void load(items.length)}>重新读取记录</button>}
    </div>}
    {!loading && !error && items.length === 0 && <div className={styles['history-empty']}><h2>还没有练习记录</h2><p>完成一次回答后，论题、回答文本与反馈会自动保存在此浏览器。</p></div>}
    <ul className={styles['history-list']}>{items.map((item) => <li key={item.id}>
      <button type="button" disabled={openDisabled || loading} onClick={() => onOpen(item.id)}>
        <strong>{item.topicTitle}</strong>
        <span><time dateTime={item.updatedAt}>{dateFormat.format(new Date(item.updatedAt))}</time> · {item.attemptCount} 次回答{openingId === item.id ? ' · 正在打开…' : ''}</span>
      </button>
    </li>)}</ul>
    {loading && <p className={common['status-text']} role="status">正在读取练习记录…</p>}
    {!loading && items.length < total && !error && <button className={`${common['button']} ${common['button-secondary']}`} type="button" disabled={!!openingId} onClick={() => void load(items.length)}>加载更多</button>}
  </section>;
}
