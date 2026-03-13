export type DecisionStatus =
  | "received"
  | "processing"
  | "approved"
  | "rejected"
  | "manual_review"
  | "retry_pending"
  | "validation_failed";

export type AssignmentOutcome =
  | "received"
  | "processing"
  | "success"
  | "reject"
  | "manual_review"
  | "retry"
  | "validation_failed";

export type Action = "continue" | "approve" | "reject" | "manual_review" | "retry";

export type ComparisonOperator =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "not_in"
  | "exists";

export type FieldType = "string" | "integer" | "number" | "boolean";

export interface FieldSpec {
  type: FieldType;
  required?: boolean;
  minimum?: number | null;
  maximum?: number | null;
  enum?: unknown[] | null;
}

export interface InputSchema {
  fields: Record<string, FieldSpec>;
}

export interface Condition {
  field: string;
  operator: ComparisonOperator;
  value?: unknown;
}

export type RuleType = "required" | "threshold" | "equals" | "dependency" | "ratio_threshold";

export interface RuleConfig {
  id: string;
  type: RuleType;
  field?: string | null;
  operator?: ComparisonOperator | null;
  value?: unknown;
  numerator_field?: string | null;
  denominator_field?: string | null;
  dependency?: string | null;
  run_if?: Condition | null;
  reason: string;
  data_refs?: string[];
  on_pass?: Action;
  on_fail?: Action;
  on_dependency_error?: Action;
}

export interface StageConfig {
  id: string;
  name: string;
  rules: RuleConfig[];
}

export interface WorkflowConfig {
  name: string;
  version: string;
  description: string;
  input_schema: InputSchema;
  stages: StageConfig[];
}

export interface WorkflowSummary {
  name: string;
  version: string;
  description: string;
}

export interface WorkflowOperationalActivity {
  workflow_name: string;
  total_requests: number;
  successful_decisions: number;
  rejected_decisions: number;
  retry_pending: number;
  manual_review: number;
  validation_failures: number;
  latest_status?: string | null;
  latest_updated_at?: string | null;
}

export interface OperationalOverview {
  total_requests: number;
  successful_decisions: number;
  rejected_decisions: number;
  active_retry_queue: number;
  manual_review_queue: number;
  validation_failures: number;
  audit_events: number;
  lifecycle_events: number;
  workflows_with_activity: number;
  latest_updated_at?: string | null;
  workflow_activity: WorkflowOperationalActivity[];
}

export interface SubmissionRequest {
  payload: Record<string, unknown>;
}

export interface HistoryEvent {
  event_type: string;
  from_status?: string | null;
  to_status?: string | null;
  stage_id?: string | null;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuditEvent {
  workflow_name: string;
  stage_id?: string | null;
  rule_id?: string | null;
  event_type: string;
  outcome: string;
  message: string;
  data_refs: string[];
  details: Record<string, unknown>;
  created_at: string;
}

export interface DecisionExplanation {
  summary: string;
  final_reason: string;
  validation_errors?: string[];
  triggered_rules?: Array<Record<string, unknown>>;
  idempotency?: Record<string, unknown>;
}

export interface DecisionSnapshot {
  request_id: string;
  workflow_name: string;
  workflow_version: string;
  idempotency_key: string;
  payload: Record<string, unknown>;
  status: DecisionStatus;
  current_stage?: string | null;
  decision?: string | null;
  retry_count: number;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
  explanation: DecisionExplanation;
  history: HistoryEvent[];
  audit_trail: AuditEvent[];
  idempotent_replay: boolean;
  outcome: AssignmentOutcome;

  // Internal bookkeeping; not returned publicly by default.
  payload_hash?: string;
}

export interface ExplanationResponse {
  request_id: string;
  status: DecisionStatus;
  explanation: DecisionExplanation;
  history: HistoryEvent[];
  audit_trail: AuditEvent[];
  outcome: AssignmentOutcome;
}

export function mapStatusToOutcome(status: DecisionStatus): AssignmentOutcome {
  const mapping: Record<DecisionStatus, AssignmentOutcome> = {
    received: "received",
    processing: "processing",
    approved: "success",
    rejected: "reject",
    manual_review: "manual_review",
    retry_pending: "retry",
    validation_failed: "validation_failed",
  };
  return mapping[status];
}
