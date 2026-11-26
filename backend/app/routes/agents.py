"""Agent registry API: CRUD, enable/disable, duplication, history and testing."""

from __future__ import annotations

import asyncio
import re
import time
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from backend.app.agents.base import AgentDefinition, TaskDefinition
from backend.app.agents.registry import (
    SYSTEM_AGENT_IDS,
    AgentValidationError,
    agent_registry,
)
from backend.app.auth import AuthenticatedUser, get_current_user
from backend.app.config import settings
from backend.app.db import db_connection
from backend.app.orchestrator import run_agent_task
from backend.app.tools.memory import RunMemory

router = APIRouter(prefix="/agents", tags=["agents"])


class AgentCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=60)
    description: str = Field(min_length=5, max_length=500)
    role: str = Field(min_length=3, max_length=120)
    instructions: str = Field(min_length=10, max_length=8000)
    llm_config: dict[str, Any] = Field(
        default_factory=lambda: {"model": settings.default_model, "temperature": 0.2}
    )
    allowed_tools: list[str] = Field(default_factory=list)
    output_schema: dict[str, Any] = Field(default_factory=dict)
    execution_limits: dict[str, Any] = Field(
        default_factory=lambda: {"max_steps": 5, "timeout_seconds": 60}
    )
    enabled: bool = True


class AgentUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(default=None, min_length=2, max_length=60)
    description: Optional[str] = Field(default=None, min_length=5, max_length=500)
    role: Optional[str] = Field(default=None, min_length=3, max_length=120)
    instructions: Optional[str] = Field(default=None, min_length=10, max_length=8000)
    llm_config: Optional[dict[str, Any]] = None
    allowed_tools: Optional[list[str]] = None
    output_schema: Optional[dict[str, Any]] = None
    execution_limits: Optional[dict[str, Any]] = None
    enabled: Optional[bool] = None


class TestAgentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    test_prompt: str = Field(min_length=3, max_length=2000)


@router.get("", response_model=list[AgentDefinition])
def list_agents(
    agent_type: Optional[str] = None,
    enabled_only: bool = False,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    return agent_registry.list_agents(
        agent_type=agent_type,
        enabled_only=enabled_only,
        user_id=current_user.uid,
    )


@router.get("/{agent_id}", response_model=AgentDefinition)
def get_agent(
    agent_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    agent = agent_registry.get_agent(agent_id, user_id=current_user.uid)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.post("", response_model=AgentDefinition)
def create_agent(
    req: AgentCreateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    slug = re.sub(r"[^a-zA-Z0-9_]+", "_", req.name.lower()).strip("_") or "agent"
    agent_id = f"{slug[:40]}_{uuid.uuid4().hex[:6]}"

    definition = AgentDefinition(
        agent_id=agent_id,
        user_id=current_user.uid,
        name=req.name.strip(),
        description=req.description.strip(),
        role=req.role.strip(),
        instructions=req.instructions.strip(),
        llm_config=req.llm_config,
        allowed_tools=req.allowed_tools,
        output_schema=req.output_schema,
        execution_limits=req.execution_limits,
        agent_type="custom",
        enabled=req.enabled,
    )
    try:
        return agent_registry.create_agent(definition, user_id=current_user.uid)
    except AgentValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/{agent_id}", response_model=AgentDefinition)
def update_agent(
    agent_id: str,
    req: AgentUpdateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    agent = agent_registry.get_agent(agent_id, user_id=current_user.uid)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    updates = req.model_dump(exclude_unset=True)
    if updates.get("enabled") is False and agent_id in SYSTEM_AGENT_IDS:
        raise HTTPException(
            status_code=400,
            detail=f"'{agent_id}' is required by the orchestrator and cannot be disabled.",
        )
    if agent.user_id != current_user.uid:
        raise HTTPException(
            status_code=403,
            detail="System and template agents cannot be modified directly. Duplicate the agent to customize your own copy.",
        )

    try:
        updated = agent_registry.update_agent(
            agent_id, updates, user_id=current_user.uid
        )
    except AgentValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not updated:
        raise HTTPException(status_code=400, detail="Failed to update agent")
    return updated


@router.delete("/{agent_id}")
def delete_agent(
    agent_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    agent = agent_registry.get_agent(agent_id, user_id=current_user.uid)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.agent_type == "built_in":
        raise HTTPException(status_code=400, detail="Cannot delete built-in agents")
    if agent.user_id != current_user.uid:
        raise HTTPException(status_code=403, detail="Template agents cannot be deleted.")

    return {
        "success": agent_registry.delete_agent(agent_id, user_id=current_user.uid),
        "deleted_agent_id": agent_id,
    }


@router.post("/{agent_id}/duplicate", response_model=AgentDefinition)
def duplicate_agent(
    agent_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    current = agent_registry.get_agent(agent_id, user_id=current_user.uid)
    if not current:
        raise HTTPException(status_code=404, detail="Agent not found")

    copy = current.model_copy(
        update={
            "agent_id": f"{current.agent_id[:40]}_copy_{uuid.uuid4().hex[:4]}",
            "user_id": current_user.uid,
            "name": f"{current.name} (Copy)"[:60],
            "agent_type": "custom",
            "enabled": True,
            "created_at": time.time(),
            "updated_at": time.time(),
        }
    )
    try:
        return agent_registry.create_agent(copy, user_id=current_user.uid)
    except AgentValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{agent_id}/toggle", response_model=AgentDefinition)
def toggle_agent(
    agent_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    current = agent_registry.get_agent(agent_id, user_id=current_user.uid)
    if not current:
        raise HTTPException(status_code=404, detail="Agent not found")
    if current.enabled and agent_id in SYSTEM_AGENT_IDS:
        raise HTTPException(
            status_code=400,
            detail=f"'{agent_id}' is required by the orchestrator and cannot be disabled.",
        )
    if current.user_id != current_user.uid:
        raise HTTPException(
            status_code=403,
            detail="System and template agents cannot be toggled directly. Duplicate the agent to manage your own copy.",
        )

    updated = agent_registry.update_agent(
        agent_id, {"enabled": not current.enabled}, user_id=current_user.uid
    )
    if not updated:  # pragma: no cover - defensive
        raise HTTPException(status_code=400, detail="Failed to toggle agent")
    return updated


@router.get("/{agent_id}/history")
def agent_history(
    agent_id: str,
    limit: int = Query(default=12, ge=1, le=50),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """Recent executions performed by this agent, derived from stored events."""
    agent = agent_registry.get_agent(agent_id, user_id=current_user.uid)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT e.run_id, e.task_id, e.ts, e.type, e.payload_json, r.goal
            FROM events e
            JOIN runs r ON r.id = e.run_id
            WHERE e.agent_id = ? AND (r.user_id = ? OR r.is_public = 1)
            ORDER BY e.ts DESC
            LIMIT 2000
            """,
            (agent_id, current_user.uid),
        ).fetchall()
        critiques = conn.execute(
            """
            SELECT e.run_id, e.task_id, e.payload_json
            FROM events e
            JOIN runs r ON r.id = e.run_id
            WHERE e.type = 'critique' AND (r.user_id = ? OR r.is_public = 1)
            """,
            (current_user.uid,),
        ).fetchall()

    score_lookup: dict[tuple[str, Optional[str]], float] = {}
    for row in critiques:
        try:
            import json

            payload = json.loads(row["payload_json"])
        except Exception:
            continue
        key = (row["run_id"], row["task_id"])
        if isinstance(payload.get("score"), (int, float)):
            score_lookup[key] = float(payload["score"])

    executions: dict[tuple[str, Optional[str]], dict[str, Any]] = {}
    for row in rows:
        key = (row["run_id"], row["task_id"])
        bucket = executions.setdefault(
            key,
            {
                "run_id": row["run_id"],
                "goal": row["goal"],
                "task_id": row["task_id"],
                "status": "running",
                "started_at": row["ts"],
                "finished_at": None,
                "thoughts": 0,
                "tool_calls": 0,
                "events": 0,
                "critic_score": score_lookup.get(key),
            },
        )
        bucket["events"] += 1
        bucket["started_at"] = min(bucket["started_at"], row["ts"])
        if row["type"] == "thought":
            bucket["thoughts"] += 1
        elif row["type"] == "tool_call":
            bucket["tool_calls"] += 1
        elif row["type"] == "agent_finished":
            bucket["finished_at"] = max(bucket["finished_at"] or 0, row["ts"])
            try:
                import json

                payload = json.loads(row["payload_json"])
                bucket["status"] = payload.get("status", "completed")
            except Exception:
                bucket["status"] = "completed"

    ordered = sorted(
        executions.values(),
        key=lambda item: item["finished_at"] or item["started_at"],
        reverse=True,
    )[:limit]
    return {"agent_id": agent_id, "executions": ordered}


@router.post("/{agent_id}/test")
async def test_agent(
    agent_id: str,
    req: TestAgentRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """Execute one task in isolation, outside any orchestrated run."""
    agent = agent_registry.get_agent(agent_id, user_id=current_user.uid)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent_id in SYSTEM_AGENT_IDS:
        raise HTTPException(
            status_code=400,
            detail=f"'{agent_id}' is a system agent and is exercised through full runs, not isolated tests.",
        )
    if not agent.enabled:
        raise HTTPException(
            status_code=400,
            detail="This agent is disabled. Enable it before running a test execution.",
        )

    run_id = f"test-{uuid.uuid4().hex[:10]}"
    events: list[dict[str, Any]] = []

    async def test_emit(
        event_type: str,
        payload: dict[str, Any],
        concept: str,
        task_id: Optional[str],
        usage: Any = None,
    ) -> None:
        events.append(
            {
                "type": event_type,
                "payload": payload,
                "concept": concept,
                "task_id": task_id,
                "usage": usage.model_dump() if usage else None,
            }
        )

    task = TaskDefinition(
        id="test-task",
        title="Agent verification test",
        description=req.test_prompt,
        assigned_agent_id=agent_id,
        success_criteria="Return a clear, role-appropriate answer to the test prompt.",
    )

    try:
        result = await asyncio.wait_for(
            run_agent_task(agent, run_id, task, test_emit),
            timeout=agent.timeout_seconds + 20,
        )
    except asyncio.TimeoutError as exc:
        raise HTTPException(
            status_code=504, detail="Agent test execution timed out."
        ) from exc
    finally:
        # Isolated tests must not leave shared memory behind.
        RunMemory.clear(run_id)

    return {
        "agent_id": agent.agent_id,
        "name": agent.name,
        "result": result.model_dump(),
        "events": events,
    }
