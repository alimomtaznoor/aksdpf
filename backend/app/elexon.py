
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import httpx

BASE = "https://data.elexon.co.uk/bmrs/api/v1"


class ElexonError(RuntimeError):
    pass


def _parse_records(data: object, dataset: str) -> list[dict]:
    """Normalize Elexon JSON responses into a list of records."""
    if isinstance(data, dict):
        data = data.get(
            "data",
            data.get("results", data.get("items", [])),
        )

    if not isinstance(data, list):
        raise ElexonError(
            f"Unexpected response format from Elexon {dataset} endpoint."
        )

    return [row for row in data if isinstance(row, dict)]


async def _get(
    dataset: str,
    params: dict[str, str],
) -> list[dict]:
    """Request records from an Elexon stream endpoint."""
    url = f"{BASE}/datasets/{dataset}/stream"

    try:
        async with httpx.AsyncClient(
            timeout=60.0,
            headers={"Accept": "application/json"},
        ) as client:
            response = await client.get(url, params=params)

            if response.is_error:
                raise ElexonError(
                    f"Elexon {dataset} request failed "
                    f"({response.status_code}): {response.text[:1000]}"
                )

            data = response.json()

    except httpx.HTTPError as exc:
        raise ElexonError(
            f"Could not retrieve {dataset} data from Elexon: {exc}"
        ) from exc
    except ValueError as exc:
        raise ElexonError(
            f"Elexon returned invalid JSON for {dataset}."
        ) from exc

    return _parse_records(data, dataset)


async def _get_actuals(
    start_date: str,
    end_date: str,
) -> list[dict]:
    """Fetch half-hourly wind actuals for the selected settlement dates."""
    records = await _get(
        "FUELHH",
        {
            "settlementDateFrom": start_date,
            "settlementDateTo": end_date,
            "fuelType": "WIND",
        },
    )

    # Filter locally as well, so boundary records outside the requested
    # month cannot accidentally enter the analysis.
    return [
        row
        for row in records
        if row.get("fuelType") == "WIND"
        and start_date <= str(row.get("settlementDate", "")) < end_date
    ]


async def _get_forecasts(
    start: str,
    end: str,
) -> list[dict]:
    """Fetch wind forecast records by their publication-time window."""
    start_dt = datetime.fromisoformat(start.replace("Z", "+00:00"))
    end_dt = datetime.fromisoformat(end.replace("Z", "+00:00"))

    # Include the day before the selected month so forecasts published
    # before the first delivery day can be considered.
    publish_start = (
        start_dt - timedelta(days=1)
    ).isoformat(timespec="seconds").replace("+00:00", "Z")

    records = await _get(
        "WINDFOR",
        {
            "publishDateTimeFrom": publish_start,
            "publishDateTimeTo": end,
        },
    )

    # Keep forecasts whose delivery timestamps fall inside the selected
    # month. Keep publication timestamps for cutoff selection downstream.
    return [
        row
        for row in records
        if row.get("startTime")
        and start <= str(row["startTime"]) < end
        and row.get("publishTime")
    ]


async def get_january_data(
    month: str,
) -> tuple[list[dict], list[dict]]:
    """Return actuals and forecasts for a selected YYYY-MM month."""
    try:
        year, mon = map(int, month.split("-"))

        if not 1 <= mon <= 12:
            raise ValueError

        start_dt = datetime(year, mon, 1, tzinfo=timezone.utc)

        if mon == 12:
            end_dt = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end_dt = datetime(year, mon + 1, 1, tzinfo=timezone.utc)

    except (ValueError, TypeError) as exc:
        raise ValueError("month must use YYYY-MM format") from exc

    start_date = start_dt.strftime("%Y-%m-%d")
    end_date = end_dt.strftime("%Y-%m-%d")

    start = start_dt.isoformat(timespec="seconds").replace("+00:00", "Z")
    end = end_dt.isoformat(timespec="seconds").replace("+00:00", "Z")

    actuals = await _get_actuals(start_date, end_date)
    forecasts = await _get_forecasts(start, end)

    print(f"FUELHH wind actual records: {len(actuals)}")
    print(f"WINDFOR forecast records: {len(forecasts)}")
    forecast_times = sorted({
    row.get("startTime")
    for row in forecasts
    if row.get("startTime")
})

    print("FIRST 10 FORECAST TIMES:", forecast_times[:10])

    return actuals, forecasts
