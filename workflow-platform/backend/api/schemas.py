from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class RequestCreate(BaseModel):
    request_id: str | None = None
    workflow_id: str
    payload: dict[str, Any]


class RequestSummary(BaseModel):
    request_id: str
    workflow_id: str
    status: str
    attempt_count: int
    created_at: datetime
    updated_at: datetime


class RequestDetail(RequestSummary):
    payload: dict[str, Any]
    response: dict[str, Any]
    processing_ms: float | None = None
    failure_reason: str | None = None
    admin_note: str | None = None
    state_history: list[dict[str, Any]] = Field(default_factory=list)
    audit_trail: list[dict[str, Any]] = Field(default_factory=list)


class WorkflowConfigBody(BaseModel):
    yaml_content: str


class ConfigDryRunRequest(BaseModel):
    payload: dict[str, Any]


class AdminOverrideRequest(BaseModel):
    decision: str
    note: str | None = None


class MetricsResponse(BaseModel):
    total_requests: int
    approval_rate: float
    rejection_rate: float
    pending_review: int
    failed: int
    avg_processing_time_ms: float
    failure_rate_by_workflow: dict[str, float]
    requests_by_workflow: dict[str, int]
    status_breakdown: dict[str, int]
    requests_last_7_days: list[dict[str, Any]]
