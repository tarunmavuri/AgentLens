"""Typed, persisted execution events and the in-process fan-out bus."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from backend.app.db import get_db_connection

logger = logging.getLogger(__name__)


class Usage(BaseModel):
    in_tokens: int = 0
    out_tokens: int = 0
    cost_usd: float = 0.0
    latency_ms: float = 0.0
    model: Optional[str] = None


EventType = Literal[
    # Agent sub-events
    "thought",
    "tool_call",
    "tool_result",
    "artifact",
    "critique",
    "critic_result",
    "memory_write",
    "memory_read",
    # Orchestrator lifecycle events
    "run_started",
    "plan_created",
    "task_started",
    "agent_started",
    "retry",
    "task_done",
    "task_failed",
    "agent_finished",
    "final_answer",
    "run_finished",
    "run_failed",
    # Safety / fault injection / budget events
    "guardrail",
    "guardrail_warning",
    "fault_injected",
    # Catch-all lifecycle helpers
    "status",
    "error",
]

# Only actions an agent actually takes consume the step budget. Lifecycle
# bookkeeping (task_started, task_done, memory_write, ...) does not, otherwise
# the step cap would measure logging volume instead of agent effort.
STEP_EVENT_TYPES = frozenset(
    {"plan_created", "thought", "tool_call", "critique", "final_answer"}
)

TERMINAL_EVENT_TYPES = frozenset({"run_finished", "run_failed"})


class Event(BaseModel):
    id: int
    run_id: str
    ts: float = Field(default_factory=time.time)
    type: EventType
    agent_id: str
    agent_category: str = "built_in"  # built_in, custom, system
    task_id: Optional[str] = None
    payload: dict[str, Any] = Field(default_factory=dict)
    concept: Optional[str] = None
    usage: Optional[Usage] = None

    def to_sse(self) -> str:
        # Deliberately unnamed (`message`) events: EventSource.onmessage only
        # fires for unnamed events, and every client needs all event types.
        # The type lives in the JSON payload and controls the SSE `id:` cursor.
        data = self.model_dump_json()
        return f"id: {self.id}\ndata: {data}\n\n"

    @classmethod
    def from_row(cls, row: Any) -> "Event":
        usage_raw = row["usage_json"]
        return cls(
            id=row["id"],
            run_id=row["run_id"],
            ts=row["ts"],
            type=row["type"],
            agent_id=row["agent_id"],
            agent_category=row["agent_category"],
            task_id=row["task_id"],
            payload=json.loads(row["payload_json"]),
            concept=row["concept"],
            usage=Usage(**json.loads(usage_raw)) if usage_raw else None,
        )


class EventBus:
    """Persists every event first, then fans it out to live SSE subscribers."""

    def __init__(self) -> None:
        self._queues: dict[str, list[asyncio.Queue[Event]]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, run_id: str) -> asyncio.Queue[Event]:
        queue: asyncio.Queue[Event] = asyncio.Queue()
        async with self._lock:
            self._queues.setdefault(run_id, []).append(queue)
        return queue

    async def unsubscribe(self, run_id: str, queue: asyncio.Queue[Event]) -> None:
        async with self._lock:
            queues = self._queues.get(run_id)
            if not queues:
                return
            if queue in queues:
                queues.remove(queue)
            if not queues:
                self._queues.pop(run_id, None)

    async def publish(self, event: Event) -> None:
        # SQLite writes are blocking; keep them off the event loop so SSE
        # streaming and other runs stay responsive.
        await asyncio.to_thread(self._persist, event)

        async with self._lock:
            queues = list(self._queues.get(event.run_id, ()))

        for queue in queues:
            await queue.put(event)

    @staticmethod
    def _persist(event: Event) -> None:
        conn = get_db_connection()
        try:
            conn.execute(
                """
                INSERT OR REPLACE INTO events
                (run_id, id, ts, type, agent_id, agent_category, task_id, payload_json, concept, usage_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    event.run_id,
                    event.id,
                    event.ts,
                    event.type,
                    event.agent_id,
                    event.agent_category,
                    event.task_id,
                    json.dumps(event.payload, default=str),
                    event.concept,
                    json.dumps(event.usage.model_dump()) if event.usage else None,
                ),
            )
            conn.commit()
        except Exception:  # pragma: no cover - storage failure must be visible
            logger.exception("Failed to persist event %s for run %s", event.id, event.run_id)
            raise
        finally:
            conn.close()

    @staticmethod
    def fetch_events(run_id: str, after_id: int = 0) -> list[Event]:
        conn = get_db_connection()
        try:
            rows = conn.execute(
                "SELECT * FROM events WHERE run_id = ? AND id > ? ORDER BY id ASC",
                (run_id, after_id),
            ).fetchall()
            return [Event.from_row(row) for row in rows]
        finally:
            conn.close()


event_bus = EventBus()
