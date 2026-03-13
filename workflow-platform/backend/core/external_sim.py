from __future__ import annotations

import random
from dataclasses import dataclass


@dataclass
class ExternalCallResult:
    success: bool
    reason: str


class ExternalDependencySimulator:
    """Simulates dependencies while supporting deterministic test controls."""

    def call(
        self,
        dependency_name: str,
        failure_rate: float,
        *,
        request_id: str,
        attempt: int,
        payload: dict,
    ) -> ExternalCallResult:
        mode = str(payload.get("dependency_mode", "")).lower().strip()
        forced_failures = int(payload.get("force_external_failures", 0) or 0)

        if mode in {"pass", "success"}:
            return ExternalCallResult(success=True, reason=f"{dependency_name} success (forced pass)")

        if mode in {"fail", "always_fail"}:
            return ExternalCallResult(success=False, reason=f"{dependency_name} failure (forced fail)")

        if forced_failures > 0:
            if attempt <= forced_failures:
                return ExternalCallResult(success=False, reason=f"{dependency_name} transient failure (forced #{attempt})")
            return ExternalCallResult(success=True, reason=f"{dependency_name} success after forced failures")

        seed = f"{dependency_name}:{request_id}:{attempt}"
        rng = random.Random(seed)
        if rng.random() < max(0.0, min(1.0, failure_rate)):
            return ExternalCallResult(success=False, reason=f"{dependency_name} simulated failure")

        return ExternalCallResult(success=True, reason=f"{dependency_name} simulated success")
