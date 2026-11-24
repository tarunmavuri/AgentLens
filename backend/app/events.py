import asyncio
import json
import time
from typing import Annotated, Any, Literal, Optional
from pydantic import BaseModel, Field
from backend.app.db import get_db_connection

class Usage(BaseModel):
    in_tokens: int = 0
    out_tokens: int = 0
    cost_usd: float = 0.0
    latency_ms: float = 0.0

# Formally enumerated event types. Pydantic validates this at construction.
EventType = Literal[
    # Agent sub-events
    "thought",          # agent reasoning / internal monologue  (concept: react)
    "tool_call",        # agent invokes a tool                  (concept: tool_use)
    "tool_result",      # tool returns a result                 (concept: tool_use)
    "artifact",         # binary output e.g. base64 PNG plot    (concept: tool_use)
    "critique",         # Critic evaluation verdict             (concept: reflection)
    "critic_result",    # Critic verdict summary                (concept: evaluation)
    "memory_write",     # agent wrote to run memory             (concept: memory)
    "memory_read",      # agent read from run memory            (concept: memory)
    # Orchestrator lifecycle events
    "run_started",      # run begins                            (concept: orchestration)
    "plan_created",     # planner produced a plan               (concept: planning)
    "task_started",     # a task enters execution               (concept: orchestration)
    "agent_started",    # an agent begins a task                (concept: orchestration)
    "retry",            # Critic requested a retry              (concept: reflection)
    "task_done",        # a task completed                      (concept: orchestration)
    "agent_finished",   # an agent finished a task              (concept: orchestration)
    "run_finished",     # run completed successfully            (concept: evaluation)
    "run_failed",       # run terminated with an error          (concept: orchestration)
    # Safety / fault injection / budget events
    "guardrail",        # generic guardrail signal              (concept: guardrails)
    "guardrail_warning",# approaching budget limits             (concept: guardrails)
    "fault_injected",   # chaos engineering fault injected     (concept: guardrails)
    # Catch-all lifecycle helpers
    "status",           # general status update                 (concept: orchestration)
    "error",            # non-fatal structured error            (concept: orchestration)
]

class Event(BaseModel):
    id: int
    run_id: str
    ts: float = Field(default_factory=time.time)
    type: EventType  # validated against the enum above
    agent_id: str
    agent_category: str = "built_in"  # built_in, custom, system
    task_id: Optional[str] = None
    payload: dict[str, Any] = Field(default_factory=dict)
    concept: Optional[str] = None  # react, planning, tool_use, reflection, orchestration, memory, guardrails, evaluation
    usage: Optional[Usage] = None

    def to_sse(self) -> str:
        data = self.model_dump_json()
        return f"id: {self.id}\nevent: {self.type}\ndata: {data}\n\n"

class EventBus:
    def __init__(self):
        self._queues: dict[str, list[asyncio.Queue[Event]]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, run_id: str) -> asyncio.Queue[Event]:
        queue: asyncio.Queue[Event] = asyncio.Queue()
        async with self._lock:
            if run_id not in self._queues:
                self._queues[run_id] = []
            self._queues[run_id].append(queue)
        return queue

    async def unsubscribe(self, run_id: str, queue: asyncio.Queue[Event]):
        async with self._lock:
            if run_id in self._queues:
                if queue in self._queues[run_id]:
                    self._queues[run_id].remove(queue)
                if not self._queues[run_id]:
                    del self._queues[run_id]

    async def publish(self, event: Event):
        # 1. Persist to SQLite
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
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
                    json.dumps(event.payload),
                    event.concept,
                    json.dumps(event.usage.model_dump()) if event.usage else None,
                ),
            )
            conn.commit()
        finally:
            conn.close()

        # 2. Dispatch to memory queues
        async with self._lock:
            queues = self._queues.get(event.run_id, []).copy()
        
        for q in queues:
            await q.put(event)

event_bus = EventBus()

