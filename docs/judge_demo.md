# Demo Runbook

This runbook is designed for a concise live walkthrough. It shows the main platform capabilities in a clean operational sequence.

If you want the entire sequence to run automatically, use [demo/run_demo.ps1](demo/run_demo.ps1).

## 1. Start the platform

From the project root, run:

```powershell
C:/Users/91823/AppData/Local/Programs/Python/Python313/python.exe -m uvicorn app.main:app --reload
```

Keep that terminal open. Use a second PowerShell terminal for the API calls below.

## 2. Show that the platform is configurable

Say:

The platform is generic. Workflows are configuration-driven and not hardcoded into one use case.

Run:

```powershell
Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:8000/workflows"
```

Expected point to make:

- the engine exposes multiple workflow types
- business behaviour is defined through YAML configs under `workflows/`

## 3. Show the success flow

Say:

This demonstrates structured intake, schema validation, multistage rule execution, state persistence, and a successful business outcome.

Run:

```powershell
$success = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/workflows/application_approval/requests" -Headers @{"Idempotency-Key"="demo-success-001"} -ContentType "application/json" -InFile "demo/application_success.json"
$success | ConvertTo-Json -Depth 8
```

Highlight these fields in the response:

- `status = approved`
- `outcome = success`
- `history`
- `audit_trail`
- `explanation.triggered_rules`

## 4. Show idempotency and duplicate replay

Say:

The same idempotency key with the same payload does not create a duplicate decision. The system replays the original result safely.

Run:

```powershell
$replay = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/workflows/application_approval/requests" -Headers @{"Idempotency-Key"="demo-success-001"} -ContentType "application/json" -InFile "demo/application_success.json"
$replay | ConvertTo-Json -Depth 8
```

Highlight these fields:

- same `request_id` as the first call
- `idempotent_replay = true`
- `outcome = success`

## 5. Show invalid input handling

Say:

The platform validates schema before rule execution and stores validation failure as a traceable lifecycle outcome.

Run:

```powershell
try {
    Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/workflows/application_approval/requests" -Headers @{"Idempotency-Key"="demo-invalid-001"} -ContentType "application/json" -InFile "demo/application_invalid.json"
} catch {
    $_.Exception.Response.GetResponseStream() | %% { $reader = New-Object System.IO.StreamReader($_); $reader.ReadToEnd(); $reader.Close() }
}
```

Highlight these points:

- response is validation failure
- explanation includes validation errors
- this is persisted and auditable, not just rejected at transport level

## 6. Show transient dependency failure and retry

Say:

The assignment explicitly asks for dependency failure handling, retries, and idempotent behaviour under operational constraints.

Run:

```powershell
$retryPending = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/workflows/application_approval/requests" -Headers @{"Idempotency-Key"="demo-retry-001"} -ContentType "application/json" -InFile "demo/application_retry.json"
$retryPending | ConvertTo-Json -Depth 8
```

Highlight these fields:

- `status = retry_pending`
- `outcome = retry`
- `last_error`

Then retry the request:

```powershell
$retried = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/requests/$($retryPending.request_id)/retry"
$retried | ConvertTo-Json -Depth 8
```

Highlight these fields:

- `retry_count = 1`
- final `status = approved`
- final `outcome = success`

## 7. Show explainability and auditability

Say:

Every decision is explainable. The system records rule-level traces, data references, lifecycle history, and dependency outcomes.

Run:

```powershell
$explanation = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:8000/requests/$($retried.request_id)/explanation"
$explanation | ConvertTo-Json -Depth 10
```

Highlight these sections:

- `outcome`
- `explanation.final_reason`
- `explanation.triggered_rules`
- `history`
- `audit_trail`

## 8. Show configurability without code rewrite

Say:

This is not a one-off approval app. The same engine can support multiple business use cases because rules and workflow stages are externalized into configuration.

Open these files in the editor:

- `workflows/application_approval.yaml`
- `workflows/claim_processing.yaml`
- `workflows/vendor_approval.yaml`

Point out:

- input schema is configurable
- stages are configurable
- thresholds are configurable
- manual review versus reject routing is configurable
- rule changes do not require rewriting the engine

## 9. Closing statement for judges

Use this closing summary:

This platform satisfies the assignment by providing configurable request intake, rule evaluation, multistage workflow execution, persistent state tracking, full auditability, external dependency handling, retries, idempotency, and test-backed behaviour across changing workflow definitions.

## 10. Fast fallback lines if the judges interrupt

If asked “where is configurability?” say:

It is in the workflow YAML files and the generic execution engine in `app/service.py`.

If asked “where is idempotency?” say:

It is enforced in submission handling through workflow plus idempotency key uniqueness and payload hashing.

If asked “where is auditability?” say:

It is persisted in request history, audit events, and the explanation endpoint.

If asked “where is failure handling?” say:

It is demonstrated by the external dependency simulator, retry state, retry endpoint, and transactional persistence.
