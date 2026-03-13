import crypto from "node:crypto";

import { getDb, runInTransaction } from "./db";
import { DependencyError, ExternalDependencyGateway, TransientDependencyError } from "./external";
import { DecisionRepository } from "./repository";
import type {
  Action,
  ComparisonOperator,
  Condition,
  DecisionExplanation,
  DecisionSnapshot,
  DecisionStatus,
  FieldSpec,
  RuleConfig,
  WorkflowConfig,
  WorkflowSummary,
} from "./types";
import { canonicalJson, utcNowIso } from "./util";
import { listWorkflows, loadWorkflow, WorkflowNotFoundError } from "./workflows";

export class DuplicateRequestConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateRequestConflictError";
  }
}

export class RequestNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestNotFoundError";
  }
}

export class RetryNotAllowedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryNotAllowedError";
  }
}

export class SubmissionValidationError extends Error {
  constructor(
    public readonly snapshot: DecisionSnapshot,
    public readonly errors: string[]
  ) {
    super("Submission failed input validation.");
    this.name = "SubmissionValidationError";
  }
}

interface RuleExecutionResult {
  outcome: string;
  action: Action;
  message: string;
  details: Record<string, unknown>;
}

export class WorkflowDecisionService {
  constructor(
    private readonly repository: DecisionRepository,
    private readonly dependencies: ExternalDependencyGateway
  ) {}

  listWorkflows(): WorkflowSummary[] {
    return listWorkflows();
  }

  getOperationalOverview() {
    return this.repository.getOperationalOverview();
  }

  submit(workflowName: string, idempotencyKey: string, payload: Record<string, unknown>): DecisionSnapshot {
    const workflow = loadWorkflow(workflowName);
    const payloadHash = this.hashPayload(payload);

    const existing = this.repository.findByIdempotency(workflowName, idempotencyKey);
    if (existing) {
      if (existing.payload_hash !== payloadHash) {
        throw new DuplicateRequestConflictError(
          "The idempotency key has already been used with a different payload."
        );
      }
      existing.idempotent_replay = true;
      existing.explanation.idempotency = {
        ...(existing.explanation.idempotency ?? {}),
        key: idempotencyKey,
        replayed: true,
      };
      return existing;
    }

    const requestId = crypto.randomUUID();
    const createdAt = utcNowIso();

    const acceptedExplanation: DecisionExplanation = {
      summary: "Request accepted.",
      final_reason: "Submission has been received and is ready for processing.",
      idempotency: { key: idempotencyKey, replayed: false },
    };

    let validationErrors: string[] = [];

    runInTransaction((db) => {
      const repository = new DecisionRepository(db);

      repository.insertRequest({
        request_id: requestId,
        workflow_name: workflow.name,
        workflow_version: workflow.version,
        idempotency_key: idempotencyKey,
        payload,
        payload_hash: payloadHash,
        status: "received",
        current_stage: null,
        decision: null,
        explanation: acceptedExplanation,
        retry_count: 0,
        created_at: createdAt,
      });

      repository.recordHistory({
        request_id: requestId,
        event_type: "request_received",
        from_status: null,
        to_status: "received",
        stage_id: null,
        message: "Request accepted into the system.",
        metadata: { workflow: workflow.name },
        created_at: createdAt,
      });

      validationErrors = this.validatePayload(workflow, payload);
      if (validationErrors.length) {
        const failedAt = utcNowIso();
        const failedExplanation: DecisionExplanation = {
          summary: "Input validation failed.",
          final_reason: "Submission did not satisfy the configured input schema.",
          validation_errors: validationErrors,
          idempotency: { key: idempotencyKey, replayed: false },
        };

        repository.recordAudit({
          request_id: requestId,
          workflow_name: workflow.name,
          stage_id: "input_validation",
          rule_id: null,
          event_type: "schema_validation",
          outcome: "failed",
          message: "Input schema validation failed.",
          data_refs: Object.keys(workflow.input_schema.fields),
          details: { errors: validationErrors },
          created_at: failedAt,
        });

        repository.updateRequest(requestId, {
          status: "validation_failed",
          current_stage: "input_validation",
          decision: "validation_failed",
          explanation: failedExplanation,
          updated_at: failedAt,
          last_error: validationErrors.join(" | "),
          retry_count: 0,
        });

        repository.recordHistory({
          request_id: requestId,
          event_type: "validation_failed",
          from_status: "received",
          to_status: "validation_failed",
          stage_id: "input_validation",
          message: "Schema validation failed.",
          metadata: { errors: validationErrors },
          created_at: failedAt,
        });

        return;
      }

      this.executeWorkflow({
        repository,
        requestId,
        workflow,
        payload,
        idempotencyKey,
        attemptNumber: 0,
        startingStatus: "received",
        markProcessing: true,
      });
    });

    const snapshot = this.repository.getRequest(requestId);
    if (!snapshot) {
      throw new RequestNotFoundError(`Request '${requestId}' was not persisted.`);
    }

    if (validationErrors.length) {
      throw new SubmissionValidationError(snapshot, validationErrors);
    }

    return snapshot;
  }

  getRequest(requestId: string): DecisionSnapshot {
    const snapshot = this.repository.getRequest(requestId);
    if (!snapshot) {
      throw new RequestNotFoundError(`Request '${requestId}' was not found.`);
    }
    return snapshot;
  }

  retry(requestId: string): DecisionSnapshot {
    const snapshot = this.getRequest(requestId);
    if (snapshot.status !== "retry_pending") {
      throw new RetryNotAllowedError("Only requests in retry_pending status can be retried.");
    }

    const workflow = loadWorkflow(snapshot.workflow_name);
    const nextRetryCount = snapshot.retry_count + 1;
    const retryAt = utcNowIso();

    runInTransaction((db) => {
      const repository = new DecisionRepository(db);

      const explanation: DecisionExplanation = {
        summary: "Retry requested.",
        final_reason: "The workflow is being re-executed after a transient dependency issue.",
        idempotency: { key: snapshot.idempotency_key, replayed: false },
      };

      repository.updateRequest(requestId, {
        status: "processing",
        current_stage: snapshot.current_stage ?? null,
        decision: null,
        explanation,
        updated_at: retryAt,
        last_error: null,
        retry_count: nextRetryCount,
      });

      repository.recordHistory({
        request_id: requestId,
        event_type: "retry_requested",
        from_status: "retry_pending",
        to_status: "processing",
        stage_id: snapshot.current_stage ?? null,
        message: "Retry requested for transient dependency failure.",
        metadata: { retry_count: nextRetryCount },
        created_at: retryAt,
      });

      this.executeWorkflow({
        repository,
        requestId,
        workflow,
        payload: snapshot.payload,
        idempotencyKey: snapshot.idempotency_key,
        attemptNumber: nextRetryCount,
        startingStatus: "processing",
        markProcessing: false,
      });
    });

    const latest = this.repository.getRequest(requestId);
    if (!latest) {
      throw new RequestNotFoundError(`Request '${requestId}' disappeared after retry.`);
    }
    return latest;
  }

  private executeWorkflow(params: {
    repository: DecisionRepository;
    requestId: string;
    workflow: WorkflowConfig;
    payload: Record<string, unknown>;
    idempotencyKey: string;
    attemptNumber: number;
    startingStatus: DecisionStatus;
    markProcessing: boolean;
  }): void {
    const { repository, requestId, workflow, payload, idempotencyKey, attemptNumber, markProcessing } = params;

    let currentStatus: DecisionStatus = params.startingStatus;
    const trace: Array<Record<string, unknown>> = [];

    if (markProcessing) {
      const startedAt = utcNowIso();
      repository.updateRequest(requestId, {
        status: "processing",
        current_stage: workflow.stages[0]?.id ?? null,
        decision: null,
        explanation: {
          summary: "Workflow processing started.",
          final_reason: "Configured workflow stages are being executed.",
          idempotency: { key: idempotencyKey, replayed: false },
        },
        updated_at: startedAt,
        last_error: null,
        retry_count: attemptNumber,
      });

      repository.recordHistory({
        request_id: requestId,
        event_type: "processing_started",
        from_status: currentStatus,
        to_status: "processing",
        stage_id: workflow.stages[0]?.id ?? null,
        message: "Workflow processing started.",
        metadata: { attempt_number: attemptNumber },
        created_at: startedAt,
      });

      currentStatus = "processing";
    }

    for (const stage of workflow.stages) {
      const stageAt = utcNowIso();
      repository.recordHistory({
        request_id: requestId,
        event_type: "stage_entered",
        from_status: currentStatus,
        to_status: currentStatus,
        stage_id: stage.id,
        message: `Entered stage '${stage.id}'.`,
        metadata: { stage_name: stage.name, attempt_number: attemptNumber },
        created_at: stageAt,
      });

      for (const rule of stage.rules) {
        const result = this.evaluateRule(rule, payload, attemptNumber);
        const auditAt = utcNowIso();

        const traceEntry = {
          stage_id: stage.id,
          stage_name: stage.name,
          rule_id: rule.id,
          outcome: result.outcome,
          action: result.action,
          message: result.message,
          data_refs: rule.data_refs ?? [],
          attempt_number: attemptNumber,
        };
        trace.push(traceEntry);

        repository.recordAudit({
          request_id: requestId,
          workflow_name: workflow.name,
          stage_id: stage.id,
          rule_id: rule.id,
          event_type: "rule_evaluated",
          outcome: result.outcome,
          message: result.message,
          data_refs: rule.data_refs ?? [],
          details: { ...result.details, action: result.action, attempt_number: attemptNumber },
          created_at: auditAt,
        });

        if (result.action === "continue") {
          continue;
        }

        const { finalStatus, decision } = this.finalizeAction(result.action);
        const finalExplanation: DecisionExplanation = {
          summary: `Workflow completed with status '${finalStatus}'.`,
          final_reason: result.message,
          triggered_rules: trace,
          idempotency: { key: idempotencyKey, replayed: false },
        };

        repository.updateRequest(requestId, {
          status: finalStatus,
          current_stage: stage.id,
          decision,
          explanation: finalExplanation,
          updated_at: auditAt,
          last_error: finalStatus === "retry_pending" ? result.message : null,
          retry_count: attemptNumber,
        });

        repository.recordHistory({
          request_id: requestId,
          event_type: "decision_reached",
          from_status: currentStatus,
          to_status: finalStatus,
          stage_id: stage.id,
          message: result.message,
          metadata: { rule_id: rule.id, action: result.action, attempt_number: attemptNumber },
          created_at: auditAt,
        });

        return;
      }
    }

    const completedAt = utcNowIso();
    const finalStageId = workflow.stages.at(-1)?.id ?? null;

    const finalExplanation: DecisionExplanation = {
      summary: "Workflow completed successfully.",
      final_reason: "All configured stages completed without rejection, retry, or manual review.",
      triggered_rules: trace,
      idempotency: { key: idempotencyKey, replayed: false },
    };

    repository.updateRequest(requestId, {
      status: "approved",
      current_stage: finalStageId,
      decision: "approved",
      explanation: finalExplanation,
      updated_at: completedAt,
      last_error: null,
      retry_count: attemptNumber,
    });

    repository.recordHistory({
      request_id: requestId,
      event_type: "decision_reached",
      from_status: currentStatus,
      to_status: "approved",
      stage_id: finalStageId,
      message: "Workflow approved after all rules passed.",
      metadata: { attempt_number: attemptNumber },
      created_at: completedAt,
    });
  }

  private evaluateRule(rule: RuleConfig, payload: Record<string, unknown>, attemptNumber: number): RuleExecutionResult {
    const onPass = rule.on_pass ?? "continue";
    const onFail = rule.on_fail ?? "reject";
    const onDependencyError = rule.on_dependency_error ?? "retry";

    if (rule.run_if && !this.matchesCondition(rule.run_if, payload)) {
      return {
        outcome: "skipped",
        action: "continue",
        message: `Rule '${rule.id}' skipped because run_if condition was not met.`,
        details: { run_if: rule.run_if },
      };
    }

    if (rule.type === "required") {
      const value = payload[rule.field ?? ""];
      const passed = value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0);
      return this.resultFromBoolean({
        passed,
        onPass,
        onFail,
        messageOnPass: `Rule '${rule.id}' passed: ${rule.reason}`,
        messageOnFail: `Rule '${rule.id}' failed: missing required field '${rule.field}'.`,
        details: { field: rule.field, value },
      });
    }

    if (rule.type === "threshold" || rule.type === "equals") {
      const value = payload[rule.field ?? ""];
      const passed = this.compare(value, rule.operator ?? null, rule.value);
      return this.resultFromBoolean({
        passed,
        onPass,
        onFail,
        messageOnPass: `Rule '${rule.id}' passed: ${rule.reason}`,
        messageOnFail: `Rule '${rule.id}' failed: ${rule.reason}`,
        details: { field: rule.field, value, operator: rule.operator, expected: rule.value },
      });
    }

    if (rule.type === "ratio_threshold") {
      const numerator = payload[rule.numerator_field ?? ""];
      const denominator = payload[rule.denominator_field ?? ""];

      let ratio: number | null = null;
      let passed = false;

      if (denominator === null || denominator === undefined || Number(denominator) === 0) {
        passed = false;
      } else {
        ratio = Number(numerator) / Number(denominator);
        passed = this.compare(ratio, rule.operator ?? null, rule.value);
      }

      return this.resultFromBoolean({
        passed,
        onPass,
        onFail,
        messageOnPass: `Rule '${rule.id}' passed: ${rule.reason}`,
        messageOnFail: `Rule '${rule.id}' failed: ${rule.reason}`,
        details: {
          numerator_field: rule.numerator_field,
          denominator_field: rule.denominator_field,
          numerator,
          denominator,
          ratio,
          operator: rule.operator,
          expected: rule.value,
        },
      });
    }

    if (rule.type === "dependency") {
      try {
        const dependencyResult = this.dependencies.evaluate(rule.dependency ?? "", payload, attemptNumber);
        const passed = dependencyResult.outcome === "pass";
        return this.resultFromBoolean({
          passed,
          onPass,
          onFail,
          messageOnPass: dependencyResult.message,
          messageOnFail: dependencyResult.message,
          details: { dependency: rule.dependency, reference: dependencyResult.reference, attempt_number: attemptNumber },
        });
      } catch (error) {
        if (error instanceof TransientDependencyError || error instanceof DependencyError) {
          return {
            outcome: "dependency_error",
            action: onDependencyError,
            message: error.message,
            details: { dependency: rule.dependency, attempt_number: attemptNumber },
          };
        }
        throw error;
      }
    }

    throw new Error(`Unsupported rule type '${rule.type}'.`);
  }

  private resultFromBoolean(params: {
    passed: boolean;
    onPass: Action;
    onFail: Action;
    messageOnPass: string;
    messageOnFail: string;
    details: Record<string, unknown>;
  }): RuleExecutionResult {
    if (params.passed) {
      return {
        outcome: "passed",
        action: params.onPass,
        message: params.messageOnPass,
        details: params.details,
      };
    }

    return {
      outcome: "failed",
      action: params.onFail,
      message: params.messageOnFail,
      details: params.details,
    };
  }

  private validatePayload(workflow: WorkflowConfig, payload: Record<string, unknown>): string[] {
    const errors: string[] = [];

    for (const [fieldName, fieldSpec] of Object.entries(workflow.input_schema.fields)) {
      const value = payload[fieldName];

      if ((fieldSpec.required ?? false) && (value === null || value === undefined)) {
        errors.push(`Field '${fieldName}' is required.`);
        continue;
      }

      if (value === null || value === undefined) {
        continue;
      }

      const typeError = this.validateType(fieldName, fieldSpec, value);
      if (typeError) {
        errors.push(typeError);
        continue;
      }

      if (fieldSpec.minimum !== null && fieldSpec.minimum !== undefined && Number(value) < fieldSpec.minimum) {
        errors.push(`Field '${fieldName}' must be >= ${fieldSpec.minimum}.`);
      }
      if (fieldSpec.maximum !== null && fieldSpec.maximum !== undefined && Number(value) > fieldSpec.maximum) {
        errors.push(`Field '${fieldName}' must be <= ${fieldSpec.maximum}.`);
      }
      if (Array.isArray(fieldSpec.enum) && !fieldSpec.enum.includes(value)) {
        errors.push(`Field '${fieldName}' must be one of ${JSON.stringify(fieldSpec.enum)}.`);
      }
    }

    return errors;
  }

  private validateType(fieldName: string, fieldSpec: FieldSpec, value: unknown): string | null {
    if (fieldSpec.type === "string" && typeof value !== "string") {
      return `Field '${fieldName}' must be a string.`;
    }
    if (fieldSpec.type === "integer" && !(typeof value === "number" && Number.isInteger(value)) ) {
      return `Field '${fieldName}' must be an integer.`;
    }
    if (fieldSpec.type === "number" && typeof value !== "number") {
      return `Field '${fieldName}' must be a number.`;
    }
    if (fieldSpec.type === "boolean" && typeof value !== "boolean") {
      return `Field '${fieldName}' must be a boolean.`;
    }
    return null;
  }

  private matchesCondition(condition: Condition, payload: Record<string, unknown>): boolean {
    const value = payload[condition.field];
    return this.compare(value, condition.operator ?? null, condition.value);
  }

  private compare(left: unknown, operator: ComparisonOperator | null, right: unknown): boolean {
    if (!operator) {
      throw new Error("Operator is required for comparison rules.");
    }

    if (operator === "exists") {
      return left !== null && left !== undefined;
    }

    if (left === null || left === undefined) {
      return false;
    }

    switch (operator) {
      case "eq":
        return left === right;
      case "ne":
        return left !== right;
      case "gt":
        return (left as any) > (right as any);
      case "gte":
        return (left as any) >= (right as any);
      case "lt":
        return (left as any) < (right as any);
      case "lte":
        return (left as any) <= (right as any);
      case "in":
        return Array.isArray(right) ? right.includes(left) : false;
      case "not_in":
        return Array.isArray(right) ? !right.includes(left) : false;
      default:
        throw new Error(`Unsupported operator '${operator}'.`);
    }
  }

  private finalizeAction(action: Action): { finalStatus: DecisionStatus; decision: string } {
    if (action === "approve") {
      return { finalStatus: "approved", decision: "approved" };
    }
    if (action === "reject") {
      return { finalStatus: "rejected", decision: "rejected" };
    }
    if (action === "manual_review") {
      return { finalStatus: "manual_review", decision: "manual_review" };
    }
    if (action === "retry") {
      return { finalStatus: "retry_pending", decision: "retry_pending" };
    }
    throw new Error(`Action '${action}' is not terminal.`);
  }

  private hashPayload(payload: Record<string, unknown>): string {
    const canonical = canonicalJson(payload);
    return crypto.createHash("sha256").update(canonical, "utf-8").digest("hex");
  }
}

export function getService(): WorkflowDecisionService {
  const db = getDb();
  const repository = new DecisionRepository(db);
  const dependencies = new ExternalDependencyGateway();
  return new WorkflowDecisionService(repository, dependencies);
}

export { WorkflowNotFoundError };
