import { useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays,
  CheckCircle2, ChevronDown, Clock3, Download, ExternalLink, Gauge,
  RefreshCw, Wind, Zap,
} from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { EmptyState, ErrorState, LoadingState } from '../components/FeedbackStates';
import { DailyErrorChart, ForecastChart } from '../features/analysis/ForecastCharts';
import { useAnalysis } from '../features/analysis/useAnalysis';
import type { AnalysisPoint, DailyAccuracy, DashboardTab } from '../types/analysis';

const formatNumber = (value: number | null | undefined, digits = 0) =>
  value == null || !Number.isFinite(Number(value))
    ? '—'
    : Number(value).toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits });
const compactMW = (value: number) => `${formatNumber(value, 1)} MW`;

function exportCsv(points: AnalysisPoint[], month: string) {
  const rows = [
    ['startTime', 'actualMW', 'forecastMW', 'errorMW', 'absoluteErrorMW'],
    ...points.map((point) => [point.startTime, point.actualMW, point.forecastMW, point.errorMW, point.absoluteErrorMW]),
  ];
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `windlens-${month}-hourly-data.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function AppSidebar({ tab, onTabChange }: { tab: DashboardTab; onTabChange: (tab: DashboardTab) => void }) {
  return (
    <aside className="sidebar">
      <a className="brand" href="#main" aria-label="WindLens home">
        <span className="brand-mark"><Wind size={20} strokeWidth={1.7} /></span>
        <span><strong>windlens</strong><small>FORECAST INTELLIGENCE</small></span>
      </a>
      <div className="nav-label">WORKSPACE</div>
      <button className={`nav-item ${tab === 'overview' ? 'active' : ''}`} onClick={() => onTabChange('overview')}><Gauge size={17} />Overview</button>
      <button className={`nav-item ${tab === 'accuracy' ? 'active' : ''}`} onClick={() => onTabChange('accuracy')}><Activity size={17} />Forecast accuracy</button>
      <button className={`nav-item ${tab === 'intervals' ? 'active' : ''}`} onClick={() => onTabChange('intervals')}><CalendarDays size={17} />Hourly intervals</button>
      <div className="sidebar-bottom">
        <div className="source-card">
          <div className="source-top"><span className="live-dot" />DATA SOURCE</div>
          <strong>Elexon BMRS</strong>
          <p>National wind generation · FUELHH + WINDFOR</p>
          <a href="https://bmrs.elexon.co.uk/api-documentation/endpoint" target="_blank" rel="noreferrer">API documentation <ExternalLink size={12} /></a>
        </div>
        <div className="sidebar-footer">Pilot analytics · v1.0</div>
      </div>
    </aside>
  );
}

function AnalysisControls({ month, cutoff, onMonthChange, onCutoffChange, onRefresh, loading }: {
  month: string;
  cutoff: string;
  onMonthChange: (value: string) => void;
  onCutoffChange: (value: string) => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  return (
    <section className="control-panel" aria-labelledby="analysis-settings-title">
      <div className="control-title"><span className="control-title-icon"><CalendarDays size={16} /></span><div><strong id="analysis-settings-title">Analysis settings</strong><span>Choose the delivery month and decision cutoff</span></div></div>
      <div className="controls">
        <label>DELIVERY MONTH<div className="select-wrap"><CalendarDays size={15} /><input type="month" value={month} onChange={(event) => onMonthChange(event.target.value)} min="2020-01" max="2026-12" /></div></label>
        <label>DAY-AHEAD CUTOFF<div className="select-wrap"><Clock3 size={15} /><select value={cutoff} onChange={(event) => onCutoffChange(event.target.value)}><option value="08:00">08:00 UK time</option><option value="09:00">09:00 UK time</option><option value="10:00">10:00 UK time</option><option value="11:00">11:00 UK time</option><option value="12:00">12:00 UK time</option></select><ChevronDown size={14} /></div></label>
        <button className="btn btn-dark" type="button" onClick={onRefresh} disabled={loading}><RefreshCw size={14} className={loading ? 'spin' : ''} />Refresh analysis</button>
      </div>
      <div className="assumption-note"><AlertTriangle size={14} />Cutoff is a configurable pilot assumption. Confirm the actual decision time with the trading team before operational use.</div>
    </section>
  );
}

function DailyTable({ rows }: { rows: DailyAccuracy[] }) {
  return (
    <section className="panel table-panel">
      <div className="panel-heading"><div><h2>Daily accuracy</h2><p>Hourly forecast errors grouped by delivery date</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>Delivery date</th><th>Matched hours</th><th>MAE</th><th>Bias</th></tr></thead><tbody>
        {rows.map((row) => <tr key={row.date}><td>{row.date}</td><td>{formatNumber(row.intervals)}</td><td>{formatNumber(row.mae, 1)} MW</td><td className={row.bias > 0 ? 'negative' : 'positive'}>{row.bias > 0 ? '+' : ''}{formatNumber(row.bias, 1)} MW</td></tr>)}
      </tbody></table>{!rows.length && <EmptyState message="Daily metrics will appear when matched data is available." />}</div>
    </section>
  );
}

function IntervalTable({ points, days, selectedDay, search, onDayChange, onSearchChange }: {
  points: AnalysisPoint[];
  days: string[];
  selectedDay: string;
  search: string;
  onDayChange: (value: string) => void;
  onSearchChange: (value: string) => void;
}) {
  const visiblePoints = points.slice(0, 300);
  return (
    <section className="panel table-panel">
      <div className="panel-heading"><div><h2>Matched hourly intervals</h2><p>Only hours with both an eligible forecast and an actual value are included.</p></div><div className="table-tools"><input aria-label="Search timestamp" placeholder="Search timestamp…" value={search} onChange={(event) => onSearchChange(event.target.value)} /><select aria-label="Filter by delivery date" value={selectedDay} onChange={(event) => onDayChange(event.target.value)}><option value="all">All dates</option>{days.map((day) => <option key={day} value={day}>{day}</option>)}</select></div></div>
      <div className="table-scroll"><table><thead><tr><th>Delivery time (UK)</th><th>Actual</th><th>Forecast</th><th>Error</th><th>Abs. error</th></tr></thead><tbody>
        {visiblePoints.map((point) => <tr key={point.startTime}><td>{point.startTime.replace('T', ' ').slice(0, 16)}</td><td>{formatNumber(point.actualMW, 1)} MW</td><td>{formatNumber(point.forecastMW, 1)} MW</td><td className={point.errorMW > 0 ? 'negative' : 'positive'}>{point.errorMW > 0 ? '+' : ''}{formatNumber(point.errorMW, 1)} MW</td><td>{formatNumber(point.absoluteErrorMW, 1)} MW</td></tr>)}
      </tbody></table>{points.length > 300 && <div className="table-note">Showing the first 300 of {formatNumber(points.length)} filtered intervals. Export the CSV for the full dataset.</div>}{!points.length && <EmptyState message="No intervals match the current filters." />}</div>
    </section>
  );
}

export default function DashboardPage() {
  const [month, setMonth] = useState('2026-01');
  const [cutoff, setCutoff] = useState('10:00');
  const [tab, setTab] = useState<DashboardTab>('overview');
  const [selectedDay, setSelectedDay] = useState('all');
  const [search, setSearch] = useState('');
  const { data, loading, error, refresh } = useAnalysis(month, cutoff);

  const points = data?.points ?? [];
  const days = useMemo(() => [...new Set(points.map((point) => point.startTime.slice(0, 10)))], [points]);
  const filteredPoints = useMemo(() => points.filter((point) =>
    (selectedDay === 'all' || point.startTime.slice(0, 10) === selectedDay) &&
    (!search || point.startTime.includes(search)),
  ), [points, selectedDay, search]);
  const chartPoints = useMemo(() => filteredPoints.map((point) => ({
    ...point,
    timeLabel: `${point.startTime.slice(8, 10)} ${point.startTime.slice(11, 16)}`,
    dayLabel: point.startTime.slice(5, 10),
  })), [filteredPoints]);
  const daily = useMemo<DailyAccuracy[]>(() => {
    const grouped = new Map<string, AnalysisPoint[]>();
    for (const point of points) {
      const date = point.startTime.slice(0, 10);
      const rows = grouped.get(date) ?? [];
      rows.push(point);
      grouped.set(date, rows);
    }
    return [...grouped.entries()].map(([date, rows]) => {
      const errors = rows.map((row) => row.errorMW);
      return {
        date,
        label: date.slice(5),
        intervals: rows.length,
        mae: errors.reduce((sum, value) => sum + Math.abs(value), 0) / rows.length,
        bias: errors.reduce((sum, value) => sum + value, 0) / rows.length,
      };
    });
  }, [points]);

  const metrics = data?.metrics;
  const positiveBias = (metrics?.biasMW ?? 0) > 0;
  const largest = points.length ? points.reduce((current, point) => Math.abs(point.errorMW) > Math.abs(current.errorMW) ? point : current) : null;

  return (
    <div className="app-shell">
      <AppSidebar tab={tab} onTabChange={setTab} />
      <main className="main-content" id="main">
        <header className="topbar"><div className="breadcrumb">Energy intelligence <span>/</span> Wind forecast</div><div className="top-actions"><span className="environment"><span className="live-dot" />Pilot environment</span><div className="avatar" aria-label="WindLens">WL</div></div></header>
        <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" />UK POWER MARKET · DAY-AHEAD</div><h1>Wind forecast intelligence</h1><p>Understand forecast performance before the delivery day.</p></div><div className="heading-actions"><button className="btn btn-secondary" type="button" onClick={() => exportCsv(filteredPoints, month)} disabled={!points.length}><Download size={15} />Export data</button><button className="btn btn-primary" type="button" onClick={refresh} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''} />{loading ? 'Refreshing' : 'Refresh data'}</button></div></section>
        <AnalysisControls month={month} cutoff={cutoff} onMonthChange={(value) => { setMonth(value); setSelectedDay('all'); }} onCutoffChange={setCutoff} onRefresh={refresh} loading={loading} />

        {error && <ErrorState message={error} onRetry={refresh} />}
        {loading && !data && <LoadingState />}

        {data && <>
          <div className="status-row"><div className="status-left"><span className={data.matchedIntervals ? 'status-pill good' : 'status-pill warning'}>{data.matchedIntervals ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}{data.matchedIntervals ? 'Analysis ready' : 'No matched intervals'}</span><span className="status-copy">{month} · National wind · Hourly resolution</span></div><span className="updated"><span className="live-dot" />Source: {data.source || 'Elexon BMRS'}</span></div>
          <div className="metrics-grid">
            <MetricCard label="Mean absolute error" value={formatNumber(metrics?.maeMW, 1)} unit="MW" detail="Typical absolute forecast miss" icon={Activity} tone="blue" />
            <MetricCard label="Root mean square error" value={formatNumber(metrics?.rmseMW, 1)} unit="MW" detail="Penalizes larger errors" icon={Gauge} tone="purple" />
            <MetricCard label="Forecast bias" value={metrics?.biasMW == null ? '—' : `${metrics.biasMW > 0 ? '+' : ''}${formatNumber(metrics.biasMW, 1)}`} unit={metrics?.biasMW == null ? '' : 'MW'} detail={metrics?.biasMW == null ? 'No matched data' : positiveBias ? 'Tends to over-forecast wind' : metrics.biasMW < 0 ? 'Tends to under-forecast wind' : 'No average directional bias'} icon={positiveBias ? ArrowUpRight : ArrowDownRight} tone="amber" />
            <MetricCard label="Matched intervals" value={formatNumber(data.matchedIntervals)} detail={`${formatNumber(data.coveragePct, 1)}% of hourly actuals matched`} icon={CheckCircle2} tone="green" />
          </div>

          <nav className="tab-row" aria-label="Analysis views"><button className={tab === 'overview' ? 'selected' : ''} onClick={() => setTab('overview')}>Overview</button><button className={tab === 'accuracy' ? 'selected' : ''} onClick={() => setTab('accuracy')}>Accuracy analysis</button><button className={tab === 'intervals' ? 'selected' : ''} onClick={() => setTab('intervals')}>Hourly data</button></nav>

          {tab !== 'intervals' && <div className="charts-grid"><ForecastChart points={chartPoints} selectedDay={selectedDay} /><DailyErrorChart daily={daily} accuracyView={tab === 'accuracy'} /></div>}
          {tab === 'accuracy' && <section className="panel detail-panel"><div className="panel-heading"><div><h2>Interpreting the metrics</h2><p>What each measure tells you about forecast performance.</p></div></div><div className="interpret-grid"><div><strong>MAE</strong><p>The average absolute difference between forecast and actual generation. It describes a typical miss without direction.</p></div><div><strong>RMSE</strong><p>Like MAE, but larger errors count more heavily. A higher RMSE relative to MAE can indicate occasional large misses.</p></div><div><strong>Bias</strong><p>Forecast minus actual. Positive values indicate average over-forecasting; negative values indicate average under-forecasting.</p></div></div></section>}
          {tab === 'accuracy' && <DailyTable rows={daily} />}
          {tab === 'intervals' && <IntervalTable points={filteredPoints} days={days} selectedDay={selectedDay} search={search} onDayChange={setSelectedDay} onSearchChange={setSearch} />}
          {tab !== 'intervals' && <section className="panel table-panel compact-table"><div className="panel-heading"><div><h2>Largest forecast miss</h2><p>The hour with the largest absolute error</p></div><span className="unit-badge">TOP ERROR</span></div>{largest ? <div className="largest-error"><div className="largest-number">{compactMW(largest.absoluteErrorMW)}</div><div className="largest-details"><strong>{new Date(largest.startTime).toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short' })} UK time</strong><span>Forecast {formatNumber(largest.forecastMW, 1)} MW · Actual {formatNumber(largest.actualMW, 1)} MW</span></div><button className="btn btn-secondary" onClick={() => { setTab('intervals'); setSelectedDay(largest.startTime.slice(0, 10)); setSearch(''); }}>View interval <ArrowDownRight size={14} /></button></div> : <EmptyState message="Largest error will appear when matched data is available." />}</section>}
          <div className="method-note"><div className="method-icon"><Zap size={17} /></div><div><strong>Methodology & interpretation</strong><p>Half-hourly actual readings are averaged into hourly values to match the hourly forecast resolution. For each delivery hour, WindLens selects the latest forecast published by {cutoff} UK time on the previous day. MAE and RMSE are in MW; bias is forecast minus actual. Wind-only results do not calculate total procurement need.</p><div className="method-meta"><span><CheckCircle2 size={13} />{formatNumber(data.actualIntervals)} hourly actual intervals</span><span><CheckCircle2 size={13} />{formatNumber(data.forecastIntervals)} eligible forecast intervals</span><span><Clock3 size={13} />Cutoff: {cutoff} Europe/London</span></div></div></div>
        </>}
        <footer className="page-footer"><span>WindLens · Energy decision support</span><span>Data: Elexon BMRS · FUELHH / WINDFOR</span></footer>
      </main>
    </div>
  );
}
