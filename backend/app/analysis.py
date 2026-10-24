
from __future__ import annotations

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo
from typing import Any
from collections import defaultdict
import math

UK = ZoneInfo("Europe/London")


def _parse_datetime(value: Any) -> datetime | None:
    if value is None:
        return None

    try:
        text = str(value).strip()
        if not text:
            return None

        if text.endswith("Z"):
            text = text[:-1] + "+00:00"

        dt = datetime.fromisoformat(text)

        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UK)

        return dt
    except (ValueError, TypeError):
        return None


def _number(value: Any) -> float | None:
    try:
        if value is None or str(value).strip().lower() in {
            "",
            "null",
            "none",
            "nan",
        }:
            return None

        result = float(value)

        if not math.isfinite(result):
            return None

        return result
    except (ValueError, TypeError):
        return None


def normalize_actuals(
    records: list[dict[str, Any]],
    month: str,
) -> dict[str, float]:
    """Normalize wind actuals into UK-local timestamp keys."""
    result: dict[str, float] = {}

    for row in records:
        if str(row.get("fuelType", "")).upper() != "WIND":
            continue

        start = _parse_datetime(row.get("startTime"))
        generation = _number(row.get("generation"))

        if start is None or generation is None:
            continue

        start_uk = start.astimezone(UK)

        if start_uk.strftime("%Y-%m") != month:
            continue

        key = start_uk.isoformat(timespec="minutes")
        result[key] = generation

    return result


def hourly_average_actuals(
    actuals: dict[str, float],
) -> dict[str, float]:
    """
    Convert half-hourly actuals to hourly averages.

    Only retain hours with exactly two half-hourly readings,
    so incomplete hours do not distort the comparison.
    """
    buckets: dict[str, list[float]] = defaultdict(list)

    for timestamp, value in actuals.items():
        dt = _parse_datetime(timestamp)

        if dt is None:
            continue

        dt_uk = dt.astimezone(UK)
        hour = dt_uk.replace(
            minute=0,
            second=0,
            microsecond=0,
        )
        key = hour.isoformat(timespec="minutes")
        buckets[key].append(value)

    return {
        key: sum(values) / 2
        for key, values in buckets.items()
        if len(values) == 2
    }


def normalize_forecasts(
    records: list[dict[str, Any]],
    month: str,
    cutoff: str,
) -> dict[str, float]:
    """
    For each delivery hour, select the latest forecast published
    by the specified cutoff on the previous UK-local calendar day.
    """
    try:
        hh, mm = map(int, cutoff.split(":"))
        cutoff_time = time(hh, mm)
    except (ValueError, TypeError) as exc:
        raise ValueError(
            "cutoff must be HH:MM, for example 10:00"
        ) from exc

    if hh not in range(24) or mm not in range(60):
        raise ValueError(
            "cutoff must be a valid time in HH:MM format"
        )

    # delivery-hour key -> (publication time, forecast MW)
    selected: dict[str, tuple[datetime, float]] = {}

    for row in records:
        start = _parse_datetime(row.get("startTime"))
        published = _parse_datetime(row.get("publishTime"))
        generation = _number(row.get("generation"))

        if start is None or published is None or generation is None:
            continue

        start_uk = start.astimezone(UK)
        publish_uk = published.astimezone(UK)

        if start_uk.strftime("%Y-%m") != month:
            continue

        decision_cutoff = datetime.combine(
            start_uk.date() - timedelta(days=1),
            cutoff_time,
            tzinfo=UK,
        )

        if publish_uk > decision_cutoff:
            continue

        key = start_uk.isoformat(timespec="minutes")
        current = selected.get(key)

        if current is None or publish_uk > current[0]:
            selected[key] = (publish_uk, generation)

    return {
        key: forecast
        for key, (_, forecast) in selected.items()
    }


def build_analysis(
    actual_records: list[dict[str, Any]],
    forecast_records: list[dict[str, Any]],
    month: str = "2026-01",
    cutoff: str = "10:00",
) -> dict[str, Any]:
    """
    Build hourly wind forecast accuracy metrics.

    Actuals are averaged from two half-hourly readings per hour.
    Each hourly average is compared with the selected hourly forecast.
    Error is defined as forecast MW minus actual MW.
    """
    half_hourly_actuals = normalize_actuals(actual_records, month)
    actuals = hourly_average_actuals(half_hourly_actuals)
    forecasts = normalize_forecasts(
        forecast_records,
        month,
        cutoff,
    )

    common = sorted(set(actuals) & set(forecasts))
    points: list[dict[str, Any]] = []

    for key in common:
        actual = actuals[key]
        forecast = forecasts[key]
        error = forecast - actual

        points.append(
            {
                "startTime": key,
                "actualMW": round(actual, 3),
                "forecastMW": round(forecast, 3),
                "errorMW": round(error, 3),
                "absoluteErrorMW": round(abs(error), 3),
            }
        )

    if points:
        errors = [point["errorMW"] for point in points]
        absolute_errors = [abs(error) for error in errors]

        mae = sum(absolute_errors) / len(errors)
        rmse = math.sqrt(
            sum(error**2 for error in errors) / len(errors)
        )
        bias = sum(errors) / len(errors)
        max_absolute_error = max(absolute_errors)

        metrics = {
            "maeMW": round(mae, 3),
            "rmseMW": round(rmse, 3),
            "biasMW": round(bias, 3),
            "maxAbsoluteErrorMW": round(max_absolute_error, 3),
        }
    else:
        metrics = {
            "maeMW": None,
            "rmseMW": None,
            "biasMW": None,
            "maxAbsoluteErrorMW": None,
        }

    return {
        "month": month,
        "cutoff": cutoff,
        "timezone": "Europe/London",
        "actualIntervals": len(actuals),
        "forecastIntervals": len(forecasts),
        "matchedIntervals": len(points),
        "coveragePct": (
            round(100 * len(points) / len(actuals), 1)
            if actuals
            else 0
        ),
        "metrics": metrics,
        "points": points,
    }
