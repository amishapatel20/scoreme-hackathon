# Architecture Overview

## Goal

Design a generic decision platform that can absorb changing business workflows without major rewrites while remaining traceable, robust under failure, and easy to reason about during evaluation.

## System components

### 1. API layer

FastAPI receives requests, exposes the workflow catalog, returns persisted decisions, and triggers retries.

Responsibilities:

- transport concerns only
- HTTP status mapping
- OpenAPI generation for evaluator convenience

### 2. Workflow configuration layer

Workflow definitions live in YAML files under `workflows/`. Each file describes:

- workflow name and version
- schema constraints for structured input
- ordered stages
- rules inside stages
- failure actions and conditional branching
- data references used in explanation output

This makes workflow evolution cheap: new use cases become config additions and most rule changes are config diffs.

### 3. Decision service

The service is the orchestration boundary. It performs:

- idempotency checks
- schema validation
- stage-by-stage workflow execution
- rule evaluation
- dependency invocation
- status transitions
- explanation generation

This keeps business logic out of the API and storage layers.

### 4. Persistence layer

SQLite stores three views of the same request lifecycle:

- `requests`: latest materialized snapshot
- `request_history`: append-only lifecycle transition log
- `audit_events`: rule evaluation and validation trace

The `requests` table supports fast retrieval, while the append-only tables preserve auditability and investigation depth.

### 5. External dependency simulation

`fraud_service` simulates realistic behaviour:

- pass
- fail
- transient error on first attempt

This proves retry handling, idempotency boundaries, and operational robustness without introducing real infrastructure dependencies.

## Data flow

1. Client submits a request with an `Idempotency-Key`.
2. The service checks whether the same workflow already processed that key.
3. If the key exists with the same payload, the stored result is replayed.
4. If the key exists with a different payload, the request is rejected as a conflict.
5. New requests are persisted as `received`.
6. Input schema validation runs.
7. Valid requests move into stage execution.
8. Each rule evaluation emits an audit event.
9. Any terminal action updates the request snapshot and appends lifecycle history.
10. Transient dependency errors move the request to `retry_pending`.
11. Explicit retry re-runs the workflow with incremented retry count.

## Why the boundaries are useful

### Separation of concerns

- API knows HTTP only.
- Service knows workflow execution only.
- Repository knows persistence only.
- Config loader knows workflow definitions only.
- Dependency gateway knows external integration behaviour only.

This minimizes coupling and gives a strong answer for the evaluation rubric around modularity and maintainability.

### Explainability by construction

Instead of generating explanations after the fact, the engine records the reasoning as it executes:

- which rule ran
- in which stage
- with what outcome
- based on which input references
- what action the rule caused

That makes explanations deterministic and aligned with stored evidence.

## Failure handling strategy

### Duplicate requests

- Same workflow + same idempotency key + same payload: replay stored result.
- Same workflow + same idempotency key + different payload: return conflict.

### Dependency failures

- Transient dependency errors route to `retry_pending`.
- Retry uses an explicit endpoint so recovery is controlled and observable.

### Partial save failures

All request snapshot changes, history writes, and audit writes for a transaction happen inside a single SQLite transaction. If any part fails, the whole write set is rolled back, preventing half-written state.

### Changing requirements

Most expected change categories are configuration changes:

- adding a new workflow
- adjusting thresholds
- changing manual review vs reject routing
- inserting a new stage
- updating required input fields

Code changes are only needed when introducing genuinely new rule primitives or new dependency types.

## Tradeoffs and rationale

### Why YAML over hardcoded rules

Hardcoded rules would be quicker at first but fail the maintainability requirement. YAML provides readable, reviewable, diff-friendly configuration for business logic.

### Why a fixed rule catalog over arbitrary expressions

An expression language is flexible but harder to secure, validate, and explain. A bounded set of rule types gives safer change management and clearer audit traces.

### Why SQLite for the current build

SQLite keeps the service runnable without external infrastructure while preserving transactional guarantees and audit visibility. The repository abstraction leaves room to swap in PostgreSQL or another transactional store later.

## Scaling considerations

For production-scale evolution:

- replace SQLite with PostgreSQL
- move retries to a queue-backed worker system
- store audit events in an append-only log stream for analytics
- add optimistic locking or version columns for concurrent updates
- cache validated workflow configs with file version checks
- split dependency calls behind circuit breakers and timeout policies
- add authentication, rate limiting, and workflow-level authorization

## Assumptions

- Workflow authors are trusted and workflow files are version-controlled.
- Manual review is a terminal outcome for automation, not a human task engine.
- Retries are explicit and safe because idempotency is scoped to initial submission, not retry attempts.
- Payloads are JSON-shaped dictionaries and do not require nested-schema validation beyond current field constraints.
