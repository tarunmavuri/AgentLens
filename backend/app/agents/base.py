"""Shared agent contracts: every agent consumes a TaskDefinition and returns an
AgentResult, regardless of whether it is built in or user-configured."""

import time
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from backend.app.events import Usage


class TaskDefinition(BaseModel):
    id: str
    title: str
    description: str
    assigned_agent_id: str
    task_type: str = "general"  # research, code, review, custom
    depends_on: list[str] = Field(default_factory=list)
    success_criteria: str
    expected_output: str = ""


class Plan(BaseModel):
    goal: str
    tasks: list[TaskDefinition] = Field(default_factory=list)
    reasoning: str = ""


class AgentResult(BaseModel):
    agent_id: str
    task_id: str
    status: Literal["completed", "failed"] = "completed"
    summary: str
    structured_output: dict[str, Any] = Field(default_factory=dict)
    artifacts: list[dict[str, Any]] = Field(default_factory=list)
    usage: Usage = Field(default_factory=Usage)
    execution_duration: float = 0.0


class CriticEvaluation(BaseModel):
    score: float = Field(ge=0.0, le=10.0, description="Score from 0 to 10")
    verdict: Literal["accept", "retry"] = "accept"
    feedback: str
    failed_criteria: list[str] = Field(default_factory=list)
    suggested_corrections: list[str] = Field(default_factory=list)


class AgentDefinition(BaseModel):
    agent_id: str
    name: str
    description: str
    role: str
    instructions: str
    llm_config: dict[str, Any] = Field(
        default_factory=lambda: {"model": "gemini-2.5-flash", "temperature": 0.2}
    )
    allowed_tools: list[str] = Field(default_factory=list)
    output_schema: dict[str, Any] = Field(default_factory=dict)
    execution_limits: dict[str, Any] = Field(
        default_factory=lambda: {"max_steps": 5, "timeout_seconds": 60}
    )
    agent_type: Literal["built_in", "custom"] = "custom"
    enabled: bool = True
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)

    @property
    def model(self) -> str:
        return str(self.llm_config.get("model", "gemini-2.5-flash"))

    @property
    def temperature(self) -> float:
        try:
            return float(self.llm_config.get("temperature", 0.2))
        except (TypeError, ValueError):
            return 0.2

    @property
    def max_steps(self) -> int:
        try:
            return int(self.execution_limits.get("max_steps", 5))
        except (TypeError, ValueError):
            return 5

    @property
    def timeout_seconds(self) -> int:
        try:
            return int(self.execution_limits.get("timeout_seconds", 60))
        except (TypeError, ValueError):
            return 60


def tool_permitted(agent_def: Optional[AgentDefinition], tool_name: str) -> bool:
    """Server-side tool permission check.

    Built-in agents keep their historical tool access when no definition is
    supplied; every definition coming from the registry is enforced verbatim.
    """
    if agent_def is None:
        return True
    return tool_name in agent_def.allowed_tools
