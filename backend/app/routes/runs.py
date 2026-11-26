"""Run lifecycle: create, inspect, stream (SSE) and export traces."""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from typing import Any, AsyncIterator, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from backend.app.agents.registry import agent_registry
from backend.app.auth import AuthenticatedUser, get_current_user
from backend.app.config import settings
from backend.app.db import db_connection, get_db_connection
from backend.app.events import (
    STEP_EVENT_TYPES,
    TERMINAL_EVENT_TYPES,
    Event,
    EventBus,
    event_bus,
)
from backend.app.orchestrator import Orchestrator
from backend.app.tools.faults import FaultConfig

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/runs", tags=["runs"])

TERMINAL_RUN_STATUSES = {"completed", "completed_with_errors", "failed"}


class RunConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    max_steps: int = Field(default=settings.max_steps_default, ge=1, le=100)
    max_tokens: int = Field(default=settings.max_tokens_default, ge=500, le=500_000)
    max_seconds: float = Field(default=settings.max_seconds_default, ge=5, le=900)
    max_retries: int = Field(default=settings.max_retries_default, ge=0, le=5)


class FaultInjectionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: bool = True
    target_tool: str = Field(default="web_search", pattern=r"^(web_search|python_sandbox|\*)$")
    mode: str = Field(default="wrong_answer", pattern=r"^(empty|garbage|timeout|wrong_answer)$")


class CreateRunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    goal: str = Field(min_length=3, max_length=4000)
    config: RunConfig = Field(default_factory=RunConfig)
    fault_injection: Optional[FaultInjectionRequest] = None


class RunSummary(BaseModel):
    id: str
    goal: str
    status: str
    created_at: float
    totals: dict[str, Any]


def _run_row_to_summary(row: Any) -> RunSummary:
    return RunSummary(
        id=row["id"],
        goal=row["goal"],
        status=row["status"],
        created_at=row["created_at"],
        totals=json.loads(row["totals_json"]) if row["totals_json"] else {},
    )


def _get_accessible_run(conn: Any, run_id: str, user_id: str) -> Any:
    row = conn.execute(
        "SELECT * FROM runs WHERE id = ? AND (user_id = ? OR is_public = 1)",
        (run_id, user_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Run not found")
    return row


@router.post("", response_model=dict[str, str])
async def create_run(
    req: CreateRunRequest,
    background_tasks: BackgroundTasks,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    goal = req.goal.strip()
    if not goal:
        raise HTTPException(status_code=400, detail="Goal cannot be empty.")

    if not agent_registry.list_worker_agents(enabled_only=True, user_id=current_user.uid):
        raise HTTPException(
            status_code=400,
            detail=(
                "No worker agents are enabled. Enable the Researcher, the Coder or a "
                "custom agent before starting a run."
            ),
        )

    run_id = f"run-{uuid.uuid4().hex[:10]}"
    config = req.config.model_dump()
    fault_config = (
        FaultConfig(**req.fault_injection.model_dump())
        if req.fault_injection and req.fault_injection.enabled
        else None
    )

    with db_connection() as conn:
        conn.execute(
            """
            INSERT INTO runs (id, user_id, is_public, goal, config_json, status, created_at, totals_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                current_user.uid,
                0,
                goal,
                json.dumps(config),
                "queued",
                time.time(),
                json.dumps({}),
            ),
        )

    orchestrator = Orchestrator(
        run_id=run_id,
        goal=goal,
        config=config,
        fault_config=fault_config,
        user_id=current_user.uid,
    )
    background_tasks.add_task(orchestrator.run)

    return {"run_id": run_id, "status": "queued"}


@router.get("", response_model=list[RunSummary])
def list_runs(
    limit: int = Query(default=100, ge=1, le=500),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    with db_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM runs WHERE user_id = ? OR is_public = 1 ORDER BY created_at DESC LIMIT ?",
            (current_user.uid, limit),
        ).fetchall()
        return [_run_row_to_summary(row) for row in rows]


@router.get("/{run_id}")
def get_run(
    run_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    with db_connection() as conn:
        row = _get_accessible_run(conn, run_id, current_user.uid)
    return {
        "id": row["id"],
        "goal": row["goal"],
        "config": json.loads(row["config_json"]),
        "status": row["status"],
        "created_at": row["created_at"],
        "totals": json.loads(row["totals_json"]) if row["totals_json"] else {},
    }


def _parse_last_event_id(header_value: Optional[str], query_value: Optional[str]) -> int:
    candidate = (header_value or query_value or "").strip()
    if not candidate:
        return 0
    try:
        return max(0, int(candidate))
    except ValueError:
        return 0


@router.get("/{run_id}/events")
async def stream_run_events(
    run_id: str,
    request: Request,
    last_event_id: Optional[str] = Header(default=None, alias="Last-Event-ID"),
    last_event_id_query: Optional[str] = Query(default=None, alias="last_event_id"),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> StreamingResponse:
    """Server-Sent Events with historical catch-up and resumable reconnects.

    Events are read from SQLite first (so a dropped browser connection loses
    nothing), then the live bus is drained. `Last-Event-ID` is honoured, which
    is what the browser's EventSource sends automatically on reconnect.
    """
    with db_connection() as conn:
        run_row = _get_accessible_run(conn, run_id, current_user.uid)

    run_status = run_row["status"]
    resume_from = _parse_last_event_id(last_event_id, last_event_id_query)

    async def event_generator() -> AsyncIterator[str]:
        # Subscribe BEFORE replaying history so no event can slip between the
        # database read and the live subscription.
        queue = (
            None
            if run_status in TERMINAL_RUN_STATUSES
            else await event_bus.subscribe(run_id)
        )
        try:
            yield "retry: 3000\n\n"
            last_sent = resume_from
            for event in EventBus.fetch_events(run_id, resume_from):
                last_sent = event.id
                yield event.to_sse()

            if queue is None:
                return

            while True:
                if await request.is_disconnected():
                    return
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=1.0)
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
                    continue
                if event.id <= last_sent:
                    continue
                last_sent = event.id
                yield event.to_sse()
                if event.type in TERMINAL_EVENT_TYPES:
                    return
        finally:
            if queue is not None:
                await event_bus.unsubscribe(run_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{run_id}/metrics")
def run_metrics(
    run_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """Metrics derived from stored events, plus the orchestrator's own totals.

    The dashboard can therefore show exactly what the event log supports and
    flag any divergence instead of presenting unchecked numbers.
    """
    with db_connection() as conn:
        run_row = _get_accessible_run(conn, run_id, current_user.uid)

    events = EventBus.fetch_events(run_id)
    in_tokens = sum(event.usage.in_tokens for event in events if event.usage)
    out_tokens = sum(event.usage.out_tokens for event in events if event.usage)
    cost_usd = round(sum(event.usage.cost_usd for event in events if event.usage), 6)
    llm_latency = round(
        sum(event.usage.latency_ms for event in events if event.usage), 2
    )

    critic_scores = [
        float(event.payload.get("score", 0))
        for event in events
        if event.type == "critique" and isinstance(event.payload.get("score"), (int, float))
    ]
    agent_breakdown: dict[str, dict[str, Any]] = {}
    for event in events:
        if event.agent_id in ("system", "") or event.agent_category == "system":
            continue
        bucket = agent_breakdown.setdefault(
            event.agent_id,
            {
                "agent_id": event.agent_id,
                "agent_category": event.agent_category,
                "events": 0,
                "thoughts": 0,
                "tool_calls": 0,
                "in_tokens": 0,
                "out_tokens": 0,
                "cost_usd": 0.0,
            },
        )
        bucket["events"] += 1
        if event.type == "thought":
            bucket["thoughts"] += 1
        if event.type == "tool_call":
            bucket["tool_calls"] += 1
        if event.usage:
            bucket["in_tokens"] += event.usage.in_tokens
            bucket["out_tokens"] += event.usage.out_tokens
            bucket["cost_usd"] = round(bucket["cost_usd"] + event.usage.cost_usd, 6)

    first_ts = events[0].ts if events else run_row["created_at"]
    last_ts = events[-1].ts if events else run_row["created_at"]
    recorded = json.loads(run_row["totals_json"]) if run_row["totals_json"] else {}

    return {
        "run_id": run_id,
        "status": run_row["status"],
        "goal": run_row["goal"],
        "computed": {
            "in_tokens": in_tokens,
            "out_tokens": out_tokens,
            "total_tokens": in_tokens + out_tokens,
            "cost_usd": cost_usd,
            "llm_latency_ms": llm_latency,
            "steps": sum(1 for event in events if event.type in STEP_EVENT_TYPES),
            "events": len(events),
            "tool_calls": sum(1 for event in events if event.type == "tool_call"),
            "retries": sum(1 for event in events if event.type == "retry"),
            "faults_injected": sum(1 for event in events if event.type == "fault_injected"),
            "critic_scores": critic_scores,
            "average_critic_score": (
                round(sum(critic_scores) / len(critic_scores), 2) if critic_scores else None
            ),
            "tasks_started": sum(1 for event in events if event.type == "task_started"),
            "tasks_completed": sum(1 for event in events if event.type == "task_done"),
            "tasks_failed": sum(1 for event in events if event.type == "task_failed"),
            "wall_clock_seconds": round(last_ts - first_ts, 2),
            "agents": sorted(agent_breakdown.values(), key=lambda item: item["agent_id"]),
        },
        "recorded": recorded,
        "event_range": {
            "first_id": events[0].id if events else None,
            "last_id": events[-1].id if events else None,
        },
    }


@router.get("/{run_id}/trace")
def export_run_trace(
    run_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    with db_connection() as conn:
        run_row = _get_accessible_run(conn, run_id, current_user.uid)
        events = EventBus.fetch_events(run_id)
        config = json.loads(run_row["config_json"])

    return {
        "schema_version": 2,
        "exported_at": time.time(),
        "run_id": run_row["id"],
        "goal": run_row["goal"],
        "status": run_row["status"],
        "created_at": run_row["created_at"],
        "config": config,
        "totals": json.loads(run_row["totals_json"]) if run_row["totals_json"] else {},
        "events_count": len(events),
        "events": [event.model_dump() for event in events],
    }
