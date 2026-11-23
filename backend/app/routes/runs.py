import asyncio
import json
import time
import uuid
from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Header, Request, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from backend.app.db import get_db_connection
from backend.app.events import event_bus, Event
from backend.app.orchestrator import Orchestrator
from backend.app.tools.faults import FaultConfig

router = APIRouter(prefix="/runs", tags=["runs"])

class CreateRunRequest(BaseModel):
    goal: str
    config: dict[str, Any] = Field(default_factory=dict)
    fault_injection: Optional[FaultConfig] = None

class RunSummary(BaseModel):
    id: str
    goal: str
    status: str
    created_at: float
    totals: dict[str, Any]

@router.post("", response_model=dict[str, str])
async def create_run(req: CreateRunRequest, background_tasks: BackgroundTasks):
    if not req.goal or not req.goal.strip():
        raise HTTPException(status_code=400, detail="Goal cannot be empty")

    run_id = f"run-{uuid.uuid4().hex[:10]}"
    now = time.time()

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO runs (id, goal, config_json, status, created_at, totals_json)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (run_id, req.goal, json.dumps(req.config), "queued", now, json.dumps({}))
        )
        conn.commit()
    finally:
        conn.close()

    orchestrator = Orchestrator(
        run_id=run_id,
        goal=req.goal,
        config=req.config,
        fault_config=req.fault_injection
    )

    # Execute in background task
    background_tasks.add_task(orchestrator.run)

    return {"run_id": run_id, "status": "queued"}

@router.get("", response_model=list[RunSummary])
def list_runs():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM runs ORDER BY created_at DESC")
        rows = cursor.fetchall()
        return [
            RunSummary(
                id=r["id"],
                goal=r["goal"],
                status=r["status"],
                created_at=r["created_at"],
                totals=json.loads(r["totals_json"]) if r["totals_json"] else {}
            )
            for r in rows
        ]
    finally:
        conn.close()

@router.get("/{run_id}")
def get_run(run_id: str):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM runs WHERE id = ?", (run_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Run not found")
        return {
            "id": row["id"],
            "goal": row["goal"],
            "config": json.loads(row["config_json"]),
            "status": row["status"],
            "created_at": row["created_at"],
            "totals": json.loads(row["totals_json"]) if row["totals_json"] else {}
        }
    finally:
        conn.close()

@router.get("/{run_id}/events")
async def stream_run_events(
    run_id: str,
    request: Request,
    last_event_id: Optional[str] = Header(None, alias="Last-Event-ID")
):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT status FROM runs WHERE id = ?", (run_id,))
    run_row = cursor.fetchone()
    conn.close()

    if not run_row:
        raise HTTPException(status_code=404, detail="Run not found")

    is_completed = run_row["status"] in ["completed", "failed"]

    async def event_generator():
        last_id = int(last_event_id) if last_event_id and last_event_id.isdigit() else 0

        # 1. Catch up on all historical events from DB starting from last_id
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT * FROM events 
            WHERE run_id = ? AND id > ? 
            ORDER BY id ASC
            """,
            (run_id, last_id)
        )
        stored_rows = cursor.fetchall()
        conn.close()

        for row in stored_rows:
            event = Event(
                id=row["id"],
                run_id=row["run_id"],
                ts=row["ts"],
                type=row["type"],
                agent_id=row["agent_id"],
                agent_category=row["agent_category"],
                task_id=row["task_id"],
                payload=json.loads(row["payload_json"]),
                concept=row["concept"],
                usage=json.loads(row["usage_json"]) if row["usage_json"] else None
            )
            last_id = event.id
            yield event.to_sse()

        # If already completed, finish stream
        if is_completed:
            return

        # 2. Subscribe to live bus queue
        queue = await event_bus.subscribe(run_id)
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=1.0)
                    if event.id > last_id:
                        last_id = event.id
                        yield event.to_sse()
                        if event.type in ["run_finished", "run_failed"]:
                            break
                except asyncio.TimeoutError:
                    # Keep-alive ping
                    yield ": ping\n\n"
        finally:
            await event_bus.unsubscribe(run_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.get("/{run_id}/trace")
def export_run_trace(run_id: str):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM runs WHERE id = ?", (run_id,))
        run_row = cursor.fetchone()
        if not run_row:
            raise HTTPException(status_code=404, detail="Run not found")

        cursor.execute("SELECT * FROM events WHERE run_id = ? ORDER BY id ASC", (run_id,))
        event_rows = cursor.fetchall()

        events_data = [
            {
                "id": r["id"],
                "run_id": r["run_id"],
                "ts": r["ts"],
                "type": r["type"],
                "agent_id": r["agent_id"],
                "agent_category": r["agent_category"],
                "task_id": r["task_id"],
                "payload": json.loads(r["payload_json"]),
                "concept": r["concept"],
                "usage": json.loads(r["usage_json"]) if r["usage_json"] else None
            }
            for r in event_rows
        ]

        return {
            "run_id": run_row["id"],
            "goal": run_row["goal"],
            "status": run_row["status"],
            "created_at": run_row["created_at"],
            "config": json.loads(run_row["config_json"]),
            "totals": json.loads(run_row["totals_json"]) if run_row["totals_json"] else {},
            "events_count": len(events_data),
            "events": events_data
        }
    finally:
        conn.close()

