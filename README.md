# Workflow Operations Platform

Workflow Operations Platform is a configurable decisioning service for structured request intake, rule evaluation, workflow execution, audit logging, state tracking, and failure recovery.

It is built for operational workflows that need deterministic decisions, explainability, idempotent processing, and the ability to change business behavior through configuration instead of repeated code rewrites.

The repository includes:

- a FastAPI service layer
- a browser-based operations console
- YAML-defined workflow configurations
- persisted request, history, and audit state
- automated tests for the core execution paths

## Overview

The platform accepts structured requests, validates them against workflow-specific schemas, executes configured rule stages, persists decisions and lifecycle history, and exposes explanation and retry controls through both API and UI surfaces.

The current implementation includes three representative workflows:

- Application approval
- Vendor approval
- Claim processing

These are defined in [workflows/application_approval.yaml](workflows/application_approval.yaml), [workflows/vendor_approval.yaml](workflows/vendor_approval.yaml), and [workflows/claim_processing.yaml](workflows/claim_processing.yaml).

## Core Capabilities

- Structured request intake with workflow-specific schema validation
- Rule evaluation using threshold, equality, dependency, ratio, and conditional checks
- Multi-stage workflow execution with configured routing behavior
- Outcome handling for success, reject, manual review, retry, and validation failure paths
- Persistent request snapshots, lifecycle history, and audit evidence
- Idempotent request handling with replay detection and payload conflict protection
- Retry support for transient dependency failures
- Operational analytics based on persisted runtime activity
- Configuration-driven behavior loaded from YAML

## Decision Approach

This project does not use a machine learning model.

The decision engine is rule-based and configuration-driven:

- workflow structure is defined in YAML
- validation and routing are deterministic
- outcomes are generated from configured rules and stage transitions
- explanations and audit records are produced from actual rule execution

## Technology Stack

- Python
- FastAPI
- Pydantic
- SQLite
- YAML
- Uvicorn
- HTML, CSS, and JavaScript
- Pytest
- PowerShell for the demo script

## Architecture

- [app/main.py](app/main.py) exposes the API and serves the operations console
- [app/service.py](app/service.py) coordinates validation, workflow execution, retries, and explanations
- [app/repository.py](app/repository.py) and [app/database.py](app/database.py) persist requests, lifecycle events, and audit trails
- [app/config_loader.py](app/config_loader.py) loads workflow definitions from YAML
- [app/external.py](app/external.py) simulates an external dependency with pass, fail, and transient error behavior
- [app/ui/](app/ui/) contains the browser-based operations console

Additional system design detail is available in [docs/architecture.md](docs/architecture.md).

## Operations Console

The root route serves a browser-based console for working with the platform.

The console supports:

- workflow catalog browsing
- workflow blueprint and schema inspection
- sample request loading
- request submission without external API tools
- existing request lookup by id
- duplicate replay testing
- retry handling for retry-pending requests
- decision summary, lifecycle ledger, and audit evidence review
- live platform footprint and workload analytics

Default local routes:

```text
http://127.0.0.1:8000/
http://127.0.0.1:8000/docs
```

If port `8000` is already in use, start the service on another port such as `8001`.

## Getting Started

### 1. Create a virtual environment

Use Python 3.11 or newer.

```bash
python -m venv .venv
```

### 2. Install dependencies

```bash
pip install -e .[dev]
```

### 3. Start the application

```bash
uvicorn app.main:app --reload
```

### 4. Open the console

```text
http://127.0.0.1:8000/
```

## Deployment

The repository includes deployment-ready assets for container-based hosting.

- [Dockerfile](Dockerfile)
- [render.yaml](render.yaml)
- [docs/deployment.md](docs/deployment.md)

The service exposes a health endpoint at `GET /health` for hosted runtime checks.

## API Endpoints

- `GET /health`
- `GET /workflows`
- `GET /workflows/{workflow_name}/config`
- `GET /analytics/overview`
- `POST /workflows/{workflow_name}/requests`
- `GET /requests/{request_id}`
- `GET /requests/{request_id}/explanation`
- `POST /requests/{request_id}/retry`

Response semantics:

- `status` is the internal platform state, such as `approved` or `retry_pending`
- `outcome` is the business-facing decision result, such as `success`, `reject`, `manual_review`, or `retry`

## Configuration Model

Each workflow file defines:

- input schema fields and validation constraints
- ordered stages
- rule definitions within each stage
- pass and fail routing behavior
- optional conditional execution through `run_if`
- data references used in explanations and audit entries

This allows new workflows and rule changes to be introduced without rewriting the orchestration layer.

## Project Structure

```text
app/
  config_loader.py
  database.py
  external.py
  main.py
  models.py
  repository.py
  service.py
  ui/
demo/
docs/
tests/
workflows/
```

## Testing

Run the test suite with:

```bash
pytest
```

The current suite covers:

- dashboard availability
- workflow configuration exposure
- happy-path approval flow
- validation failure handling
- duplicate replay and conflict detection
- transient dependency retry behavior
- configuration-driven rule changes
- multi-workflow support
- operational analytics

## Supporting Documentation

- [docs/architecture.md](docs/architecture.md)
- [docs/decision_examples.md](docs/decision_examples.md)
- [docs/assignment_traceability.md](docs/assignment_traceability.md)
- [docs/judge_demo.md](docs/judge_demo.md)
- [docs/presentation_notes.md](docs/presentation_notes.md)

For a scripted local walkthrough, use [demo/run_demo.ps1](demo/run_demo.ps1).



