from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator


class DecisionStatus(str, Enum):
    RECEIVED = "received"
    PROCESSING = "processing"
    APPROVED = "approved"
    REJECTED = "rejected"
    MANUAL_REVIEW = "manual_review"
    RETRY_PENDING = "retry_pending"
    VALIDATION_FAILED = "validation_failed"


class AssignmentOutcome(str, Enum):
    RECEIVED = "received"
    PROCESSING = "processing"
    SUCCESS = "success"
    REJECT = "reject"
    MANUAL_REVIEW = "manual_review"
    RETRY = "retry"
    VALIDATION_FAILED = "validation_failed"


class Action(str, Enum):
    CONTINUE = "continue"
    APPROVE = "approve"
    REJECT = "reject"
    MANUAL_REVIEW = "manual_review"
    RETRY = "retry"


class ComparisonOperator(str, Enum):
    EQ = "eq"
    NE = "ne"
    GT = "gt"
    GTE = "gte"
    LT = "lt"
    LTE = "lte"
    IN = "in"
    NOT_IN = "not_in"
    EXISTS = "exists"


class FieldType(str, Enum):
    STRING = "string"
    INTEGER = "integer"
    NUMBER = "number"
    BOOLEAN = "boolean"


class FieldSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: FieldType
    required: bool = False
    minimum: float | None = None
    maximum: float | None = None
    enum: list[Any] | None = None


class InputSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fields: dict[str, FieldSpec]


class Condition(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field: str
    operator: ComparisonOperator
    value: Any | None = None


RuleType = Literal["required", "threshold", "equals", "dependency", "ratio_threshold"]


class RuleConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    type: RuleType
    field: str | None = None
    operator: ComparisonOperator | None = None
    value: Any | None = None
    numerator_field: str | None = None
    denominator_field: str | None = None
    dependency: str | None = None
    run_if: Condition | None = None
    reason: str
    data_refs: list[str] = Field(default_factory=list)
    on_pass: Action = Action.CONTINUE
    on_fail: Action = Action.REJECT
    on_dependency_error: Action = Action.RETRY

    @model_validator(mode="after")
    def validate_shape(self) -> "RuleConfig":
        if self.type == "required" and not self.field:
            raise ValueError("required rules must define field")
        if self.type in {"threshold", "equals"}:
            if not self.field or self.operator is None:
                raise ValueError(f"{self.type} rules must define field and operator")
        if self.type == "ratio_threshold":
            if not self.numerator_field or not self.denominator_field or self.operator is None:
                raise ValueError("ratio_threshold rules must define numerator_field, denominator_field, and operator")
        if self.type == "dependency" and not self.dependency:
            raise ValueError("dependency rules must define dependency")
        return self


class StageConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    rules: list[RuleConfig]


class WorkflowConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    version: str
    description: str
    input_schema: InputSchema
    stages: list[StageConfig]


class WorkflowSummary(BaseModel):
    name: str
    version: str
    description: str


class WorkflowOperationalActivity(BaseModel):
    workflow_name: str
    total_requests: int
    successful_decisions: int
    rejected_decisions: int
    retry_pending: int
    manual_review: int
    validation_failures: int
    latest_status: str | None = None
    latest_updated_at: str | None = None


class OperationalOverview(BaseModel):
    total_requests: int = 0
    successful_decisions: int = 0
    rejected_decisions: int = 0
    active_retry_queue: int = 0
    manual_review_queue: int = 0
    validation_failures: int = 0
    audit_events: int = 0
    lifecycle_events: int = 0
    workflows_with_activity: int = 0
    latest_updated_at: str | None = None
    workflow_activity: list[WorkflowOperationalActivity] = Field(default_factory=list)


class SubmissionRequest(BaseModel):
    payload: dict[str, Any]


class HistoryEvent(BaseModel):
    event_type: str
    from_status: str | None = None
    to_status: str | None = None
    stage_id: str | None = None
    message: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str


class AuditEvent(BaseModel):
    workflow_name: str
    stage_id: str | None = None
    rule_id: str | None = None
    event_type: str
    outcome: str
    message: str
    data_refs: list[str] = Field(default_factory=list)
    details: dict[str, Any] = Field(default_factory=dict)
    created_at: str


class DecisionExplanation(BaseModel):
    summary: str
    final_reason: str
    validation_errors: list[str] = Field(default_factory=list)
    triggered_rules: list[dict[str, Any]] = Field(default_factory=list)
    idempotency: dict[str, Any] = Field(default_factory=dict)


class DecisionSnapshot(BaseModel):
    request_id: str
    workflow_name: str
    workflow_version: str
    idempotency_key: str
    payload: dict[str, Any]
    status: DecisionStatus
    current_stage: str | None = None
    decision: str | None = None
    retry_count: int = 0
    last_error: str | None = None
    created_at: str
    updated_at: str
    explanation: DecisionExplanation
    history: list[HistoryEvent] = Field(default_factory=list)
    audit_trail: list[AuditEvent] = Field(default_factory=list)
    idempotent_replay: bool = False
    payload_hash: str = Field(default="", exclude=True)

    @computed_field(return_type=AssignmentOutcome)
    @property
    def outcome(self) -> AssignmentOutcome:
        return map_status_to_outcome(self.status)


class ExplanationResponse(BaseModel):
    request_id: str
    status: DecisionStatus
    explanation: DecisionExplanation
    history: list[HistoryEvent]
    audit_trail: list[AuditEvent]

    @computed_field(return_type=AssignmentOutcome)
    @property
    def outcome(self) -> AssignmentOutcome:
        return map_status_to_outcome(self.status)


def map_status_to_outcome(status: DecisionStatus) -> AssignmentOutcome:
    mapping = {
        DecisionStatus.RECEIVED: AssignmentOutcome.RECEIVED,
        DecisionStatus.PROCESSING: AssignmentOutcome.PROCESSING,
        DecisionStatus.APPROVED: AssignmentOutcome.SUCCESS,
        DecisionStatus.REJECTED: AssignmentOutcome.REJECT,
        DecisionStatus.MANUAL_REVIEW: AssignmentOutcome.MANUAL_REVIEW,
        DecisionStatus.RETRY_PENDING: AssignmentOutcome.RETRY,
        DecisionStatus.VALIDATION_FAILED: AssignmentOutcome.VALIDATION_FAILED,
    }
    return mapping[status]
