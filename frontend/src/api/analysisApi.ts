import { getJson } from './client';
import type { AnalysisResponse } from '../types/analysis';

export function fetchAnalysis(
  month: string,
  cutoff: string,
  signal?: AbortSignal,
): Promise<AnalysisResponse> {
  const params = new URLSearchParams({ month, cutoff });
  return getJson<AnalysisResponse>(`/analysis?${params.toString()}`, signal);
}
