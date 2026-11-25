"""Chaos-engineering fault injector used by the Break-it feature.

Faults are injected at the tool layer, so no agent needs special-case code. A
fault is applied at most once per run (`occurred`), which lets the Critic retry
path recover on the next attempt and makes the recovery observable.
"""

from __future__ import annotations

import asyncio
from typing import Any, Callable, Literal, Optional

from pydantic import BaseModel, Field

FaultMode = Literal["empty", "garbage", "timeout", "wrong_answer"]


class FaultConfig(BaseModel):
    enabled: bool = False
    target_tool: str = "web_search"  # or "*" for every tool
    mode: FaultMode = "wrong_answer"
    occurred: bool = Field(default=False, exclude=True)


class FaultInjector:
    def __init__(self, config: Optional[FaultConfig] = None) -> None:
        self.config = config or FaultConfig()

    async def maybe_inject(
        self, tool_name: str, real_call: Callable[..., Any], **kwargs: Any
    ) -> tuple[Any, bool]:
        """Return (result, fault_injected)."""
        applies_to_tool = (
            self.config.target_tool in (tool_name, "*")
        )
        if not self.config.enabled or self.config.occurred or not applies_to_tool:
            return await real_call(**kwargs), False

        self.config.occurred = True

        if self.config.mode == "empty":
            return ([] if tool_name == "web_search" else ""), True

        if self.config.mode == "garbage":
            if tool_name == "web_search":
                return (
                    [
                        {
                            "title": "Corrupted response",
                            "url": "null://malformed",
                            "snippet": "###ERROR 0xDEADBEEF MALFORMED PAYLOAD###",
                            "provider": "fault-injected",
                        }
                    ],
                    True,
                )
            return "###ERROR: malformed tool output###", True

        if self.config.mode == "timeout":
            await asyncio.sleep(0.2)
            raise TimeoutError(
                f"Simulated network timeout in tool '{tool_name}' (fault injected)"
            )

        # wrong_answer -------------------------------------------------------
        if tool_name == "web_search":
            return (
                [
                    {
                        "title": "Unrelated cached result",
                        "url": "https://example.invalid/fault-injected",
                        "snippet": (
                            "This result is deliberately unrelated to the query and is "
                            "labelled as fault-injected."
                        ),
                        "provider": "fault-injected",
                    }
                ],
                True,
            )
        if tool_name == "python_sandbox":
            from backend.app.tools.sandbox import SandboxResult

            return (
                SandboxResult(
                    success=True,
                    stdout="[INJECTED FAULT] benchmark result: 0.00000001 seconds",
                    stderr="",
                    exit_code=0,
                    duration_ms=10.0,
                    injected_fault=True,
                ),
                True,
            )

        return await real_call(**kwargs), False
