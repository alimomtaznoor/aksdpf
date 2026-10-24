import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { EmptyState } from '../../components/FeedbackStates';
import type { AnalysisPoint, DailyAccuracy } from '../../types/analysis';

const formatNumber = (value: number, digits = 1) => value.toLocaleString('en-GB', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
});

interface ChartPoint extends AnalysisPoint {
  timeLabel: string;
  dayLabel: string;
}

export function ForecastChart({ points, selectedDay }: { points: ChartPoint[]; selectedDay: string }) {
  return (
    <section className="panel forecast-panel">
      <div className="panel-heading">
        <div><h2>Forecast vs actual generation</h2><p>National wind generation · MW</p></div>
        <div className="legend"><span><i className="legend-actual" />Actual</span><span><i className="legend-forecast" />Day-ahead forecast</span></div>
      </div>
      {points.length ? (
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 10, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9edf3" />
              <XAxis dataKey={selectedDay === 'all' ? 'dayLabel' : 'timeLabel'} tick={{ fontSize: 11, fill: '#7b8798' }} tickLine={false} axisLine={false} minTickGap={32} />
              <YAxis tick={{ fontSize: 11, fill: '#7b8798' }} tickLine={false} axisLine={false} width={55} tickFormatter={(value: number) => `${(value / 1000).toFixed(0)}k`} />
             <Tooltip
  contentStyle={{
    borderRadius: 4,
    border: '1px solid #e5eaf1',
    fontSize: 12,
  }}
  labelFormatter={(label) => String(label ?? '')}
  formatter={(value, name) => [
    `${formatNumber(Number(value))} MW`,
    name === 'Actual' ? 'Actual' : 'Forecast',
  ]}
/>
              <Line type="monotone" dataKey="actualMW" name="Actual" stroke="#0f766e" strokeWidth={2} dot={false} connectNulls={false} />
              <Line type="monotone" dataKey="forecastMW" name="Forecast" stroke="#6478e8" strokeWidth={2} dot={false} strokeDasharray="5 4" connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : <EmptyState message="No matched records for this selection." />}
      <div className="chart-foot"><span><i className="foot-dot teal" />Observed generation</span><span><i className="foot-dot purple" />Latest eligible forecast at selected cutoff</span></div>
    </section>
  );
}

export function DailyErrorChart({ daily, accuracyView }: { daily: DailyAccuracy[]; accuracyView: boolean }) {
  return (
    <section className="panel error-panel">
      <div className="panel-heading"><div><h2>{accuracyView ? 'Daily forecast error' : 'Daily error profile'}</h2><p>Mean absolute error by delivery date</p></div><span className="unit-badge">MW</span></div>
      {daily.length ? (
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily} margin={{ top: 10, right: 8, left: 0, bottom: 8 }}>
              <defs><linearGradient id="errorFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b" stopOpacity={0.22} /><stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9edf3" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7b8798' }} tickLine={false} axisLine={false} minTickGap={20} />
              <YAxis tick={{ fontSize: 11, fill: '#7b8798' }} tickLine={false} axisLine={false} width={45} />
              <Tooltip contentStyle={{ borderRadius: 4, border: '1px solid #e5eaf1', fontSize: 12 }} formatter={(value) => [`${formatNumber(Number(value))} MW`, 'Daily MAE']} />
              <Area type="monotone" dataKey="mae" stroke="#d97706" strokeWidth={2} fill="url(#errorFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : <EmptyState message="Daily error profile will appear when records match." />}
      <div className="chart-foot"><span>Each point summarizes matched hourly intervals</span></div>
    </section>
  );
}
