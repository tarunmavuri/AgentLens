"""Programmatic execution budgets (steps, tokens, wall-clock seconds)."""

from __future__ import annotations

import time
from typing import Optional

from pydantic import BaseModel, Field


class GuardrailLimits(BaseModel):
    max_steps: int = 25
    max_tokens: int = 60000
    max_seconds: float = 120.0
    warning_threshold: float = 0.8  # warn at 80%


class GuardrailExceeded(RuntimeError):
    """Raised when a hard budget is exceeded."""


class GuardrailManager:
    def __init__(self, limits: Optional[GuardrailLimits] = None) -> None:
        self.limits = limits or GuardrailLimits()
        self.steps_taken: int = 0
        self.tokens_used: int = 0
        self.start_time: float = time.time()
        self.warnings_emitted: set[str] = set()

    @property
    def elapsed_seconds(self) -> float:
        return time.time() - self.start_time

    def check_step(self) -> tuple[bool, Optional[str]]:
        """Charge one agent action against the budgets."""
        self.steps_taken += 1
        elapsed = self.elapsed_seconds

        if self.steps_taken > self.limits.max_steps:
            return False, (
                f"Step budget exceeded: {self.steps_taken}/{self.limits.max_steps} steps"
            )
        if elapsed > self.limits.max_seconds:
            return False, (
                f"Runtime budget exceeded: {elapsed:.1f}s/{self.limits.max_seconds}s"
            )
        if self.tokens_used > self.limits.max_tokens:
            return False, (
                f"Token budget exceeded: {self.tokens_used}/{self.limits.max_tokens} tokens"
            )
        return True, None

    def add_tokens(self, tokens: int) -> tuple[bool, Optional[str]]:
        self.tokens_used += max(tokens, 0)
        if self.tokens_used > self.limits.max_tokens:
            return False, (
                f"Token budget exceeded: {self.tokens_used}/{self.limits.max_tokens} tokens"
            )
        return True, None

    def check_warnings(self) -> list[str]:
        warnings: list[str] = []
        elapsed = self.elapsed_seconds
        threshold = self.limits.warning_threshold

        if (
            "steps" not in self.warnings_emitted
            and self.steps_taken >= self.limits.max_steps * threshold
        ):
            self.warnings_emitted.add("steps")
            warnings.append(
                f"Approaching step budget ({self.steps_taken}/{self.limits.max_steps} steps)"
            )
        if (
            "tokens" not in self.warnings_emitted
            and self.tokens_used >= self.limits.max_tokens * threshold
        ):
            self.warnings_emitted.add("tokens")
            warnings.append(
                f"Approaching token budget ({self.tokens_used}/{self.limits.max_tokens} tokens)"
            )
        if (
            "time" not in self.warnings_emitted
            and elapsed >= self.limits.max_seconds * threshold
        ):
            self.warnings_emitted.add("time")
            warnings.append(
                f"Approaching runtime budget ({elapsed:.1f}s/{self.limits.max_seconds}s)"
            )
        return warnings

    def snapshot(self) -> dict[str, float | int]:
        return {
            "steps": self.steps_taken,
            "max_steps": self.limits.max_steps,
            "tokens": self.tokens_used,
            "max_tokens": self.limits.max_tokens,
            "elapsed_seconds": round(self.elapsed_seconds, 2),
            "max_seconds": self.limits.max_seconds,
        }
