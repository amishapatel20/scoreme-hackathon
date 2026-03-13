from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from models.db import RequestModel, StateHistoryModel, utc_now


class RequestState:
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    MANUAL_REVIEW = "MANUAL_REVIEW"
    RETRYING = "RETRYING"
    FAILED = "FAILED"


TERMINAL_STATES = {
    RequestState.APPROVED,
    RequestState.REJECTED,
    RequestState.MANUAL_REVIEW,
    RequestState.FAILED,
}


@dataclass
class StateTransition:
    from_state: str | None
    to_state: str
    reason: str


def transition_state(session: Session, request: RequestModel, to_state: str, reason: str) -> None:
    previous = request.status
    request.status = to_state
    request.updated_at = utc_now()
    session.add(
        StateHistoryModel(
            request_id=request.request_id,
            from_state=previous,
            to_state=to_state,
            reason=reason,
        )
    )
