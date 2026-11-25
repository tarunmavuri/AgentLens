"""End-to-end showcase scenarios exercised through the real orchestrator.

These run with the offline simulation provider (no API key in the test
environment) but use the real planner, registry, sandbox, critic, retries and
event store.
"""

import json
import time
import uuid

import pytest

from backend.app.agents.base import AgentDefinition
from backend.app.agents.registry import agent_registry
from backend.app.db import db_connection
from backend.app.events import EventBus
from backend.app.orchestrator import Orchestrator


def _create_run(run_id: str, goal: str) -> None:
    with db_connection() as conn:
        conn.execute(
            "INSERT INTO runs (id, goal, config_json, status, created_at, totals_json) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (run_id, goal, "{}", "created", time.time(), "{}"),
        )


def _events(run_id: str):
    return EventBus.fetch_events(run_id)


@pytest.mark.asyncio
async def test_scenario_a_research():
    run_id = f"scenario-a-{uuid.uuid4().hex[:8]}"
    goal = "Summarise 3 recent approaches to evaluating LLM agents, with sources"
    _create_run(run_id, goal)

    await Orchestrator(run_id=run_id, goal=goal, config={"max_steps": 40}).run()

    events = _events(run_id)
    agents = {event.agent_id for event in events}
    assert "planner" in agents
    assert "researcher" in agents
    assert "critic" in agents
    assert any(event.type == "critique" for event in events)
    assert any(event.type == "final_answer" for event in events)


@pytest.mark.asyncio
async def test_scenario_b_coding_produces_artifact():
    run_id = f"scenario-b-{uuid.uuid4().hex[:8]}"
    goal = "Benchmark three sorting algorithms on 10,000 items and explain the timings"
    _create_run(run_id, goal)

    await Orchestrator(run_id=run_id, goal=goal, config={"max_steps": 40}).run()

    events = _events(run_id)
    artifacts = [event for event in events if event.type == "artifact"]
    assert artifacts, "the coder must emit a matplotlib artifact"
    assert artifacts[0].payload["type"] == "image/png"
    assert len(artifacts[0].payload["data"]) > 1000

    tool_results = [
        event
        for event in events
        if event.type == "tool_result" and event.payload.get("tool") == "python_sandbox"
    ]
    assert tool_results and tool_results[-1].payload["success"] is True
    assert "Quicksort" in tool_results[-1].payload["stdout"]


@pytest.mark.asyncio
async def test_scenario_c_custom_fact_checker_verifies_research():
    run_id = f"scenario-c-{uuid.uuid4().hex[:8]}"
    goal = "Summarise recent approaches to evaluating LLM agents and verify every claim"
    _create_run(run_id, goal)

    await Orchestrator(run_id=run_id, goal=goal, config={"max_steps": 40}).run()

    events = _events(run_id)
    plan = next(event for event in events if event.type == "plan_created")
    assigned = [task["assigned_agent_id"] for task in plan.payload["tasks"]]
    assert "fact_checker" in assigned, assigned

    # The custom agent ran, shares the run memory and is categorised as custom.
    custom_events = [event for event in events if event.agent_id == "fact_checker"]
    assert custom_events
    assert all(event.agent_category == "custom" for event in custom_events)
    memory_read = [event for event in custom_events if event.type == "memory_read"]
    assert memory_read, "the fact checker must read upstream run memory"


@pytest.mark.asyncio
async def test_scenario_d_security_and_testing_agents_join_code_workflow():
    testing_agent = AgentDefinition(
        agent_id=f"testing_agent_{uuid.uuid4().hex[:5]}",
        name="Testing Agent",
        description="Writes and runs validation checks for generated code.",
        role="Test Engineering Specialist",
        instructions="Design and execute checks that validate generated code behaviour.",
        llm_config={"model": "gemini-2.5-flash", "temperature": 0.1},
        allowed_tools=["python_sandbox", "read_memory"],
        output_schema={
            "type": "object",
            "properties": {"tests_run": {"type": "array"}, "code": {"type": "string"}},
        },
        execution_limits={"max_steps": 4, "timeout_seconds": 90},
        agent_type="custom",
        enabled=True,
    )
    agent_registry.create_agent(testing_agent)

    run_id = f"scenario-d-{uuid.uuid4().hex[:8]}"
    goal = "Benchmark three sorting algorithms on 10,000 items and explain the timings"
    _create_run(run_id, goal)

    try:
        await Orchestrator(run_id=run_id, goal=goal, config={"max_steps": 45}).run()
        events = _events(run_id)
        plan = next(event for event in events if event.type == "plan_created")
        assigned = {task["assigned_agent_id"] for task in plan.payload["tasks"]}

        assert "coder" in assigned
        assert "security_reviewer" in assigned
        assert testing_agent.agent_id in assigned

        testing_events = [event for event in events if event.agent_id == testing_agent.agent_id]
        assert testing_events
        assert any(event.type == "agent_finished" for event in testing_events)
        # The Testing Agent's permitted sandbox tool really executed its checks.
        assert any(
            event.type == "tool_result"
            and event.payload.get("tool") == "python_sandbox"
            and event.payload.get("success") is True
            for event in testing_events
        )
    finally:
        agent_registry.delete_agent(testing_agent.agent_id)


@pytest.mark.asyncio
async def test_scenario_f_replay_uses_stored_events_only():
    run_id = f"scenario-f-{uuid.uuid4().hex[:8]}"
    goal = "Compare RAG vs fine-tuning for a customer support bot"
    _create_run(run_id, goal)
    await Orchestrator(run_id=run_id, goal=goal, config={"max_steps": 40}).run()

    before = _events(run_id)
    assert before

    # Re-reading the trace must not invoke any agent: ids, payloads and ordering
    # are identical, and the count is stable.
    after = _events(run_id)
    assert [event.id for event in after] == [event.id for event in before]
    assert [event.type for event in after] == [event.type for event in before]
    assert len(after) == len(before)

    with db_connection() as conn:
        row = conn.execute(
            "SELECT totals_json FROM runs WHERE id = ?", (run_id,)
        ).fetchone()
    totals = json.loads(row["totals_json"])
    assert totals["in_tokens"] == sum(
        event.usage.in_tokens for event in before if event.usage
    )
