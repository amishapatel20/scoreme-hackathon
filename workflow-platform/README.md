# Configurable Workflow Decision Platform

Production-ready, YAML-driven workflow decisioning platform with explainable rules, full audit trails, admin controls, and a modern React operations UI.

## Feature Checklist

- [x] FastAPI backend with Swagger/OpenAPI at `/docs`
- [x] SQLite + SQLAlchemy ORM (PostgreSQL swap-ready via `DATABASE_URL`)
- [x] YAML workflow/rule configs (5 built-in workflows)
- [x] Request intake with idempotency (`X-Idempotent: true` for duplicates)
- [x] Workflow engine with stage routing and rule evaluation
- [x] External dependency simulation with configurable failure rate
- [x] Exponential backoff retry handling
- [x] Full audit trail and state history per request
- [x] Admin queue, retry, override, and metrics APIs
- [x] React + TypeScript + Tailwind + Zustand + Recharts frontend
- [x] Embedded context-aware chatbot widget (mocked LLM engine)
- [x] Config editor with YAML editing, save, and dry-run validation
- [x] Backend Pytest scenarios (6/6)
- [x] Frontend Vitest + RTL scenarios (4/4)

## Project Structure

```text
workflow-platform/
  backend/
  frontend/
  docker-compose.yml
  README.md
  ARCHITECTURE.md
  DECISION_EXAMPLES.md
```

## Prerequisites

- Python 3.11+
- Node.js 18+
- npm 9+
- Docker (optional, for one-command startup)

## Quick Start (Preferred)

From `workflow-platform/`:

```bash
docker compose up --build
```

Open:

- Frontend: http://localhost:3000
- Backend root: http://localhost:8000
- Backend API docs: http://localhost:8000/docs

## Quick Verify (2 minutes)

1. Open the frontend and confirm Dashboard loads: http://localhost:3000
2. Open backend docs: http://localhost:8000/docs
3. Open backend root and confirm service summary JSON: http://localhost:8000
4. In UI, submit one request from **New Request** and confirm Request Detail opens.
5. Check **Audit Explorer** and **Admin Panel** to confirm entries and metrics appear.

## Manual Setup

### Backend

```bash
cd backend
python -m venv .venv
. .venv/Scripts/activate  # Windows PowerShell: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### Backend (Windows + Conda campusx)

```powershell
cd workflow-platform/backend
C:/Users/91823/anaconda3/envs/campusx/python.exe -m pip install -r requirements.txt
C:/Users/91823/anaconda3/envs/campusx/python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## How To Submit a Request

### UI

1. Open `New Request`.
2. Select a workflow.
3. Fill dynamic form fields.
4. Submit and review request detail + rule trace.

### cURL

```bash
curl -X POST http://127.0.0.1:8000/api/requests \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "loan_approval",
    "payload": {
      "applicant_name": "Jane Doe",
      "credit_score": 720,
      "loan_amount": 250000,
      "employment_status": "employed",
      "dependency_mode": "pass"
    }
  }'
```

## Add a New Workflow (YAML)

1. Copy an existing file in `backend/config/workflows/`.
2. Set unique `workflow_id`.
3. Define `payload_schema` fields.
4. Define ordered `stages` with rules and routes.
5. Set `retry_policy` and optional `external_dependency`.
6. Save file and refresh Workflow Configs page.
7. Optionally validate via Config Editor `Test Config`.

Example start:

```yaml
workflow_id: my_workflow
name: My Workflow
version: "1.0"
payload_schema:
  - name: customer_id
    type: string
    required: true
stages:
  - name: intake
    type: auto
    rules:
      - rule_id: customer_required
        type: mandatory
        field: customer_id
        operator: neq
        value: ""
        action_on_fail: reject
        explanation: Customer ID is required
    on_success: approved
retry_policy:
  max_attempts: 2
  backoff_seconds: 0.1
  backoff_multiplier: 2.0
```

## Tests

### Backend

```bash
cd backend
pytest -q
```

### Frontend

```bash
cd frontend
npm run test
```

## Troubleshooting

### 1) `.python.exe` not recognized

Use one of the following instead:

- `python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000`
- `C:/Users/91823/anaconda3/envs/campusx/python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000`

PowerShell treats `.python.exe` as an invalid command name.

### 2) Port already in use

If `8000` is busy:

```powershell
python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001
```

If `3000` is busy:

```powershell
cd frontend
npm run dev -- --host=127.0.0.1 --port=3001
```

### 3) `GET /` returns 404

Run the backend from `workflow-platform/backend` using `main:app`. The current backend includes a root route that returns service metadata and docs link.

### 4) Frontend cannot reach backend

Set proxy target before starting frontend:

```powershell
$env:VITE_API_PROXY_TARGET = "http://127.0.0.1:8000"
npm run dev
```

## API Reference Summary

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/api/requests` | Create/process request |
| GET | `/api/requests` | List requests |
| GET | `/api/requests/{request_id}` | Request detail |
| GET | `/api/workflows` | List workflow configs |
| GET | `/api/workflows/{workflow_id}` | Read workflow + YAML |
| POST | `/api/workflows` | Create workflow YAML |
| PUT | `/api/workflows/{workflow_id}` | Update workflow YAML |
| DELETE | `/api/workflows/{workflow_id}` | Delete workflow |
| POST | `/api/workflows/{workflow_id}/test` | Dry-run config validation |
| GET | `/api/audit` | Search audit entries |
| GET | `/api/audit/{request_id}` | Full audit trail |
| GET | `/api/admin/queue` | Manual review + failed queue |
| POST | `/api/admin/retry/{request_id}` | Manual retry |
| POST | `/api/admin/override/{request_id}` | Approve/reject override |
| GET | `/api/admin/metrics` | Operational metrics |
| POST | `/api/admin/retry-failed` | Bulk retry failed requests |


