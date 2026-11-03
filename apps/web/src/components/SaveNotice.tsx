import { usePracticeStore } from '../stores/practiceStore';
import styles from './common.module.less';

export function SaveNotice() {
  const { pendingSave, saveError, busy, persist, saving, setPendingSave, setSaveError } = usePracticeStore();
  return <>
    {pendingSave && <div className={styles['error-notice']} role="alert">
      <p>{saveError || '正在保存本地历史…'} 回答与反馈已生成，历史尚未保存。请在离开或刷新页面前重试保存。</p>
      <button className={styles['text-button']} type="button" disabled={busy} onClick={() => void persist(pendingSave)}>{saving ? '保存中…' : '重试保存'}</button>
      <button className={styles['text-button']} type="button" disabled={busy} onClick={() => { setPendingSave(null); setSaveError(''); }}>暂不保存，继续使用</button>
    </div>}
  </>;
}
