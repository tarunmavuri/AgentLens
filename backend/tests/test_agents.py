import pytest
import time
from backend.app.agents.base import AgentDefinition
from backend.app.agents.registry import agent_registry
from backend.app.db import init_db

@pytest.fixture(autouse=True)
def setup():
    init_db()

def test_registry_built_in_agents():
    agents = agent_registry.list_agents()
    agent_ids = [a.agent_id for a in agents]
    assert "planner" in agent_ids
    assert "researcher" in agent_ids
    assert "coder" in agent_ids
    assert "critic" in agent_ids

def test_custom_agent_crud():
    test_id = f"custom_tester_{int(time.time())}"
    new_agent = AgentDefinition(
        agent_id=test_id,
        name="Performance Auditor",
        description="Analyzes algorithm performance and asymptotic efficiency.",
        role="Performance Engineer",
        instructions="Benchmark performance metrics and profile runtime complexity.",
        allowed_tools=["read_memory"],
        agent_type="custom",
        enabled=True
    )

    # 1. Create
    created = agent_registry.create_agent(new_agent)
    assert created.agent_id == test_id
    assert created.name == "Performance Auditor"

    # 2. Read
    fetched = agent_registry.get_agent(test_id)
    assert fetched is not None
    assert fetched.role == "Performance Engineer"

    # 3. Update
    updated = agent_registry.update_agent(test_id, {"name": "Performance Auditor Pro", "enabled": False})
    assert updated is not None
    assert updated.name == "Performance Auditor Pro"
    assert updated.enabled is False

    # 4. Delete
    deleted = agent_registry.delete_agent(test_id)
    assert deleted is True
    assert agent_registry.get_agent(test_id) is None

def test_cannot_delete_builtin_agent():
    assert agent_registry.delete_agent("planner") is False
    assert agent_registry.get_agent("planner") is not None

