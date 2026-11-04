import { useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { SaveNotice } from '../components/SaveNotice';
import PracticePage from '../pages/practice';
import HistoryPage from '../pages/history';
import { usePracticeStore } from '../stores/practiceStore';

export function AppRouter() {
  const [page, setPage] = useState<'practice' | 'history'>('practice');
  const { busy, pendingSave, error, openingId, openPractice } = usePracticeStore();

  return <AppLayout page={page} onNavigate={setPage}>
    <SaveNotice />
    {page === 'practice' ? <PracticePage /> : <HistoryPage
      onOpen={(id) => { void openPractice(id).then((opened) => { if (opened) setPage('practice'); }); }}
      openingId={openingId}
      detailError={error}
      openDisabled={busy || !!pendingSave}
    />}
  </AppLayout>;
}
