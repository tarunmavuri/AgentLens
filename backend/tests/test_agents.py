import time

import pytest

from backend.app.agents.base import AgentDefinition
from backend.app.agents.registry import AgentValidationError, agent_registry


def _definition(agent_id: str, **overrides) -> AgentDefinition:
    data = {
        "agent_id": agent_id,
        "name": "Performance Auditor",
        "description": "Analyses algorithm performance and asymptotic efficiency.",
        "role": "Performance Engineer",
        "instructions": "Benchmark performance metrics and profile runtime complexity.",
        "allowed_tools": ["read_memory"],
        "agent_type": "custom",
        "enabled": True,
    }
    data.update(overrides)
    return AgentDefinition(**data)


def test_registry_built_in_agents():
    agents = agent_registry.list_agents()
    ids = {agent.agent_id for agent in agents}
    assert {"planner", "researcher", "coder", "critic"} <= ids
    built_in = {agent.agent_id for agent in agents if agent.agent_type == "built_in"}
    assert {"planner", "researcher", "coder", "critic"} == built_in


def test_custom_agent_crud():
    test_id = f"custom_tester_{int(time.time())}"
    created = agent_registry.create_agent(_definition(test_id))
    assert created.agent_id == test_id
    assert created.name == "Performance Auditor"

    fetched = agent_registry.get_agent(test_id)
    assert fetched is not None and fetched.role == "Performance Engineer"

    updated = agent_registry.update_agent(
        test_id, {"name": "Performance Auditor Pro", "enabled": False}
    )
    assert updated is not None
    assert updated.name == "Performance Auditor Pro"
    assert updated.enabled is False

    assert agent_registry.delete_agent(test_id) is True
    assert agent_registry.get_agent(test_id) is None


def test_cannot_delete_or_disable_builtin_agent():
    assert agent_registry.delete_agent("planner") is False
    assert agent_registry.get_agent("planner") is not None


def test_validation_rejects_bad_configuration():
    with pytest.raises(AgentValidationError):
        agent_registry.create_agent(_definition("bad_model", llm_config={"model": "gpt-4o"}))
    with pytest.raises(AgentValidationError):
        agent_registry.create_agent(_definition("bad_tool", allowed_tools=["rm_rf"]))
    with pytest.raises(AgentValidationError):
        agent_registry.create_agent(
            _definition(
                "bad_limits",
                execution_limits={"max_steps": 0, "timeout_seconds": 1},
            )
        )
    with pytest.raises(AgentValidationError):
        agent_registry.create_agent(_definition("bad_instr", instructions="short"))


def test_update_is_validated():
    agent_id = f"update_validation_{int(time.time())}"
    agent_registry.create_agent(_definition(agent_id))
    try:
        with pytest.raises(AgentValidationError):
            agent_registry.update_agent(agent_id, {"allowed_tools": ["not_a_tool"]})
        assert agent_registry.get_agent(agent_id).allowed_tools == ["read_memory"]
    finally:
        agent_registry.delete_agent(agent_id)


def test_duplicate_agent_id_rejected():
    agent_id = f"duplicate_{int(time.time())}"
    agent_registry.create_agent(_definition(agent_id))
    try:
        with pytest.raises(AgentValidationError):
            agent_registry.create_agent(_definition(agent_id))
    finally:
        agent_registry.delete_agent(agent_id)
