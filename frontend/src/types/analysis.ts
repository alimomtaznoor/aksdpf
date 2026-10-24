export interface AnalysisPoint {
  startTime: string;
  actualMW: number;
  forecastMW: number;
  errorMW: number;
  absoluteErrorMW: number;
}

export interface AnalysisMetrics {
  maeMW: number | null;
  rmseMW: number | null;
  biasMW: number | null;
  maxAbsoluteErrorMW: number | null;
}

export interface AnalysisResponse {
  month: string;
  cutoff: string;
  timezone: string;
  actualIntervals: number;
  forecastIntervals: number;
  matchedIntervals: number;
  coveragePct: number;
  metrics: AnalysisMetrics;
  points: AnalysisPoint[];
  source?: string;
}

export interface DailyAccuracy {
  date: string;
  label: string;
  intervals: number;
  mae: number;
  bias: number;
}

export type DashboardTab = 'overview' | 'accuracy' | 'intervals';
