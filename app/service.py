from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from app.config_loader import WorkflowConfigLoader, WorkflowNotFoundError
from app.external import DependencyError, ExternalDependencyGateway, TransientDependencyError
from app.models import (
    Action,
    ComparisonOperator,
    Condition,
    DecisionExplanation,
    DecisionSnapshot,
    DecisionStatus,
    FieldSpec,
    FieldType,
    RuleConfig,
    WorkflowConfig,
)
from app.repository import DecisionRepository


class DuplicateRequestConflictError(RuntimeError):
    pass


class RequestNotFoundError(RuntimeError):
    pass


class RetryNotAllowedError(RuntimeError):
    pass


class SubmissionValidationError(RuntimeError):
    def __init__(self, snapshot: DecisionSnapshot, errors: list[str]) -> None:
        super().__init__("Submission failed input validation.")
        self.snapshot = snapshot
        self.errors = errors


@dataclass(frozen=True)
class RuleExecutionResult:
    outcome: str
    action: Action
    message: str
    details: dict[str, Any]


class WorkflowDecisionService:
    def __init__(
        self,
        *,
        config_loader: WorkflowConfigLoader,
        repository: DecisionRepository,
        dependencies: ExternalDependencyGateway,
    ) -> None:
        self.config_loader = config_loader
        self.repository = repository
        self.dependencies = dependencies

    def list_workflows(self):
        return self.config_loader.list_workflows()

    def get_operational_overview(self):
        return self.repository.get_operational_overview()

    def submit(self, workflow_name: str, idempotency_key: str, payload: dict[str, Any]) -> DecisionSnapshot:
        workflow = self.config_loader.load(workflow_name)
        payload_hash = self._hash_payload(payload)
        existing = self.repository.find_by_idempotency(workflow_name, idempotency_key)
        if existing is not None:
            if existing.payload_hash != payload_hash:
                raise DuplicateRequestConflictError(
                    "The idempotency key has already been used with a different payload."
                )
            existing.idempotent_replay = True
            existing.explanation.idempotency["replayed"] = True
            return existing

        request_id = str(uuid4())
        created_at = self._utc_now()
        explanation = DecisionExplanation(
            summary="Request accepted.",
            final_reason="Submission has been received and is ready for processing.",
            idempotency={"key": idempotency_key, "replayed": False},
        )
        validation_errors: list[str] = []

        with self.repository.database.transaction() as connection:
            self.repository.insert_request(
                connection,
                request_id=request_id,
                workflow_name=workflow.name,
                workflow_version=workflow.version,
                idempotency_key=idempotency_key,
                payload=payload,
                payload_hash=payload_hash,
                status=DecisionStatus.RECEIVED.value,
                current_stage=None,
                decision=None,
                explanation=explanation,
                retry_count=0,
                created_at=created_at,
            )
            self.repository.record_history(
                connection,
                request_id=request_id,
                event_type="request_received",
                from_status=None,
                to_status=DecisionStatus.RECEIVED.value,
                stage_id=None,
                message="Request accepted into the system.",
                metadata={"workflow": workflow.name},
                created_at=created_at,
            )

            validation_errors = self._validate_payload(workflow, payload)
            if validation_errors:
                final_explanation = DecisionExplanation(
                    summary="Input validation failed.",
                    final_reason="Submission did not satisfy the configured input schema.",
                    validation_errors=validation_errors,
                    idempotency={"key": idempotency_key, "replayed": False},
                )
                failed_at = self._utc_now()
                self.repository.record_audit(
                    connection,
                    request_id=request_id,
                    workflow_name=workflow.name,
                    stage_id="input_validation",
                    rule_id=None,
                    event_type="schema_validation",
                    outcome="failed",
                    message="Input schema validation failed.",
                    data_refs=list(workflow.input_schema.fields.keys()),
                    details={"errors": validation_errors},
                    created_at=failed_at,
                )
                self.repository.update_request(
                    connection,
                    request_id,
                    status=DecisionStatus.VALIDATION_FAILED.value,
                    current_stage="input_validation",
                    decision=DecisionStatus.VALIDATION_FAILED.value,
                    explanation=final_explanation,
                    updated_at=failed_at,
                    last_error=" | ".join(validation_errors),
                    retry_count=0,
                )
                self.repository.record_history(
                    connection,
                    request_id=request_id,
                    event_type="validation_failed",
                    from_status=DecisionStatus.RECEIVED.value,
                    to_status=DecisionStatus.VALIDATION_FAILED.value,
                    stage_id="input_validation",
                    message="Schema validation failed.",
                    metadata={"errors": validation_errors},
                    created_at=failed_at,
                )
            else:
                self._execute_workflow(
                    connection=connection,
                    request_id=request_id,
                    workflow=workflow,
                    payload=payload,
                    idempotency_key=idempotency_key,
                    attempt_number=0,
                    starting_status=DecisionStatus.RECEIVED,
                    mark_processing=True,
                )

        snapshot = self.repository.get_request(request_id)
        if snapshot is None:
            raise RequestNotFoundError(f"Request '{request_id}' was not persisted.")
        if validation_errors:
            raise SubmissionValidationError(snapshot, validation_errors)
        return snapshot

    def get_request(self, request_id: str) -> DecisionSnapshot:
        snapshot = self.repository.get_request(request_id)
        if snapshot is None:
            raise RequestNotFoundError(f"Request '{request_id}' was not found.")
        return snapshot

    def retry(self, request_id: str) -> DecisionSnapshot:
        snapshot = self.get_request(request_id)
        if snapshot.status != DecisionStatus.RETRY_PENDING:
            raise RetryNotAllowedError("Only requests in retry_pending status can be retried.")

        workflow = self.config_loader.load(snapshot.workflow_name)
        next_retry_count = snapshot.retry_count + 1
        retry_at = self._utc_now()

        with self.repository.database.transaction() as connection:
            explanation = DecisionExplanation(
                summary="Retry requested.",
                final_reason="The workflow is being re-executed after a transient dependency issue.",
                idempotency={"key": snapshot.idempotency_key, "replayed": False},
            )
            self.repository.update_request(
                connection,
                request_id,
                status=DecisionStatus.PROCESSING.value,
                current_stage=snapshot.current_stage,
                decision=None,
                explanation=explanation,
                updated_at=retry_at,
                last_error=None,
                retry_count=next_retry_count,
            )
            self.repository.record_history(
                connection,
                request_id=request_id,
                event_type="retry_requested",
                from_status=DecisionStatus.RETRY_PENDING.value,
                to_status=DecisionStatus.PROCESSING.value,
                stage_id=snapshot.current_stage,
                message="Retry requested for transient dependency failure.",
                metadata={"retry_count": next_retry_count},
                created_at=retry_at,
            )
            self._execute_workflow(
                connection=connection,
                request_id=request_id,
                workflow=workflow,
                payload=snapshot.payload,
                idempotency_key=snapshot.idempotency_key,
                attempt_number=next_retry_count,
                starting_status=DecisionStatus.PROCESSING,
                mark_processing=False,
            )

        latest = self.repository.get_request(request_id)
        if latest is None:
            raise RequestNotFoundError(f"Request '{request_id}' disappeared after retry.")
        return latest

    def _execute_workflow(
        self,
        *,
        connection,
        request_id: str,
        workflow: WorkflowConfig,
        payload: dict[str, Any],
        idempotency_key: str,
        attempt_number: int,
        starting_status: DecisionStatus,
        mark_processing: bool,
    ) -> None:
        current_status = starting_status
        trace: list[dict[str, Any]] = []

        if mark_processing:
            started_at = self._utc_now()
            self.repository.update_request(
                connection,
                request_id,
                status=DecisionStatus.PROCESSING.value,
                current_stage=workflow.stages[0].id,
                decision=None,
                explanation=DecisionExplanation(
                    summary="Workflow processing started.",
                    final_reason="Configured workflow stages are being executed.",
                    idempotency={"key": idempotency_key, "replayed": False},
                ),
                updated_at=started_at,
                last_error=None,
                retry_count=attempt_number,
            )
            self.repository.record_history(
                connection,
                request_id=request_id,
                event_type="processing_started",
                from_status=starting_status.value,
                to_status=DecisionStatus.PROCESSING.value,
                stage_id=workflow.stages[0].id,
                message="Workflow processing started.",
                metadata={"attempt_number": attempt_number},
                created_at=started_at,
            )
            current_status = DecisionStatus.PROCESSING

        for stage in workflow.stages:
            stage_at = self._utc_now()
            self.repository.record_history(
                connection,
                request_id=request_id,
                event_type="stage_entered",
                from_status=current_status.value,
                to_status=current_status.value,
                stage_id=stage.id,
                message=f"Entered stage '{stage.id}'.",
                metadata={"stage_name": stage.name, "attempt_number": attempt_number},
                created_at=stage_at,
            )

            for rule in stage.rules:
                result = self._evaluate_rule(rule, payload, attempt_number)
                audit_at = self._utc_now()
                trace_entry = {
                    "stage_id": stage.id,
                    "stage_name": stage.name,
                    "rule_id": rule.id,
                    "outcome": result.outcome,
                    "action": result.action.value,
                    "message": result.message,
                    "data_refs": rule.data_refs,
                    "attempt_number": attempt_number,
                }
                trace.append(trace_entry)

                self.repository.record_audit(
                    connection,
                    request_id=request_id,
                    workflow_name=workflow.name,
                    stage_id=stage.id,
                    rule_id=rule.id,
                    event_type="rule_evaluated",
                    outcome=result.outcome,
                    message=result.message,
                    data_refs=rule.data_refs,
                    details=result.details | {"action": result.action.value, "attempt_number": attempt_number},
                    created_at=audit_at,
                )

                if result.action == Action.CONTINUE:
                    continue

                final_status, decision = self._finalize_action(result.action)
                final_explanation = DecisionExplanation(
                    summary=f"Workflow completed with status '{final_status.value}'.",
                    final_reason=result.message,
                    triggered_rules=trace,
                    idempotency={"key": idempotency_key, "replayed": False},
                )
                self.repository.update_request(
                    connection,
                    request_id,
                    status=final_status.value,
                    current_stage=stage.id,
                    decision=decision,
                    explanation=final_explanation,
                    updated_at=audit_at,
                    last_error=result.message if final_status == DecisionStatus.RETRY_PENDING else None,
                    retry_count=attempt_number,
                )
                self.repository.record_history(
                    connection,
                    request_id=request_id,
                    event_type="decision_reached",
                    from_status=current_status.value,
                    to_status=final_status.value,
                    stage_id=stage.id,
                    message=result.message,
                    metadata={"rule_id": rule.id, "action": result.action.value, "attempt_number": attempt_number},
                    created_at=audit_at,
                )
                return

        completed_at = self._utc_now()
        final_explanation = DecisionExplanation(
            summary="Workflow completed successfully.",
            final_reason="All configured stages completed without rejection, retry, or manual review.",
            triggered_rules=trace,
            idempotency={"key": idempotency_key, "replayed": False},
        )
        final_stage_id = workflow.stages[-1].id if workflow.stages else None
        self.repository.update_request(
            connection,
            request_id,
            status=DecisionStatus.APPROVED.value,
            current_stage=final_stage_id,
            decision=DecisionStatus.APPROVED.value,
            explanation=final_explanation,
            updated_at=completed_at,
            last_error=None,
            retry_count=attempt_number,
        )
        self.repository.record_history(
            connection,
            request_id=request_id,
            event_type="decision_reached",
            from_status=current_status.value,
            to_status=DecisionStatus.APPROVED.value,
            stage_id=final_stage_id,
            message="Workflow approved after all rules passed.",
            metadata={"attempt_number": attempt_number},
            created_at=completed_at,
        )

    def _evaluate_rule(self, rule: RuleConfig, payload: dict[str, Any], attempt_number: int) -> RuleExecutionResult:
        if rule.run_if and not self._matches_condition(rule.run_if, payload):
            return RuleExecutionResult(
                outcome="skipped",
                action=Action.CONTINUE,
                message=f"Rule '{rule.id}' skipped because run_if condition was not met.",
                details={"run_if": rule.run_if.model_dump(mode="json")},
            )

        if rule.type == "required":
            value = payload.get(rule.field or "")
            passed = value not in (None, "", [])
            return self._result_from_boolean(
                rule=rule,
                passed=passed,
                message_on_pass=f"Rule '{rule.id}' passed: {rule.reason}",
                message_on_fail=f"Rule '{rule.id}' failed: missing required field '{rule.field}'.",
                details={"field": rule.field, "value": value},
            )

        if rule.type == "threshold":
            value = payload.get(rule.field or "")
            passed = self._compare(value, rule.operator, rule.value)
            return self._result_from_boolean(
                rule=rule,
                passed=passed,
                message_on_pass=f"Rule '{rule.id}' passed: {rule.reason}",
                message_on_fail=f"Rule '{rule.id}' failed: {rule.reason}",
                details={"field": rule.field, "value": value, "operator": rule.operator.value, "expected": rule.value},
            )

        if rule.type == "equals":
            value = payload.get(rule.field or "")
            passed = self._compare(value, rule.operator, rule.value)
            return self._result_from_boolean(
                rule=rule,
                passed=passed,
                message_on_pass=f"Rule '{rule.id}' passed: {rule.reason}",
                message_on_fail=f"Rule '{rule.id}' failed: {rule.reason}",
                details={"field": rule.field, "value": value, "operator": rule.operator.value, "expected": rule.value},
            )

        if rule.type == "ratio_threshold":
            numerator = payload.get(rule.numerator_field or "")
            denominator = payload.get(rule.denominator_field or "")
            ratio = None
            if denominator in (None, 0):
                passed = False
            else:
                ratio = float(numerator) / float(denominator)
                passed = self._compare(ratio, rule.operator, rule.value)
            return self._result_from_boolean(
                rule=rule,
                passed=passed,
                message_on_pass=f"Rule '{rule.id}' passed: {rule.reason}",
                message_on_fail=f"Rule '{rule.id}' failed: {rule.reason}",
                details={
                    "numerator_field": rule.numerator_field,
                    "denominator_field": rule.denominator_field,
                    "numerator": numerator,
                    "denominator": denominator,
                    "ratio": ratio,
                    "operator": rule.operator.value,
                    "expected": rule.value,
                },
            )

        if rule.type == "dependency":
            try:
                dependency_result = self.dependencies.evaluate(rule.dependency or "", payload, attempt_number)
            except TransientDependencyError as exc:
                return RuleExecutionResult(
                    outcome="dependency_error",
                    action=rule.on_dependency_error,
                    message=str(exc),
                    details={"dependency": rule.dependency, "attempt_number": attempt_number},
                )
            except DependencyError as exc:
                return RuleExecutionResult(
                    outcome="dependency_error",
                    action=rule.on_dependency_error,
                    message=str(exc),
                    details={"dependency": rule.dependency, "attempt_number": attempt_number},
                )

            passed = dependency_result.outcome == "pass"
            return self._result_from_boolean(
                rule=rule,
                passed=passed,
                message_on_pass=dependency_result.message,
                message_on_fail=dependency_result.message,
                details={
                    "dependency": rule.dependency,
                    "reference": dependency_result.reference,
                    "attempt_number": attempt_number,
                },
            )

        raise ValueError(f"Unsupported rule type '{rule.type}'.")

    def _result_from_boolean(
        self,
        *,
        rule: RuleConfig,
        passed: bool,
        message_on_pass: str,
        message_on_fail: str,
        details: dict[str, Any],
    ) -> RuleExecutionResult:
        if passed:
            return RuleExecutionResult(
                outcome="passed",
                action=rule.on_pass,
                message=message_on_pass,
                details=details,
            )
        return RuleExecutionResult(
            outcome="failed",
            action=rule.on_fail,
            message=message_on_fail,
            details=details,
        )

    def _validate_payload(self, workflow: WorkflowConfig, payload: dict[str, Any]) -> list[str]:
        errors: list[str] = []
        for field_name, field_spec in workflow.input_schema.fields.items():
            value = payload.get(field_name)
            if field_spec.required and value is None:
                errors.append(f"Field '{field_name}' is required.")
                continue
            if value is None:
                continue
            type_error = self._validate_type(field_name, field_spec, value)
            if type_error:
                errors.append(type_error)
                continue
            if field_spec.minimum is not None and float(value) < field_spec.minimum:
                errors.append(f"Field '{field_name}' must be >= {field_spec.minimum}.")
            if field_spec.maximum is not None and float(value) > field_spec.maximum:
                errors.append(f"Field '{field_name}' must be <= {field_spec.maximum}.")
            if field_spec.enum is not None and value not in field_spec.enum:
                errors.append(f"Field '{field_name}' must be one of {field_spec.enum}.")
        return errors

    def _validate_type(self, field_name: str, field_spec: FieldSpec, value: Any) -> str | None:
        if field_spec.type == FieldType.STRING and not isinstance(value, str):
            return f"Field '{field_name}' must be a string."
        if field_spec.type == FieldType.INTEGER and (not isinstance(value, int) or isinstance(value, bool)):
            return f"Field '{field_name}' must be an integer."
        if field_spec.type == FieldType.NUMBER and not isinstance(value, (int, float)):
            return f"Field '{field_name}' must be a number."
        if field_spec.type == FieldType.BOOLEAN and not isinstance(value, bool):
            return f"Field '{field_name}' must be a boolean."
        return None

    def _matches_condition(self, condition: Condition, payload: dict[str, Any]) -> bool:
        value = payload.get(condition.field)
        return self._compare(value, condition.operator, condition.value)

    def _compare(self, left: Any, operator: ComparisonOperator | None, right: Any) -> bool:
        if operator is None:
            raise ValueError("Operator is required for comparison rules.")
        if operator == ComparisonOperator.EXISTS:
            return left is not None
        if left is None:
            return False
        if operator == ComparisonOperator.EQ:
            return left == right
        if operator == ComparisonOperator.NE:
            return left != right
        if operator == ComparisonOperator.GT:
            return left > right
        if operator == ComparisonOperator.GTE:
            return left >= right
        if operator == ComparisonOperator.LT:
            return left < right
        if operator == ComparisonOperator.LTE:
            return left <= right
        if operator == ComparisonOperator.IN:
            return left in right
        if operator == ComparisonOperator.NOT_IN:
            return left not in right
        raise ValueError(f"Unsupported operator '{operator.value}'.")

    def _finalize_action(self, action: Action) -> tuple[DecisionStatus, str]:
        if action == Action.APPROVE:
            return DecisionStatus.APPROVED, DecisionStatus.APPROVED.value
        if action == Action.REJECT:
            return DecisionStatus.REJECTED, DecisionStatus.REJECTED.value
        if action == Action.MANUAL_REVIEW:
            return DecisionStatus.MANUAL_REVIEW, DecisionStatus.MANUAL_REVIEW.value
        if action == Action.RETRY:
            return DecisionStatus.RETRY_PENDING, DecisionStatus.RETRY_PENDING.value
        raise ValueError(f"Action '{action.value}' is not terminal.")

    def _hash_payload(self, payload: dict[str, Any]) -> str:
        canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    def _utc_now(self) -> str:
        return datetime.now(UTC).isoformat()
