# Deployment Guide

This project is ready to be deployed as a web service.

## Included deployment assets

- `Dockerfile` for container-based hosting
- `render.yaml` for Render deployment
- `/health` endpoint for runtime health checks
- environment-based configuration for database and workflow directory paths

## Option 1: Deploy on Render

1. Push the repository to GitHub.
2. Create a new Web Service in Render.
3. Point the service to this repository.
4. Render will detect `render.yaml` and build the service using Docker.
5. Set any optional environment variables if required:
   - `DECISION_DB_PATH`
   - `WORKFLOW_CONFIG_DIR`

Health check path:

```text
/health
```

## Option 2: Run with Docker locally

Build the image:

```bash
docker build -t workflow-operations-platform .
```

Run the container:

```bash
docker run -p 8000:8000 workflow-operations-platform
```

Open:

```text
http://127.0.0.1:8000/
```

## Notes

- The current default persistence layer is SQLite.
- For hosted multi-user production usage, a managed relational database would be the next step beyond the current build.
- Workflow definitions are read from the `workflows/` directory unless overridden by environment variable.
