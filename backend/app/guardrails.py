import time
from typing import Optional
from pydantic import BaseModel, Field

class GuardrailLimits(BaseModel):
    max_steps: int = 25
    max_tokens: int = 60000
    max_seconds: float = 120.0
    warning_threshold: float = 0.8  # 80%

class GuardrailManager:
    def __init__(self, limits: Optional[GuardrailLimits] = None):
        self.limits = limits or GuardrailLimits()
        self.steps_taken: int = 0
        self.tokens_used: int = 0
        self.start_time: float = time.time()
        self.warnings_emitted: set[str] = set()

    def check_step(self) -> tuple[bool, Optional[str]]:
        """Returns (is_ok, error_message_or_none)"""
        self.steps_taken += 1
        elapsed = time.time() - self.start_time

        if self.steps_taken > self.limits.max_steps:
            return False, f"Maximum steps exceeded: {self.steps_taken}/{self.limits.max_steps}"
        if elapsed > self.limits.max_seconds:
            return False, f"Maximum runtime exceeded: {elapsed:.1f}s/{self.limits.max_seconds}s"
        if self.tokens_used > self.limits.max_tokens:
            return False, f"Maximum tokens exceeded: {self.tokens_used}/{self.limits.max_tokens}"

        return True, None

    def add_tokens(self, tokens: int) -> tuple[bool, Optional[str]]:
        self.tokens_used += tokens
        if self.tokens_used > self.limits.max_tokens:
            return False, f"Token limit reached: {self.tokens_used}/{self.limits.max_tokens}"
        return True, None

    def check_warnings(self) -> list[str]:
        warnings = []
        elapsed = time.time() - self.start_time

        if "steps" not in self.warnings_emitted and self.steps_taken >= self.limits.max_steps * self.limits.warning_threshold:
            self.warnings_emitted.add("steps")
            warnings.append(f"Approaching step budget ({self.steps_taken}/{self.limits.max_steps} steps)")

        if "tokens" not in self.warnings_emitted and self.tokens_used >= self.limits.max_tokens * self.limits.warning_threshold:
            self.warnings_emitted.add("tokens")
            warnings.append(f"Approaching token budget ({self.tokens_used}/{self.limits.max_tokens} tokens)")

        if "time" not in self.warnings_emitted and elapsed >= self.limits.max_seconds * self.limits.warning_threshold:
            self.warnings_emitted.add("time")
            warnings.append(f"Approaching runtime budget ({elapsed:.1f}s/{self.limits.max_seconds}s)")

        return warnings

