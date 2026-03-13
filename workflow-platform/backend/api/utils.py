from __future__ import annotations

import json
from datetime import timezone
from typing import Any

from sqlalchemy.orm import Session

from core.engine import list_audit_logs, list_state_history
from models.db import RequestModel


def to_iso(dt):
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def parse_json(text: str | None) -> dict[str, Any]:
    if not text:
        return {}
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {}


def serialize_request(session: Session, req: RequestModel, include_audit: bool = True) -> dict[str, Any]:
    payload = parse_json(req.payload_json)
    response = parse_json(req.response_json)
    body = {
        "request_id": req.request_id,
        "workflow_id": req.workflow_id,
        "status": req.status,
        "attempt_count": req.attempt_count,
        "payload": payload,
        "response": response,
        "failure_reason": req.failure_reason,
        "admin_note": req.admin_note,
        "processing_ms": req.processing_ms,
        "created_at": to_iso(req.created_at),
        "updated_at": to_iso(req.updated_at),
    }

    if include_audit:
        history = list_state_history(session, req.request_id)
        audit = list_audit_logs(session, req.request_id)
        body["state_history"] = [
            {
                "from_state": item.from_state,
                "to_state": item.to_state,
                "reason": item.reason,
                "timestamp": to_iso(item.timestamp),
            }
            for item in history
        ]
        body["audit_trail"] = [
            {
                "timestamp": to_iso(item.timestamp),
                "event_type": item.event_type,
                "stage": item.stage,
                "rule_id": item.rule_id,
                "field": item.field,
                "operator": item.operator,
                "expected_value": parse_json(item.expected_value) if item.expected_value else item.expected_value,
                "actual_value": parse_json(item.actual_value) if item.actual_value else item.actual_value,
                "result": item.result,
                "explanation": item.explanation,
                "details": parse_json(item.details_json),
            }
            for item in audit
        ]
    return body


def validate_payload_fields(payload_schema, payload: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    for field_def in payload_schema:
        value = payload.get(field_def.name)
        if field_def.required and value in (None, ""):
            errors.append(f"Missing required field: {field_def.name}")
            continue

        if value is None:
            continue

        expected = field_def.type
        if expected == "string" and not isinstance(value, str):
            errors.append(f"Field '{field_def.name}' must be a string")
        elif expected == "number" and not isinstance(value, (int, float)):
            errors.append(f"Field '{field_def.name}' must be a number")
        elif expected == "integer" and not isinstance(value, int):
            errors.append(f"Field '{field_def.name}' must be an integer")
        elif expected == "boolean" and not isinstance(value, bool):
            errors.append(f"Field '{field_def.name}' must be a boolean")
    return errors
