export function MicIcon({ recording }: { recording: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      {recording ? <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" /> : <>
        <rect x="9" y="2.5" width="6" height="12" rx="3" />
        <path d="M5.5 10.5a6.5 6.5 0 0 0 13 0M12 17v4M8.5 21h7" strokeLinecap="round" />
      </>}
    </svg>
  );
}

export function RefreshIcon() {
  return <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M16.2 8A6.5 6.5 0 0 0 4.7 5.6L3.4 7M3.5 3.8v3.5H7M3.8 12a6.5 6.5 0 0 0 11.5 2.4l1.3-1.4M16.5 16.2v-3.5H13" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
