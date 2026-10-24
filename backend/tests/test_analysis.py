from app.analysis import build_analysis, normalize_forecasts


def test_forecast_selects_latest_before_cutoff():
    forecasts = [
        {"startTime": "2026-01-02T12:00:00Z", "publishTime": "2026-01-01T08:00:00Z", "generation": 100},
        {"startTime": "2026-01-02T12:00:00Z", "publishTime": "2026-01-01T09:00:00Z", "generation": 110},
        {"startTime": "2026-01-02T12:00:00Z", "publishTime": "2026-01-01T11:00:00Z", "generation": 120},
    ]
    result = normalize_forecasts(forecasts, "2026-01", "10:00")
    assert len(result) == 1
    assert list(result.values()) == [110.0]


def test_metrics_and_wind_filter():
    actuals = [
        {"startTime": "2026-01-02T12:00:00Z", "fuelType": "WIND", "generation": 100},
        {"startTime": "2026-01-02T12:30:00Z", "fuelType": "GAS", "generation": 500},
    ]
    forecasts = [
        {"startTime": "2026-01-02T12:00:00Z", "publishTime": "2026-01-01T09:00:00Z", "generation": 110},
    ]
    result = build_analysis(actuals, forecasts)
    assert result["actualIntervals"] == 1
    assert result["matchedIntervals"] == 1
    assert result["metrics"]["maeMW"] == 10.0
    assert result["metrics"]["biasMW"] == 10.0
