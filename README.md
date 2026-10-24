# WindLens — Wind Forecast Intelligence

A React + FastAPI dashboard for evaluating UK national wind-generation forecasts against actual generation using Elexon BMRS `FUELHH` and `WINDFOR` data.

> **Important:** WindLens is a decision-support prototype, not a trading system. It uses the two Elexon datasets specified in the assignment. It does not calculate total electricity demand or prescribe a procurement volume.

## Features

- January 2026 national wind-generation actuals and forecast records.
- Day-ahead forecast selection using `publishTime`.
- Configurable decision cutoff, defaulting to 10:00 Europe/London on the day before delivery.
- Forecast-versus-actual time series and MAE, RMSE, bias, and maximum absolute error.
- Daily accuracy summaries and matched hourly data.
- Data-quality metadata and explicit loading, error, and empty states.
- Docker Compose configuration and backend unit tests.

## Architecture

- `frontend/`: React, JSX, Vite, and Recharts.
- `backend/`: FastAPI service, Elexon API client, forecast matching, and accuracy metrics.
- `docker-compose.yml`: local frontend and backend services.

The backend retrieves data from Elexon, so the browser does not need to call the Elexon API directly. Records are normalized and matched by delivery `startTime`.

Actual generation is supplied at half-hourly resolution, while the selected wind forecasts are hourly. WindLens averages the two half-hourly actual readings within each complete hour and compares that hourly average with the corresponding hourly forecast. Incomplete hours are excluded from the hourly actual series.

For each delivery hour, the forecast selected is the latest eligible record published on or before the configured cutoff on the previous UK-local calendar day.

## Requirements

- Python 3.11 or later
- Node.js 20 or later
- Docker and Docker Compose, if using the containerized setup

## Run locally without Docker

### Backend

From the repository root:

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment.

macOS/Linux:

```bash
source .venv/bin/activate
```

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Install dependencies and start the API:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

Open a second terminal from the repository root:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

The frontend development server proxies `/api` requests to `http://localhost:8000`.

## Run with Docker

From the repository root:

```bash
docker compose up --build
```

Open [http://localhost:5173](http://localhost:5173).

To stop the containers, press `Ctrl+C` and run:

```bash
docker compose down
```

## API endpoints

- `GET /api/health` — health check.
- `GET /api/analysis?month=2026-01&cutoff=10:00` — retrieves the data and computes forecast accuracy.
- `GET /api/daily?month=2026-01&cutoff=10:00` — returns daily aggregate metrics.

The `cutoff` parameter uses `HH:MM` in Europe/London local time on the day before each delivery date.

### Data sources

The service requests data from these Elexon BMRS endpoints:

- [FUELHH stream](https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH/stream)
- [WINDFOR stream](https://data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR/stream)

Elexon data is external and may be temporarily unavailable or change schema. The API should report errors clearly rather than silently substituting synthetic data.

## Forecast selection and methodology

- Actual records are filtered to `fuelType == "WIND"`.
- Forecast records are filtered by delivery `startTime` in the requested month.
- For each delivery hour, the latest eligible forecast with `publishTime` no later than the configured cutoff is selected.
- Half-hourly actual generation readings are averaged into hourly values. Only complete hours with two half-hourly readings are included.
- Accuracy metrics include only hours with both an actual and a forecast. Missing intervals are not imputed.
- **MAE** measures mean absolute forecast error in MW.
- **RMSE** measures the square root of mean squared forecast error in MW and gives greater weight to large errors.
- **Bias** is calculated as `forecast - actual`. Positive bias means wind generation was over-forecast on average.
- **Coverage** is the percentage of available hourly actual intervals that have a matched forecast.

The 10:00 cutoff is a product assumption for this pilot. Confirm the operational decision deadline with the intended users before using the dashboard for real decisions.

Wind forecast error alone does not determine electricity procurement requirements. Demand, other generation sources, market rules, and other operational factors are outside the scope of this prototype.

## Tests

From the repository root:

```bash
cd backend
pip install -r requirements.txt
pytest
```

## Deployment

The assignment requires a deployed application. A possible deployment approach is:

1. Deploy `backend/` to a Python-compatible hosting platform.
2. Configure `CORS_ORIGINS` to allow requests from the deployed frontend origin.
3. Deploy `frontend/` to a static hosting platform such as Vercel.
4. Configure `VITE_API_BASE_URL` to point to the deployed backend API, including `/api`, if required by the frontend configuration.
5. Test the deployed application, including API requests, forecast cutoff selection, and displayed metrics.

## Live deployment

- **WindLens dashboard:** https://windlens-sigma.vercel.app/
- **Backend health check:** https://windlens-api.vercel.app/api/health
- **Interactive API documentation:** https://windlens-api.vercel.app/docs

The frontend is deployed on Vercel as a React/Vite application. The backend is deployed separately as a FastAPI service. The frontend uses `VITE_API_BASE_URL` to connect to the backend, and the backend uses `CORS_ORIGINS` to allow requests from the deployed frontend origin.

The backend retrieves national wind-generation actuals and forecasts from Elexon BMRS. Forecast accuracy is evaluated using matched hourly data for January 2026. This prototype supports decision-making but does not calculate total electricity procurement requirements.


## Data attribution

Contains BMRS data © Elexon Limited, copyright and database right.

See the [Elexon BMRS API documentation](https://bmrs.elexon.co.uk/api-documentation/endpoint).
