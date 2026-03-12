from __future__ import annotations

from dataclasses import dataclass
from typing import Any


class DependencyError(RuntimeError):
    pass


class TransientDependencyError(DependencyError):
    pass


@dataclass(frozen=True)
class DependencyOutcome:
    outcome: str
    message: str
    reference: str


class ExternalDependencyGateway:
    def evaluate(self, dependency_name: str, payload: dict[str, Any], attempt_number: int) -> DependencyOutcome:
        if dependency_name != "fraud_service":
            raise DependencyError(f"Unsupported dependency '{dependency_name}'.")

        entity_id = str(
            payload.get("applicant_id")
            or payload.get("claim_id")
            or payload.get("vendor_id")
            or payload.get("employee_id")
            or payload.get("document_id")
            or "unknown"
        )
        dependency_mode = payload.get("dependency_mode", "pass")

        if dependency_mode == "transient_error" and attempt_number == 0:
            raise TransientDependencyError("Simulated transient dependency timeout from fraud_service.")

        if dependency_mode == "fail" or payload.get("fraud_flag") is True:
            return DependencyOutcome(
                outcome="fail",
                message="fraud_service flagged the request as suspicious.",
                reference=f"fraud_service:{entity_id}:fail",
            )

        return DependencyOutcome(
            outcome="pass",
            message="fraud_service cleared the request.",
            reference=f"fraud_service:{entity_id}:pass",
        )
