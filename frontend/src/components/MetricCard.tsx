import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  detail: string;
  icon: LucideIcon;
  tone?: 'blue' | 'purple' | 'amber' | 'green';
}

export function MetricCard({ label, value, unit = '', detail, icon: Icon, tone = 'blue' }: MetricCardProps) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`} aria-hidden="true"><Icon size={17} strokeWidth={1.8} /></div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}<span>{unit}</span></div>
      <div className="metric-detail" title={detail}>{detail}</div>
    </article>
  );
}
