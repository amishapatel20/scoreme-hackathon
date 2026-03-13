from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from config.loader import RuleConfig


@dataclass
class RuleResult:
    passed: bool
    action: str
    actual_value: Any
    explanation: str


class RuleEvaluator:
    @staticmethod
    def evaluate(rule: RuleConfig, payload: dict[str, Any]) -> RuleResult:
        actual = payload.get(rule.field)
        passed = compare_values(actual, rule.operator, rule.value)
        if passed:
            return RuleResult(
                passed=True,
                action="continue",
                actual_value=actual,
                explanation=f"PASS - {rule.explanation}",
            )

        return RuleResult(
            passed=False,
            action=rule.action_on_fail,
            actual_value=actual,
            explanation=rule.explanation,
        )


def compare_values(actual: Any, operator: str, expected: Any) -> bool:
    if operator == "eq":
        return actual == expected
    if operator == "neq":
        return actual != expected
    if operator == "gt":
        return actual is not None and actual > expected
    if operator == "gte":
        return actual is not None and actual >= expected
    if operator == "lt":
        return actual is not None and actual < expected
    if operator == "lte":
        return actual is not None and actual <= expected
    if operator == "contains":
        if actual is None:
            return False
        return str(expected) in str(actual)
    if operator == "regex":
        if actual is None:
            return False
        return re.search(str(expected), str(actual)) is not None
    return False
