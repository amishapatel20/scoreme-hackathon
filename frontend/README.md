# Decision Platform UI (Vite)

This folder contains a React + TypeScript UI for the Decision Platform operations console.

It is intentionally built as a single-page console that calls the platform API endpoints:

- `GET /health`
- `GET /workflows`
- `GET /workflows/:workflowName/config`
- `POST /workflows/:workflowName/requests` (requires `Idempotency-Key`)
- `GET /requests/:requestId`
- `POST /requests/:requestId/retry`
- `GET /requests/:requestId/explanation`
- `GET /analytics/overview`

## Run locally

1) Start an API server

- FastAPI (repo root): `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`
- OR Next.js port (from `web/`): `npm run dev` (default `http://localhost:3000`)

2) Start the UI

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## API proxy target

The Vite dev server proxies API calls to an API server to avoid CORS issues.

- Default target: `http://127.0.0.1:8000`
- Override:

```powershell
$env:VITE_API_PROXY_TARGET = "http://localhost:3000"
npm run dev
```
