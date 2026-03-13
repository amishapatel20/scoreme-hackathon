# Workflow Platform Repository

This repository now keeps the active, production-ready implementation under:

- `workflow-platform/`

Legacy root-level stacks were removed to avoid confusion and keep only the currently used code.

## Run The Platform

### Backend

```powershell
cd workflow-platform/backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

### Frontend

```powershell
cd workflow-platform/frontend
npm install
npm run dev -- --host=127.0.0.1 --port=3000
```

Open:

- Frontend: `http://localhost:3000`
- Backend API root: `http://127.0.0.1:8000`
- Swagger docs: `http://127.0.0.1:8000/docs`

## Main Documentation

- Product README: `workflow-platform/README.md`
- Architecture: `workflow-platform/ARCHITECTURE.md`
- Decision examples: `workflow-platform/DECISION_EXAMPLES.md`
- operational analytics

## Supporting Documentation

- [docs/architecture.md](docs/architecture.md)
- [docs/decision_examples.md](docs/decision_examples.md)
- [docs/assignment_traceability.md](docs/assignment_traceability.md)
- [docs/judge_demo.md](docs/judge_demo.md)
- [docs/presentation_notes.md](docs/presentation_notes.md)

For a scripted local walkthrough, use [demo/run_demo.ps1](demo/run_demo.ps1).



