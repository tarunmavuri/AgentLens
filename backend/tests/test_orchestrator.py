import json
import time
import uuid

import pytest

from backend.app.agents.base import AgentDefinition, Plan, TaskDefinition
from backend.app.agents.planner import planner_agent
from backend.app.agents.registry import agent_registry
from backend.app.db import db_connection
from backend.app.events import EventBus
from backend.app.orchestrator import Orchestrator
from backend.app.tools.faults import FaultConfig


def _create_run(run_id: str, goal: str) -> None:
    with db_connection() as conn:
        conn.execute(
            "INSERT INTO runs (id, goal, config_json, status, created_at, totals_json) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (run_id, goal, "{}", "created", time.time(), "{}"),
        )


def _run_status(run_id: str) -> tuple[str, dict]:
    with db_connection() as conn:
        row = conn.execute(
            "SELECT status, totals_json FROM runs WHERE id = ?", (run_id,)
        ).fetchone()
    assert row is not None
    return row["status"], json.loads(row["totals_json"])


def _events(run_id: str):
    return EventBus.fetch_events(run_id)


@pytest.mark.asyncio
async def test_orchestrator_end_to_end():
    run_id = f"test-run-{uuid.uuid4().hex[:8]}"
    goal = "Benchmark three sorting algorithms on 10,000 items and explain the timings"
    _create_run(run_id, goal)

    await Orchestrator(run_id=run_id, goal=goal, config={"max_steps": 40}).run()

    status, totals = _run_status(run_id)
    assert status == "completed"
    assert totals["steps"] > 0
    assert totals["average_critic_score"] is not None

    events = _events(run_id)
    types = [event.type for event in events]
    assert types[0] == "run_started"
    assert "plan_created" in types
    assert "final_answer" in types
    assert types[-1] == "run_finished"

    # Totals must be reproducible from the event log.
    assert totals["in_tokens"] == sum(e.usage.in_tokens for e in events if e.usage)
    assert totals["out_tokens"] == sum(e.usage.out_tokens for e in events if e.usage)
    scores = [
        e.payload["score"] for e in events if e.type == "critique" and "score" in e.payload
    ]
    assert scores
    assert totals["average_critic_score"] == round(sum(scores) / len(scores), 1)

    plan = next(event for event in events if event.type == "plan_created")
    assert plan.payload["tasks"]
    assert all(task["assigned_agent_id"] for task in plan.payload["tasks"])
    assert not [t for t in plan.payload["tasks"] if t["assigned_agent_id"] in {"planner", "critic"}]


@pytest.mark.asyncio
async def test_custom_agent_participates_in_run():
    agent_id = f"custom_auditor_{uuid.uuid4().hex[:6]}"
    agent_registry.create_agent(
        AgentDefinition(
            agent_id=agent_id,
            name="Custom Auditor",
            description="Audits outputs for completeness before delivery.",
            role="Completeness Auditor",
            instructions="Check that each deliverable covers every success criterion.",
            allowed_tools=["read_memory"],
            output_schema={
                "type": "object",
                "properties": {"coverage_score": {"type": "number"}},
            },
            execution_limits={"max_steps": 4, "timeout_seconds": 45},
            agent_type="custom",
            enabled=True,
        )
    )
    run_id = f"test-custom-{uuid.uuid4().hex[:8]}"
    goal = "Audit the internal documentation coverage for the release checklist"
    _create_run(run_id, goal)

    try:
        await Orchestrator(run_id=run_id, goal=goal, config={"max_steps": 40}).run()
        status, _ = _run_status(run_id)
        assert status == "completed"

        custom_events = [e for e in _events(run_id) if e.agent_id == agent_id]
        assert custom_events, "custom agent produced no events"
        assert all(e.agent_category == "custom" for e in custom_events)
        assert any(e.type == "thought" for e in custom_events)
    finally:
        agent_registry.delete_agent(agent_id)


@pytest.mark.asyncio
async def test_disabled_agent_cannot_execute(monkeypatch):
    agent_id = f"disabled_agent_{uuid.uuid4().hex[:6]}"
    agent_registry.create_agent(
        AgentDefinition(
            agent_id=agent_id,
            name="Disabled Agent",
            description="Should never be dispatched.",
            role="Unused",
            instructions="Never used in this test.",
            allowed_tools=[],
            agent_type="custom",
            enabled=False,
        )
    )

    async def fake_plan(goal, available):
        from backend.app.events import Usage

        return (
            Plan(
                goal=goal,
                tasks=[
                    TaskDefinition(
                        id="task-1",
                        title="Should not run",
                        description="Should not run",
                        assigned_agent_id=agent_id,
                        success_criteria="Never",
                    )
                ],
            ),
            Usage(),
        )

    monkeypatch.setattr(planner_agent, "create_plan", fake_plan)

    run_id = f"test-disabled-{uuid.uuid4().hex[:8]}"
    _create_run(run_id, "Attempt to use a disabled agent")
    try:
        await Orchestrator(run_id=run_id, goal="Attempt to use a disabled agent").run()
        events = _events(run_id)
        failures = [e for e in events if e.type == "task_failed"]
        assert failures
        assert "disabled" in failures[0].payload["reason"].lower()
        assert not [e for e in events if e.type == "agent_started"]
        status, _ = _run_status(run_id)
        assert status == "failed"
    finally:
        agent_registry.delete_agent(agent_id)


@pytest.mark.asyncio
async def test_dependency_order_is_respected(monkeypatch):
    from backend.app.events import Usage

    async def fake_plan(goal, available):
        return (
            Plan(
                goal=goal,
                tasks=[
                    TaskDefinition(
                        id="task-2",
                        title="Second step",
                        description="Depends on task-1",
                        assigned_agent_id="researcher",
                        depends_on=["task-1"],
                        success_criteria="Second",
                    ),
                    TaskDefinition(
                        id="task-1",
                        title="First step",
                        description="No dependencies",
                        assigned_agent_id="researcher",
                        depends_on=[],
                        success_criteria="First",
                    ),
                ],
            ),
            Usage(),
        )

    monkeypatch.setattr(planner_agent, "create_plan", fake_plan)
    run_id = f"test-order-{uuid.uuid4().hex[:8]}"
    _create_run(run_id, "Ordered research run")
    await Orchestrator(run_id=run_id, goal="Ordered research run").run()

    started = [e.task_id for e in _events(run_id) if e.type == "task_started"]
    assert started == ["task-1", "task-2"]


@pytest.mark.asyncio
async def test_break_it_fault_is_recorded_and_recovered():
    run_id = f"test-chaos-{uuid.uuid4().hex[:8]}"
    goal = "Compare RAG vs fine-tuning for a customer support bot"
    _create_run(run_id, goal)

    await Orchestrator(
        run_id=run_id,
        goal=goal,
        config={"max_steps": 40},
        fault_config=FaultConfig(enabled=True, target_tool="web_search", mode="empty"),
    ).run()

    events = _events(run_id)
    faults = [e for e in events if e.type == "fault_injected"]
    retries = [e for e in events if e.type == "retry"]
    assert len(faults) == 1, "the fault must be injected exactly once"
    assert retries, "a failed tool result must trigger a critic retry"
    assert retries[0].payload["feedback"]
    status, totals = _run_status(run_id)
    assert status == "completed"
    assert totals["faults_injected"] == 1
    assert totals["retries"] >= 1


@pytest.mark.asyncio
async def test_guardrail_budget_terminates_run():
    run_id = f"test-budget-{uuid.uuid4().hex[:8]}"
    _create_run(run_id, "Benchmark three sorting algorithms on 10,000 items")
    await Orchestrator(
        run_id=run_id, goal="Benchmark three sorting algorithms", config={"max_steps": 2}
    ).run()

    status, _ = _run_status(run_id)
    assert status == "failed"
    events = _events(run_id)
    assert events[-1].type == "run_failed"
    assert "budget" in events[-1].payload["error"].lower()


@pytest.mark.asyncio
async def test_tool_permission_enforced_for_builtin_agent():
    """Removing web_search from the Researcher must prevent any search tool call."""
    original = agent_registry.get_agent("researcher")
    assert original is not None
    agent_registry.update_agent("researcher", {"allowed_tools": ["read_memory"]})
    run_id = f"test-perm-{uuid.uuid4().hex[:8]}"
    goal = "Summarise three evaluation approaches for LLM agents"
    _create_run(run_id, goal)

    try:
        await Orchestrator(run_id=run_id, goal=goal, config={"max_steps": 40}).run()
        events = _events(run_id)
        researcher_tool_calls = [
            e
            for e in events
            if e.agent_id == "researcher" and e.type == "tool_call"
        ]
        assert not researcher_tool_calls
        assert any(
            e.type == "error" and "not permitted" in json.dumps(e.payload)
            for e in events
        )
    finally:
        agent_registry.update_agent(
            "researcher", {"allowed_tools": original.allowed_tools}
        )
