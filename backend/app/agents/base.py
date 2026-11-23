import time
from typing import Any, Optional, Literal
from pydantic import BaseModel, Field
from backend.app.events import Usage

class TaskDefinition(BaseModel):
    id: str
    title: str
    description: str
    assigned_agent_id: str
    task_type: str = "general" # research, code, review, custom
    depends_on: list[str] = Field(default_factory=list)
    success_criteria: str
    expected_output: str = ""

class Plan(BaseModel):
    goal: str
    tasks: list[TaskDefinition] = Field(default_factory=list)

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
    llm_config: dict[str, Any] = Field(default_factory=lambda: {"model": "gemini-2.5-flash", "temperature": 0.2})
    allowed_tools: list[str] = Field(default_factory=list)
    output_schema: dict[str, Any] = Field(default_factory=dict)
    execution_limits: dict[str, Any] = Field(default_factory=lambda: {"max_steps": 5, "timeout_seconds": 60})
    agent_type: Literal["built_in", "custom"] = "custom"
    enabled: bool = True
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)
