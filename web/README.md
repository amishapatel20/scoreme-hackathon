# Workflow Operations Console (Node.js)

This folder contains the Node.js (Next.js) version of the Workflow Operations Platform.

## Run locally

```powershell
cd web
npm install
npx next dev
```

Open http://localhost:3000

## API endpoints (used by the dashboard)

- `GET /health`
- `GET /workflows`
- `GET /workflows/:workflowName/config`
- `POST /workflows/:workflowName/requests` (requires `Idempotency-Key` header)
- `GET /requests/:requestId`
- `POST /requests/:requestId/retry`
- `GET /requests/:requestId/explanation`
- `GET /analytics/overview`

## Persistence

- Uses SQLite via `better-sqlite3`.
- Local default DB path: `web/.data/decision_platform.db`.
- Override with `DB_PATH`.
- On Vercel, the default DB path becomes `/tmp/decision_platform.db` (ephemeral). For real persistence in production, use a hosted database.

## Workflows

Workflow definitions are loaded from `web/workflows/*.yaml`.
