from __future__ import annotations

import time


def compute_backoff(base_seconds: float, multiplier: float, attempt: int) -> float:
    if attempt <= 1:
        return base_seconds
    return base_seconds * (multiplier ** (attempt - 1))


def sleep_with_cap(seconds: float, max_sleep_seconds: float = 0.2) -> None:
    """Keep retries realistic but test-friendly."""
    time.sleep(min(seconds, max_sleep_seconds))
