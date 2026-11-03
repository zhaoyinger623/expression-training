import type { ReactNode } from 'react';
import styles from './appLayout.module.less';

export function AppLayout({ children, page, disabled, onNavigate }: {
  children: ReactNode;
  page: 'practice' | 'history';
  disabled: boolean;
  onNavigate: (page: 'practice' | 'history') => void;
}) {
  return (
    <div className={styles['app-shell']}>
      <header className={styles['site-header']}><a className={styles['site-name']} href="#main" aria-label="獭獭说">
          <span className={styles['name-letters']} aria-hidden="true"><span>獭</span><span>獭</span><span>说</span></span>
        </a>
        <nav className={styles['header-actions']} aria-label="练习导航">
          <button type="button" disabled={disabled} aria-pressed={page === 'practice'} onClick={() => onNavigate('practice')}>练习</button>
          <button type="button" disabled={disabled} aria-pressed={page === 'history'} onClick={() => onNavigate('history')}>历史记录</button>
        </nav>
      </header>
      <main id="main" className={styles['main-content']}>
        {children}
      </main>
      <footer className={styles['site-footer']}><span>獭獭说 · 把想法说得更清楚</span><span>练习，从下一句话开始。</span></footer>
    </div>
  );
}
