from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import and_, select

from api.context import AppContext
from api.utils import parse_json, serialize_request, to_iso
from models.db import AuditLogModel, RequestModel


router = APIRouter(prefix="/api", tags=["audit"])


def _ctx(req: Request) -> AppContext:
    return req.app.state.ctx


@router.get("/audit")
def search_audit(
    req: Request,
    request_id: str | None = None,
    workflow_id: str | None = None,
    status: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = 200,
):
    ctx = _ctx(req)
    with ctx.session_factory() as session:
        stmt = select(AuditLogModel).order_by(AuditLogModel.timestamp.desc()).limit(max(1, min(limit, 1000)))

        filters = []
        if request_id:
            filters.append(AuditLogModel.request_id == request_id)
        if workflow_id:
            filters.append(AuditLogModel.workflow_id == workflow_id)

        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date)
                filters.append(AuditLogModel.timestamp >= start_dt)
            except ValueError as exc:
                raise HTTPException(status_code=422, detail=f"Invalid start_date: {start_date}") from exc
        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date)
                filters.append(AuditLogModel.timestamp <= end_dt)
            except ValueError as exc:
                raise HTTPException(status_code=422, detail=f"Invalid end_date: {end_date}") from exc

        if status:
            sub = select(RequestModel.request_id).where(RequestModel.status == status)
            filters.append(AuditLogModel.request_id.in_(sub))

        if filters:
            stmt = stmt.where(and_(*filters))

        rows = list(session.scalars(stmt))
        return [
            {
                "timestamp": to_iso(row.timestamp),
                "request_id": row.request_id,
                "workflow_id": row.workflow_id,
                "event_type": row.event_type,
                "stage": row.stage,
                "rule": row.rule_id,
                "result": row.result,
                "explanation": row.explanation,
            }
            for row in rows
        ]


@router.get("/audit/{request_id}")
def get_audit(request_id: str, req: Request):
    ctx = _ctx(req)
    with ctx.session_factory() as session:
        record = session.get(RequestModel, request_id)
        if record is None:
            raise HTTPException(status_code=404, detail="Request not found")

        data = serialize_request(session, record)
        external_calls = [
            item for item in data["audit_trail"] if item.get("event_type") == "external_call"
        ]
        rule_trace = [
            item for item in data["audit_trail"] if item.get("event_type") == "rule_evaluated"
        ]

        return {
            "request": {
                "request_id": record.request_id,
                "workflow_id": record.workflow_id,
                "status": record.status,
                "payload": parse_json(record.payload_json),
                "response": parse_json(record.response_json),
                "created_at": to_iso(record.created_at),
                "updated_at": to_iso(record.updated_at),
            },
            "state_history": data["state_history"],
            "rule_trace": rule_trace,
            "external_calls": external_calls,
        }
