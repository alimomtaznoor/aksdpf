from __future__ import annotations

import os
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from .analysis import build_analysis
from .elexon import get_january_data, ElexonError

app = FastAPI(title="WindLens API", version="1.0.0")

origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if x.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "windlens-api"}


@app.get("/api/analysis")
async def analysis(
    month: str = Query("2026-01", pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    cutoff: str = Query("10:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$"),
):
    try:
        actuals, forecasts = await get_january_data(month)
        result = build_analysis(actuals, forecasts, month, cutoff)
        result["source"] = "Elexon BMRS FUELHH and WINDFOR"
        result["dataStatus"] = "available" if result["matchedIntervals"] else "no-matches"
        return result
    except ElexonError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unexpected error while processing Elexon data.") from exc


@app.get("/api/daily")
async def daily(
    month: str = Query("2026-01", pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    cutoff: str = Query("10:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$"),
):
    try:
        actuals, forecasts = await get_january_data(month)
        result = build_analysis(actuals, forecasts, month, cutoff)
        days: dict[str, list[dict]] = {}
        for point in result["points"]:
            day = point["startTime"][:10]
            days.setdefault(day, []).append(point)
        daily_rows = []
        for day, points in sorted(days.items()):
            errors = [p["errorMW"] for p in points]
            abs_errors = [abs(e) for e in errors]
            daily_rows.append({
                "date": day,
                "matchedIntervals": len(points),
                "maeMW": round(sum(abs_errors) / len(points), 3),
                "biasMW": round(sum(errors) / len(points), 3),
            })
        return {"month": month, "cutoff": cutoff, "days": daily_rows}
    except ElexonError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
