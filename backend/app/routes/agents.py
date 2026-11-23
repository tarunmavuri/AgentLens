import re
import time
import uuid
from typing import Optional, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from backend.app.agents.base import AgentDefinition, TaskDefinition
from backend.app.agents.registry import agent_registry
from backend.app.agents.custom_agent import CustomAgentRunner

router = APIRouter(prefix="/agents", tags=["agents"])

class AgentCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    description: str = Field(min_length=5, max_length=250)
    role: str = Field(min_length=3, max_length=80)
    instructions: str = Field(min_length=10)
    llm_config: dict[str, Any] = Field(default_factory=lambda: {"model": "gemini-2.5-flash", "temperature": 0.2})
    allowed_tools: list[str] = Field(default_factory=list)
    output_schema: dict[str, Any] = Field(default_factory=dict)
    execution_limits: dict[str, Any] = Field(default_factory=lambda: {"max_steps": 5, "timeout_seconds": 60})
    enabled: bool = True

class AgentUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    role: Optional[str] = None
    instructions: Optional[str] = None
    llm_config: Optional[dict[str, Any]] = None
    allowed_tools: Optional[list[str]] = None
    output_schema: Optional[dict[str, Any]] = None
    execution_limits: Optional[dict[str, Any]] = None
    enabled: Optional[bool] = None

class TestAgentRequest(BaseModel):
    test_prompt: str = Field(min_length=3)

@router.get("", response_model=list[AgentDefinition])
def list_agents(agent_type: Optional[str] = None, enabled_only: bool = False):
    return agent_registry.list_agents(agent_type=agent_type, enabled_only=enabled_only)

@router.get("/{agent_id}", response_model=AgentDefinition)
def get_agent(agent_id: str):
    agent = agent_registry.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent

@router.post("", response_model=AgentDefinition)
def create_agent(req: AgentCreateRequest):
    # Generate clean ID
    slug = re.sub(r"[^a-zA-Z0-9_]+", "_", req.name.lower()).strip("_")
    unique_id = f"{slug}_{uuid.uuid4().hex[:6]}"

    definition = AgentDefinition(
        agent_id=unique_id,
        name=req.name,
        description=req.description,
        role=req.role,
        instructions=req.instructions,
        llm_config=req.llm_config,
        allowed_tools=req.allowed_tools,
        output_schema=req.output_schema,
        execution_limits=req.execution_limits,
        agent_type="custom",
        enabled=req.enabled,
        created_at=time.time(),
        updated_at=time.time()
    )

    created = agent_registry.create_agent(definition)
    return created

@router.put("/{agent_id}", response_model=AgentDefinition)
def update_agent(agent_id: str, req: AgentUpdateRequest):
    current = agent_registry.get_agent(agent_id)
    if not current:
        raise HTTPException(status_code=404, detail="Agent not found")

    updates = req.model_dump(exclude_unset=True)
    updated = agent_registry.update_agent(agent_id, updates)
    if not updated:
        raise HTTPException(status_code=400, detail="Failed to update agent")
    return updated

@router.delete("/{agent_id}")
def delete_agent(agent_id: str):
    agent = agent_registry.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.agent_type == "built_in":
        raise HTTPException(status_code=400, detail="Cannot delete built-in agents")

    success = agent_registry.delete_agent(agent_id)
    return {"success": success, "deleted_agent_id": agent_id}

@router.post("/{agent_id}/duplicate", response_model=AgentDefinition)
def duplicate_agent(agent_id: str):
    current = agent_registry.get_agent(agent_id)
    if not current:
        raise HTTPException(status_code=404, detail="Agent not found")

    new_id = f"{current.agent_id}_copy_{uuid.uuid4().hex[:4]}"
    copy_agent = AgentDefinition(
        agent_id=new_id,
        name=f"{current.name} (Copy)",
        description=current.description,
        role=current.role,
        instructions=current.instructions,
        llm_config=current.llm_config,
        allowed_tools=current.allowed_tools,
        output_schema=current.output_schema,
        execution_limits=current.execution_limits,
        agent_type="custom",
        enabled=True,
        created_at=time.time(),
        updated_at=time.time()
    )

    return agent_registry.create_agent(copy_agent)

@router.post("/{agent_id}/toggle", response_model=AgentDefinition)
def toggle_agent(agent_id: str):
    current = agent_registry.get_agent(agent_id)
    if not current:
        raise HTTPException(status_code=404, detail="Agent not found")

    updated = agent_registry.update_agent(agent_id, {"enabled": not current.enabled})
    return updated

@router.post("/{agent_id}/test")
async def test_agent(agent_id: str, req: TestAgentRequest):
    agent = agent_registry.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    events: list[dict[str, Any]] = []

    async def test_emit(event_type: str, payload: dict[str, Any], concept: str, task_id: str | None, usage: Any = None):
        events.append({"type": event_type, "payload": payload, "concept": concept, "usage": usage.model_dump() if usage else None})

    test_task = TaskDefinition(
        id="test-task",
        title="Agent Verification Test",
        description=req.test_prompt,
        assigned_agent_id=agent_id,
        success_criteria="Return clear and relevant analysis matching configured role."
    )

    runner = CustomAgentRunner(agent)
    result = await runner.execute_task(
        run_id="test-session",
        task=test_task,
        emit_event=test_emit
    )

    return {
        "agent_id": agent.agent_id,
        "name": agent.name,
        "result": result.model_dump(),
        "events": events
    }

