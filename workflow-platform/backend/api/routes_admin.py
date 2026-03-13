from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import func, select

from api.context import AppContext
from api.schemas import AdminOverrideRequest
from api.utils import serialize_request
from core.engine import fetch_request
from core.state import RequestState
from models.db import RequestModel


router = APIRouter(prefix="/api/admin", tags=["admin"])


def _ctx(req: Request) -> AppContext:
    return req.app.state.ctx


@router.get("/queue")
def get_review_queue(req: Request):
    ctx = _ctx(req)
    with ctx.session_factory() as session:
        stmt = (
            select(RequestModel)
            .where(RequestModel.status.in_([RequestState.MANUAL_REVIEW, RequestState.FAILED]))
            .order_by(RequestModel.created_at.asc())
        )
        rows = list(session.scalars(stmt))
        return [serialize_request(session, row, include_audit=False) for row in rows]


@router.post("/retry/{request_id}")
def retry_request(request_id: str, req: Request):
    ctx = _ctx(req)
    with ctx.session_factory() as session:
        request_row = fetch_request(session, request_id)
        if request_row is None:
            raise HTTPException(status_code=404, detail="Request not found")

        try:
            updated = ctx.engine.retry_request(session, request_row)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

        return serialize_request(session, updated)


@router.post("/override/{request_id}")
def override_request(request_id: str, body: AdminOverrideRequest, req: Request):
    ctx = _ctx(req)
    with ctx.session_factory() as session:
        request_row = fetch_request(session, request_id)
        if request_row is None:
            raise HTTPException(status_code=404, detail="Request not found")

        try:
            updated = ctx.engine.override_request(session, request_row, body.decision, body.note)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        return serialize_request(session, updated)


@router.get("/metrics")
def get_metrics(req: Request):
    ctx = _ctx(req)
    with ctx.session_factory() as session:
        total_requests = session.scalar(select(func.count()).select_from(RequestModel)) or 0
        approved = session.scalar(select(func.count()).select_from(RequestModel).where(RequestModel.status == RequestState.APPROVED)) or 0
        rejected = session.scalar(select(func.count()).select_from(RequestModel).where(RequestModel.status == RequestState.REJECTED)) or 0
        pending_review = session.scalar(
            select(func.count()).select_from(RequestModel).where(RequestModel.status == RequestState.MANUAL_REVIEW)
        ) or 0
        failed = session.scalar(select(func.count()).select_from(RequestModel).where(RequestModel.status == RequestState.FAILED)) or 0
        avg_processing_time_ms = (
            session.scalar(select(func.avg(RequestModel.processing_ms)).where(RequestModel.processing_ms.is_not(None)))
            or 0.0
        )

        workflow_rows = session.execute(
            select(RequestModel.workflow_id, func.count())
            .group_by(RequestModel.workflow_id)
            .order_by(RequestModel.workflow_id.asc())
        ).all()
        requests_by_workflow = {row[0]: int(row[1]) for row in workflow_rows}

        failure_rate_by_workflow: dict[str, float] = {}
        for workflow_id, count in requests_by_workflow.items():
            failed_count = session.scalar(
                select(func.count())
                .select_from(RequestModel)
                .where(RequestModel.workflow_id == workflow_id)
                .where(RequestModel.status.in_([RequestState.FAILED, RequestState.MANUAL_REVIEW]))
            ) or 0
            failure_rate_by_workflow[workflow_id] = round((failed_count / count) if count else 0.0, 4)

        status_rows = session.execute(
            select(RequestModel.status, func.count()).group_by(RequestModel.status)
        ).all()
        status_breakdown = {row[0]: int(row[1]) for row in status_rows}

        now = datetime.now(timezone.utc)
        days = [now.date() - timedelta(days=offset) for offset in reversed(range(7))]
        requests_last_7_days = []
        for day in days:
            start = datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc)
            end = start + timedelta(days=1)
            count = session.scalar(
                select(func.count())
                .select_from(RequestModel)
                .where(RequestModel.created_at >= start)
                .where(RequestModel.created_at < end)
            ) or 0
            requests_last_7_days.append({"date": str(day), "count": int(count)})

        return {
            "total_requests": int(total_requests),
            "approval_rate": round((approved / total_requests) if total_requests else 0.0, 4),
            "rejection_rate": round((rejected / total_requests) if total_requests else 0.0, 4),
            "pending_review": int(pending_review),
            "failed": int(failed),
            "avg_processing_time_ms": float(avg_processing_time_ms),
            "failure_rate_by_workflow": failure_rate_by_workflow,
            "requests_by_workflow": requests_by_workflow,
            "status_breakdown": status_breakdown,
            "requests_last_7_days": requests_last_7_days,
        }


@router.post("/retry-failed")
def retry_all_failed(req: Request):
    ctx = _ctx(req)
    with ctx.session_factory() as session:
        stmt = select(RequestModel).where(RequestModel.status == RequestState.FAILED)
        rows = list(session.scalars(stmt))
        updated = []
        for row in rows:
            try:
                result = ctx.engine.retry_request(session, row)
                updated.append(result.request_id)
            except ValueError:
                continue
        return {"retried": updated, "count": len(updated)}
