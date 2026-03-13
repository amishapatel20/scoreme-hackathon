from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from config.loader import StageConfig, WorkflowConfig, WorkflowConfigLoader
from core.external_sim import ExternalDependencySimulator
from core.retry import compute_backoff, sleep_with_cap
from core.rules import RuleEvaluator
from core.state import RequestState, transition_state
from models.db import AuditLogModel, RequestModel, StateHistoryModel


TERMINAL_BY_NAME = {
    "approved": RequestState.APPROVED,
    "rejected": RequestState.REJECTED,
    "manual_review": RequestState.MANUAL_REVIEW,
    "failed": RequestState.FAILED,
}


class WorkflowEngine:
    def __init__(self, config_loader: WorkflowConfigLoader) -> None:
        self.config_loader = config_loader
        self.rule_evaluator = RuleEvaluator()
        self.external_sim = ExternalDependencySimulator()

    def process_request(self, session: Session, request: RequestModel) -> RequestModel:
        started_at = datetime.now(timezone.utc)
        workflow = self.config_loader.load(request.workflow_id)
        payload = json.loads(request.payload_json)

        transition_state(session, request, RequestState.IN_PROGRESS, "Workflow processing started")
        self._record_audit(
            session,
            request,
            workflow_id=workflow.workflow_id,
            event_type="engine",
            stage=None,
            rule_id=None,
            field=None,
            operator=None,
            expected=None,
            actual=None,
            result="INFO",
            explanation="Workflow processing started",
            details={"workflow": workflow.workflow_id},
        )
        session.commit()

        stage_map = {stage.name: stage for stage in workflow.stages}
        ordered_names = [stage.name for stage in workflow.stages]
        default_next = {
            name: ordered_names[idx + 1] if idx + 1 < len(ordered_names) else None
            for idx, name in enumerate(ordered_names)
        }

        current_stage_name = ordered_names[0] if ordered_names else None
        visit_count = 0

        while current_stage_name:
            visit_count += 1
            if visit_count > 200:
                transition_state(session, request, RequestState.FAILED, "Stage loop safety guard triggered")
                request.failure_reason = "Workflow stage loop detected"
                session.commit()
                return self._finalize(session, request, started_at)

            stage = stage_map[current_stage_name]
            action = self._run_stage(session, request, workflow, stage, payload)
            if action in {RequestState.APPROVED, RequestState.REJECTED, RequestState.MANUAL_REVIEW, RequestState.FAILED}:
                transition_state(session, request, action, f"Terminal state reached from stage '{stage.name}'")
                session.commit()
                return self._finalize(session, request, started_at)

            if action == "NEXT":
                candidate = stage.on_success or default_next.get(stage.name)
            elif action == "RETRY_NEXT":
                candidate = stage.on_retry or stage.on_success or default_next.get(stage.name)
            else:
                candidate = stage.on_failure or default_next.get(stage.name)

            terminal = TERMINAL_BY_NAME.get(str(candidate).lower()) if candidate else None
            if terminal:
                transition_state(session, request, terminal, f"Transition via stage route '{candidate}'")
                session.commit()
                return self._finalize(session, request, started_at)

            current_stage_name = candidate

        if request.status == RequestState.IN_PROGRESS:
            transition_state(session, request, RequestState.APPROVED, "All stages completed")
            session.commit()
        return self._finalize(session, request, started_at)

    def _run_stage(
        self,
        session: Session,
        request: RequestModel,
        workflow: WorkflowConfig,
        stage: StageConfig,
        payload: dict[str, Any],
    ) -> str:
        self._record_audit(
            session,
            request,
            workflow_id=workflow.workflow_id,
            event_type="stage_entered",
            stage=stage.name,
            rule_id=None,
            field=None,
            operator=None,
            expected=None,
            actual=None,
            result="INFO",
            explanation=f"Entered stage '{stage.name}'",
            details={"stage_type": stage.type},
        )

        if stage.type == "manual":
            return RequestState.MANUAL_REVIEW

        for idx, rule in enumerate(stage.rules, start=1):
            rule_id = rule.rule_id or f"{stage.name}_rule_{idx}"
            outcome = self.rule_evaluator.evaluate(rule, payload)
            self._record_audit(
                session,
                request,
                workflow_id=workflow.workflow_id,
                event_type="rule_evaluated",
                stage=stage.name,
                rule_id=rule_id,
                field=rule.field,
                operator=rule.operator,
                expected=rule.value,
                actual=outcome.actual_value,
                result="PASS" if outcome.passed else "FAIL",
                explanation=outcome.explanation,
                details={"action_on_fail": rule.action_on_fail},
            )

            if outcome.passed:
                continue

            request.failure_reason = outcome.explanation

            if outcome.action == "reject":
                return RequestState.REJECTED
            if outcome.action == "flag_review":
                return RequestState.MANUAL_REVIEW
            if outcome.action == "warn":
                continue
            if outcome.action == "retry":
                return self._handle_retry_action(session, request, workflow, stage, payload)

        if stage.type == "external":
            return self._execute_external_stage(session, request, workflow, stage, payload)

        return "NEXT"

    def _handle_retry_action(
        self,
        session: Session,
        request: RequestModel,
        workflow: WorkflowConfig,
        stage: StageConfig,
        payload: dict[str, Any],
    ) -> str:
        policy = workflow.retry_policy
        for attempt in range(1, policy.max_attempts + 1):
            request.attempt_count += 1
            transition_state(session, request, RequestState.RETRYING, f"Retry attempt {attempt} for stage '{stage.name}'")
            self._record_audit(
                session,
                request,
                workflow_id=workflow.workflow_id,
                event_type="retry",
                stage=stage.name,
                rule_id=None,
                field=None,
                operator=None,
                expected=None,
                actual=None,
                result="RETRY",
                explanation=f"Retry attempt {attempt}",
                details={"attempt": attempt},
            )
            session.commit()
            backoff = compute_backoff(policy.backoff_seconds, policy.backoff_multiplier, attempt)
            sleep_with_cap(backoff)

        fallback = (stage.on_failure or "failed").lower() if stage.on_failure else "failed"
        if fallback == "manual_review":
            return RequestState.MANUAL_REVIEW
        return RequestState.FAILED

    def _execute_external_stage(
        self,
        session: Session,
        request: RequestModel,
        workflow: WorkflowConfig,
        stage: StageConfig,
        payload: dict[str, Any],
    ) -> str:
        policy = workflow.retry_policy
        dependency_name = stage.external_dependency or (
            workflow.external_dependency.name if workflow.external_dependency else "external_dependency"
        )
        failure_rate = workflow.external_dependency.simulate_failure_rate if workflow.external_dependency else 0.0

        for attempt in range(1, policy.max_attempts + 1):
            request.attempt_count += 1
            call_result = self.external_sim.call(
                dependency_name,
                failure_rate,
                request_id=request.request_id,
                attempt=attempt,
                payload=payload,
            )
            self._record_audit(
                session,
                request,
                workflow_id=workflow.workflow_id,
                event_type="external_call",
                stage=stage.name,
                rule_id=dependency_name,
                field=None,
                operator=None,
                expected=failure_rate,
                actual=attempt,
                result="SUCCESS" if call_result.success else "FAIL",
                explanation=call_result.reason,
                details={"dependency": dependency_name, "attempt": attempt, "failure_rate": failure_rate},
            )
            session.commit()

            if call_result.success:
                return "NEXT"

            if attempt < policy.max_attempts:
                transition_state(session, request, RequestState.RETRYING, f"External retry {attempt} for '{dependency_name}'")
                session.commit()
                backoff = compute_backoff(policy.backoff_seconds, policy.backoff_multiplier, attempt)
                sleep_with_cap(backoff)

        failure_target = (stage.on_failure or "failed").lower()
        if failure_target == "manual_review":
            return RequestState.MANUAL_REVIEW
        return RequestState.FAILED

    def retry_request(self, session: Session, request: RequestModel) -> RequestModel:
        if request.status not in {RequestState.FAILED, RequestState.MANUAL_REVIEW, RequestState.RETRYING}:
            raise ValueError("Request is not eligible for retry")
        transition_state(session, request, RequestState.PENDING, "Manual retry requested by admin")
        session.commit()
        return self.process_request(session, request)

    def override_request(self, session: Session, request: RequestModel, decision: str, note: str | None = None) -> RequestModel:
        normalized = decision.upper()
        if normalized not in {RequestState.APPROVED, RequestState.REJECTED}:
            raise ValueError("decision must be APPROVED or REJECTED")
        transition_state(session, request, normalized, "Admin override")
        request.admin_note = note
        self._record_audit(
            session,
            request,
            workflow_id=request.workflow_id,
            event_type="admin_override",
            stage=None,
            rule_id=None,
            field=None,
            operator=None,
            expected=None,
            actual=normalized,
            result=normalized,
            explanation="Admin override applied",
            details={"note": note},
        )
        session.commit()
        return self._finalize(session, request, datetime.now(timezone.utc))

    def _finalize(self, session: Session, request: RequestModel, started_at: datetime) -> RequestModel:
        elapsed = datetime.now(timezone.utc) - started_at
        request.processing_ms = elapsed.total_seconds() * 1000
        request.updated_at = datetime.now(timezone.utc)

        response = {
            "request_id": request.request_id,
            "workflow_id": request.workflow_id,
            "status": request.status,
            "attempt_count": request.attempt_count,
            "failure_reason": request.failure_reason,
            "admin_note": request.admin_note,
        }
        request.response_json = json.dumps(response)
        session.commit()
        session.refresh(request)
        return request

    def _record_audit(
        self,
        session: Session,
        request: RequestModel,
        *,
        workflow_id: str,
        event_type: str,
        stage: str | None,
        rule_id: str | None,
        field: str | None,
        operator: str | None,
        expected: Any,
        actual: Any,
        result: str,
        explanation: str,
        details: dict[str, Any] | None,
    ) -> None:
        session.add(
            AuditLogModel(
                request_id=request.request_id,
                workflow_id=workflow_id,
                event_type=event_type,
                stage=stage,
                rule_id=rule_id,
                field=field,
                operator=operator,
                expected_value=json.dumps(expected, default=str) if expected is not None else None,
                actual_value=json.dumps(actual, default=str) if actual is not None else None,
                result=result,
                explanation=explanation,
                details_json=json.dumps(details or {}),
            )
        )


def fetch_request(session: Session, request_id: str) -> RequestModel | None:
    return session.get(RequestModel, request_id)


def list_state_history(session: Session, request_id: str) -> list[StateHistoryModel]:
    stmt = select(StateHistoryModel).where(StateHistoryModel.request_id == request_id).order_by(StateHistoryModel.timestamp.asc())
    return list(session.scalars(stmt))


def list_audit_logs(session: Session, request_id: str) -> list[AuditLogModel]:
    stmt = select(AuditLogModel).where(AuditLogModel.request_id == request_id).order_by(AuditLogModel.timestamp.asc())
    return list(session.scalars(stmt))
