import pytest
import asyncio
import time
import uuid
import json
from backend.app.orchestrator import Orchestrator
from backend.app.tools.faults import FaultConfig
from backend.app.db import init_db, get_db_connection

@pytest.fixture(autouse=True)
def setup():
    init_db()

@pytest.mark.asyncio
async def test_orchestrator_end_to_end():
    run_id = f"test-run-{uuid.uuid4().hex[:8]}"
    
    # Insert initial run record
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO runs (id, goal, config_json, status, created_at, totals_json) VALUES (?, ?, ?, ?, ?, ?)",
        (run_id, "Benchmark three sorting algorithms on 10,000 items and explain the timings", "{}", "created", time.time(), "{}")
    )
    conn.commit()
    conn.close()

    orchestrator = Orchestrator(
        run_id=run_id,
        goal="Benchmark three sorting algorithms on 10,000 items and explain the timings",
        config={"max_steps": 25}
    )

    await orchestrator.run()

    # Verify run completed in DB
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT status, totals_json FROM runs WHERE id = ?", (run_id,))
    row = cursor.fetchone()
    conn.close()

    assert row is not None
    assert row["status"] == "completed"
    totals = json.loads(row["totals_json"])
    assert totals["steps"] > 0
    assert totals["duration_seconds"] >= 0

    # Verify events were persisted
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT count(*) as cnt FROM events WHERE run_id = ?", (run_id,))
    cnt = cursor.fetchone()["cnt"]
    conn.close()
    assert cnt >= 6

@pytest.mark.asyncio
async def test_orchestrator_with_custom_agent_and_break_it():
    run_id = f"test-chaos-{uuid.uuid4().hex[:8]}"
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO runs (id, goal, config_json, status, created_at, totals_json) VALUES (?, ?, ?, ?, ?, ?)",
        (run_id, "Compare RAG vs fine-tuning for customer support", "{}", "created", time.time(), "{}")
    )
    conn.commit()
    conn.close()

    # Enable fault injection
    fault_config = FaultConfig(enabled=True, target_tool="web_search", mode="empty")

    orchestrator = Orchestrator(
        run_id=run_id,
        goal="Compare RAG vs fine-tuning for a customer-support bot and back it up with a small code experiment",
        config={"max_steps": 25},
        fault_config=fault_config
    )

    await orchestrator.run()

    # Verify fault_injected event exists
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT count(*) as cnt FROM events WHERE run_id = ? AND type = 'fault_injected'", (run_id,))
    fault_cnt = cursor.fetchone()["cnt"]
    conn.close()

    assert fault_cnt == 1

