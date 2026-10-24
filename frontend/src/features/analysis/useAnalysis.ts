import { useCallback, useEffect, useState } from 'react';
import { fetchAnalysis } from '../../api/analysisApi';
import type { AnalysisResponse } from '../../types/analysis';

interface AnalysisState {
  data: AnalysisResponse | null;
  loading: boolean;
  error: string;
}

export function useAnalysis(month: string, cutoff: string) {
  const [state, setState] = useState<AnalysisState>({
    data: null,
    loading: false,
    error: '',
  });
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: '' }));

    fetchAnalysis(month, cutoff, controller.signal)
      .then((data) => setState({ data, loading: false, error: '' }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : 'An unexpected error occurred';
        setState({ data: null, loading: false, error: `${message}. Check that the API is running and Elexon is reachable.` });
      });

    return () => controller.abort();
  }, [month, cutoff, reloadKey]);

  return { ...state, refresh };
}
