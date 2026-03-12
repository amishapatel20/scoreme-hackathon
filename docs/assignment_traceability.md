# Requirements Traceability

This document maps the stated platform requirements to the implemented service, so each requested capability can be traced to a concrete API surface, configuration model, or execution path.

## 1. Build a Configurable Workflow Decision Platform

Required by assignment:

- processes incoming requests
- evaluates rules
- executes workflow stages
- maintains state
- records audit trails
- handles failures and retries
- stays generic across business use cases through configuration

Implemented as:

- REST platform entry point in `POST /workflows/{workflow_name}/requests`
- configurable workflow definitions in `workflows/*.yaml`
- orchestration engine in `app/service.py`
- persisted state and history in SQLite tables from `app/database.py`
- audit trail persistence in `audit_events`
- retry support in `POST /requests/{request_id}/retry`

## 2. Core capabilities required

### Input intake: accept structured request and validate schema

Implemented in:

- `SubmissionRequest` model in `app/models.py`
- workflow input schema model in `InputSchema` and `FieldSpec` in `app/models.py`
- payload validation in `_validate_payload()` inside `app/service.py`
- request submission API in `app/main.py`

What the platform does:

- accepts a JSON payload
- validates required fields
- validates type constraints
- validates minimum and maximum values
- validates enum values
- stores validation failures as persisted outcomes, not just transient API errors

### Rules evaluation: mandatory checks, threshold checks, conditional branching, multistep evaluation

Implemented in:

- rule definitions in `RuleConfig` in `app/models.py`
- supported rule types in `RuleType` in `app/models.py`
- conditional execution through `run_if` in `app/models.py`
- rule engine in `_evaluate_rule()` inside `app/service.py`
- multi-stage execution in `_execute_workflow()` inside `app/service.py`

Supported rule patterns:

- required checks
- threshold comparisons
- equality comparisons
- ratio threshold checks
- dependency-backed checks
- conditional rule execution using `run_if`

### Workflow execution: success, reject, retry, and manual review stages

Implemented in:

- status model in `DecisionStatus` in `app/models.py`
- terminal action model in `Action` in `app/models.py`
- action-to-status resolution in `_finalize_action()` inside `app/service.py`
- explicit retry endpoint in `app/main.py`

Actual platform outcomes:

- `approved` = `success`
- `rejected`
- `retry_pending`
- `manual_review`

API alignment detail:

- response `status` preserves internal platform state
- response `outcome` exposes the assignment wording directly
- example: `status = approved` and `outcome = success`

### State management: lifecycle tracking and full change history

Implemented in:

- current snapshot table `requests` in `app/database.py`
- lifecycle table `request_history` in `app/database.py`
- history persistence in `record_history()` in `app/repository.py`
- request retrieval in `get_request()` in `app/repository.py`

What is tracked:

- initial receipt
- processing start
- stage entry
- decision reached
- validation failures
- retry requests
- latest materialized state and full historical events

### Auditability: explainable decisions with rule trace and data reference

Implemented in:

- audit table `audit_events` in `app/database.py`
- audit persistence in `record_audit()` in `app/repository.py`
- explanation model `DecisionExplanation` in `app/models.py`
- rule trace generation in `_execute_workflow()` inside `app/service.py`
- explanation API in `GET /requests/{request_id}/explanation`

What the platform records:

- rule id
- stage id
- pass or fail outcome
- action taken
- message explaining the decision
- data references used by the rule
- retry attempt number

### Failure handling: dependency failures, partial save failures, duplicate requests, retries and idempotency

Implemented in:

- external dependency simulator in `app/external.py`
- transient dependency retry path in `_evaluate_rule()` and `retry()` in `app/service.py`
- database transaction wrapper in `transaction()` in `app/database.py`
- idempotency check in `submit()` in `app/service.py`
- duplicate conflict handling in `submit()` in `app/service.py`

What the platform does:

- replays the original result for same idempotency key plus same payload
- rejects the request for same idempotency key plus different payload
- moves transient dependency failures to `retry_pending`
- retries through a controlled endpoint
- keeps database writes atomic to avoid half-saved state

### Configurability: workflows and rules should be changeable without major code rewrites

Implemented in:

- workflow loader in `app/config_loader.py`
- workflow schema in `WorkflowConfig` and `StageConfig` in `app/models.py`
- business rules in `workflows/application_approval.yaml`
- second use case in `workflows/vendor_approval.yaml`

What can change by configuration only:

- workflow names
- field requirements
- validation thresholds
- stage order
- branching behaviour
- manual review or reject routing
- dependency-enabled rules

## 3. Example use cases required by assignment

The company asked for a platform generic enough to support multiple business use cases by configuration.

Implemented examples:

- application approval in `workflows/application_approval.yaml`
- vendor approval in `workflows/vendor_approval.yaml`
- claim processing in `workflows/claim_processing.yaml`

This proves the engine is not hardcoded to one business flow.

## 4. Deliverables requested by assignment

### Working runnable implementation with README

Implemented as:

- runnable API in `app/main.py`
- setup and run guide in `README.md`

### Architecture document explaining system design, components, data flow, tradeoffs, and assumptions

Implemented as:

- `docs/architecture.md`

### Configuration model demonstrating how workflows and rules are configurable

Implemented as:

- `workflows/application_approval.yaml`
- `workflows/vendor_approval.yaml`
- config models in `app/models.py`

### API interface via REST API, CLI, or minimal UI

Implemented as:

- REST API in `app/main.py`

### Test coverage for happy path, invalid input, duplicate requests, dependency failure, retry flow, and rule change scenarios

Implemented as:

- `tests/test_api.py`

Covered tests:

- happy path approval
- invalid input
- duplicate replay
- duplicate payload conflict
- dependency transient failure plus retry
- config-driven rule change

### Decision explanation examples showing input, rules triggered, output, and audit reasoning

Implemented as:

- `docs/decision_examples.md`

## 5. Constraints required by assignment

### System must tolerate requirement changes

Implemented by externalizing workflow behaviour into YAML and keeping orchestration generic in `app/service.py`.

### Simulate at least one external dependency

Implemented in `app/external.py` with the simulated `fraud_service`.

### System must support idempotency

Implemented in `submit()` inside `app/service.py` using workflow name plus idempotency key uniqueness and payload hashing.

### Provide full audit logs

Implemented through `audit_events`, `request_history`, explanation traces, and the explanation endpoint.

### Workflow must be configurable without large code rewrite

Implemented through workflow YAML loading and generic rule execution.

### Document scaling considerations

Implemented in the scaling section of `docs/architecture.md`.

## 6. How to show this in the demo

Recommended judge flow:

1. Call `GET /workflows` to show that workflows are configuration-driven.
2. Submit one valid application request and show `approved`.
3. Submit the same request again with the same `Idempotency-Key` and show replay behaviour.
4. Submit a request with `dependency_mode = transient_error` and show `retry_pending`.
5. Call `POST /requests/{request_id}/retry` and show recovery.
6. Call `GET /requests/{request_id}/explanation` and show the rule trace, data references, and audit reasoning.
7. Open a workflow YAML file and show how a threshold change alters behaviour without code changes.

## 7. Short answer to “where is the platform?”

The platform is the combination of:

- API layer in `app/main.py`
- workflow engine in `app/service.py`
- configurable workflow definitions in `workflows/*.yaml`
- persistence and audit model in `app/database.py` and `app/repository.py`
- tests in `tests/test_api.py`

That is the actual configurable workflow decision platform the assignment asks for.
