import { Activity, AlertTriangle } from 'lucide-react';

export function EmptyState({ message }: { message: string }) {
  return <div className="empty-chart"><Activity size={22} strokeWidth={1.5} /><span>{message}</span></div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="error-banner" role="alert">
      <AlertTriangle size={18} />
      <div><strong>We couldn't load the Elexon data</strong><p>{message}</p></div>
      <button type="button" onClick={onRetry}>Try again</button>
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="loading-panel" role="status" aria-live="polite">
      <div className="loader" />
      <strong>Loading Elexon records</strong>
      <span>Fetching actual generation and forecast publication history…</span>
    </div>
  );
}
