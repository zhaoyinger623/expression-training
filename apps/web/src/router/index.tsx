import { useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { SaveNotice } from '../components/SaveNotice';
import PracticePage from '../pages/practice';
import HistoryPage from '../pages/history';
import { usePracticeStore } from '../stores/practiceStore';

export function AppRouter() {
  const [page, setPage] = useState<'practice' | 'history'>('practice');
  const { busy, pendingSave, setError, error, openingId, openPractice } = usePracticeStore();

  return <AppLayout page={page} disabled={busy || !!pendingSave} onNavigate={(next) => { setError(''); setPage(next); }}>
    <SaveNotice />
    {page === 'practice' ? <PracticePage /> : <HistoryPage
      onOpen={(id) => { void openPractice(id).then((opened) => { if (opened) setPage('practice'); }); }}
      openingId={openingId}
      detailError={error}
    />}
  </AppLayout>;
}
