# Demo Notes

## Two-minute pitch

We built a configurable workflow decision platform that handles structured request intake, rule evaluation, staged workflow execution, state persistence, auditability, idempotency, and failure recovery. The key engineering choice is that business workflows are defined in configuration rather than hardcoded into the engine, so the platform can support multiple use cases like application approval, vendor approval, and claim processing without major rewrites.

At runtime, each request is validated against a workflow-specific schema, executed through configured stages, and persisted with both a current snapshot and append-only history. Every rule evaluation creates audit evidence with data references and reasoning, so decisions are explainable instead of opaque. External dependency instability is simulated through a fraud service, and the platform moves requests into a retry state rather than silently failing. Duplicate requests are handled safely through idempotency keys and payload hashing. This gives a practical balance of flexibility, robustness, and traceability, which is exactly what the assignment asks for.

## Thirty-second architecture summary

The API layer handles transport, the workflow service handles orchestration, the repository layer handles persistence, and workflow YAML files define business behaviour. That separation keeps the core engine generic and makes requirement changes mostly configuration changes.

## Strong answers to likely judge questions

### Why is this configurable and not just parameterized?

Because the workflow structure itself is externalized: input schema, stage order, rule types, thresholds, branching conditions, and terminal actions are all defined in YAML files. The engine executes those definitions generically.

### How do you handle duplicates safely?

Each submission uses a workflow-scoped idempotency key plus a payload hash. If the same key and same payload arrive again, the system replays the stored result. If the same key arrives with a different payload, it returns a conflict.

### What makes the system resilient?

It uses transactional persistence to avoid partial saves, explicit retry states for transient dependency failures, and a full lifecycle history so operators can inspect what happened instead of guessing.

### How do you explain decisions?

Each rule evaluation records the stage, rule id, outcome, message, data references, and the resulting action. The explanation endpoint returns the final reasoning together with the full audit trail.

### How would you scale this?

Swap SQLite for PostgreSQL, move retries to worker queues, add circuit breakers around dependencies, and keep the same workflow engine and repository boundaries.

### What tradeoff did you make intentionally?

We used a bounded rule catalog instead of a free-form expression language. That reduces flexibility slightly, but it makes workflow changes safer, validations stronger, and audit explanations much clearer.

## Short closing line

This is not a single-purpose app. It is a reusable decision platform with configurable workflows, operational safeguards, and explainable outcomes.
