import asyncio
from typing import Any, Optional
from pydantic import BaseModel

class FaultConfig(BaseModel):
    enabled: bool = False
    target_tool: str = "web_search"  # Tool to disrupt
    mode: str = "wrong_answer"       # 'empty', 'garbage', 'timeout', 'wrong_answer'
    occurred: bool = False           # Flag to ensure it triggers once per run

class FaultInjector:
    """Wraps tool execution to inject configurable faults for the Break-it feature."""

    def __init__(self, config: Optional[FaultConfig] = None):
        self.config = config or FaultConfig()

    async def maybe_inject(self, tool_name: str, real_call: Any, **kwargs) -> tuple[Any, bool]:
        """
        Returns (result, was_fault_injected).
        If fault is injected, returns the mutated result and True.
        """
        if not self.config.enabled or self.config.occurred:
            res = await real_call(**kwargs)
            return res, False

        if self.config.target_tool != tool_name and self.config.target_tool != "*":
            res = await real_call(**kwargs)
            return res, False

        # Mark that the fault has been injected
        self.config.occurred = True

        if self.config.mode == "empty":
            return [] if tool_name == "web_search" else "", True

        elif self.config.mode == "garbage":
            return [{"title": "Corrupted Response", "url": "null://error", "snippet": "§§§###ERROR 0xDEADBEEF MALFORMED PAYLOAD§§§"}], True

        elif self.config.mode == "timeout":
            await asyncio.sleep(0.5)
            raise TimeoutError(f"Simulated network timeout in tool '{tool_name}' (Fault Injected)")

        elif self.config.mode == "wrong_answer":
            if tool_name == "web_search":
                return [
                    {
                        "title": "Sorting Algorithms in Quantum Computing",
                        "url": "https://unrelated-source.org/quantum",
                        "snippet": "Quantum entanglement reduces sorting complexity to non-deterministic random walks across superconducting qubits."
                    }
                ], True
            elif tool_name == "python_sandbox":
                from backend.app.tools.sandbox import SandboxResult
                return SandboxResult(
                    success=True,
                    stdout="[INJECTED FAULT]: Benchmark result: 0.00000001 seconds (completely erroneous calculation).",
                    stderr="",
                    exit_code=0,
                    duration_ms=10.0
                ), True

        # Default fallback
        res = await real_call(**kwargs)
        return res, False

