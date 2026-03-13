from __future__ import annotations

import json
from datetime import datetime, timezone
from hashlib import sha256
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request, Response
from sqlalchemy import select

from api.context import AppContext
from api.schemas import RequestCreate
from api.utils import serialize_request, validate_payload_fields
from core.idempotency import hash_payload
from core.state import RequestState
from models.db import AuditLogModel, RequestModel, StateHistoryModel


router = APIRouter(prefix="/api", tags=["requests"])


def _ctx(req: Request) -> AppContext:
    return req.app.state.ctx


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


@router.get("/requests")
def list_requests(
    req: Request,
    workflow_id: str | None = None,
    status: str | None = None,
    limit: int = 50,
):
    ctx = _ctx(req)
    with ctx.session_factory() as session:
        stmt = select(RequestModel).order_by(RequestModel.created_at.desc()).limit(max(1, min(limit, 500)))
        if workflow_id:
            stmt = stmt.where(RequestModel.workflow_id == workflow_id)
        if status:
            stmt = stmt.where(RequestModel.status == status)
        records = list(session.scalars(stmt))
        return [serialize_request(session, item, include_audit=False) for item in records]


@router.post("/requests")
def create_request(payload: RequestCreate, req: Request, response: Response):
    ctx = _ctx(req)

    try:
        workflow = ctx.workflow_loader.load(payload.workflow_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    field_errors = validate_payload_fields(workflow.payload_schema, payload.payload)
    if field_errors:
        raise HTTPException(status_code=422, detail={"message": "Payload validation failed", "errors": field_errors})

    request_id = payload.request_id or str(uuid4())
    payload_hash = hash_payload(payload.payload)

    with ctx.session_factory() as session:
        existing = session.get(RequestModel, request_id)
        if existing is not None:
            existing_hash = existing.payload_hash
            if existing_hash != payload_hash:
                raise HTTPException(status_code=409, detail="request_id already exists with different payload")
            session.add(
                AuditLogModel(
                    request_id=request_id,
                    workflow_id=existing.workflow_id,
                    event_type="idempotency_duplicate",
                    stage=None,
                    rule_id=None,
                    field=None,
                    operator=None,
                    expected_value=None,
                    actual_value=None,
                    result="INFO",
                    explanation="Duplicate request id received; returning existing record",
                    details_json=json.dumps({"request_id": request_id}),
                )
            )
            session.commit()
            response.headers["X-Idempotent"] = "true"
            return serialize_request(session, existing)

        now = _utc_now()
        record = RequestModel(
            request_id=request_id,
            workflow_id=payload.workflow_id,
            status=RequestState.PENDING,
            payload_json=json.dumps(payload.payload),
            payload_hash=payload_hash,
            response_json=json.dumps({"request_id": request_id, "status": RequestState.PENDING}),
            created_at=now,
            updated_at=now,
        )
        session.add(record)
        session.add(
            StateHistoryModel(
                request_id=request_id,
                from_state=None,
                to_state=RequestState.PENDING,
                reason="Request received",
            )
        )
        session.add(
            AuditLogModel(
                request_id=request_id,
                workflow_id=payload.workflow_id,
                event_type="request_received",
                stage=None,
                rule_id=None,
                field=None,
                operator=None,
                expected_value=None,
                actual_value=None,
                result="INFO",
                explanation="Request accepted",
                details_json=json.dumps({"request_id": request_id}),
            )
        )
        session.commit()
        session.refresh(record)

        processed = ctx.engine.process_request(session, record)
        response.status_code = 201
        return serialize_request(session, processed)


@router.get("/requests/{request_id}")
def get_request(request_id: str, req: Request):
    ctx = _ctx(req)
    with ctx.session_factory() as session:
        record = session.get(RequestModel, request_id)
        if record is None:
            raise HTTPException(status_code=404, detail="Request not found")
        return serialize_request(session, record)
