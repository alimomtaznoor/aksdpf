import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAnalysis } from './analysisApi';

afterEach(() => vi.unstubAllGlobals());

describe('fetchAnalysis', () => {
  it('encodes month and cutoff as query parameters', async () => {
    const payload = {
      month: '2026-01',
      cutoff: '10:00',
      timezone: 'Europe/London',
      actualIntervals: 744,
      forecastIntervals: 744,
      matchedIntervals: 744,
      coveragePct: 100,
      metrics: { maeMW: 10, rmseMW: 12, biasMW: 1, maxAbsoluteErrorMW: 30 },
      points: [],
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    vi.stubGlobal('fetch', fetchMock);

    await fetchAnalysis('2026-01', '10:00');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/analysis?month=2026-01&cutoff=10%3A00',
      { signal: undefined },
    );
  });

  it('surfaces API error details', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ detail: 'Elexon unavailable' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAnalysis('2026-01', '10:00')).rejects.toThrow('Elexon unavailable');
  });
});
