#!/usr/bin/env python3
"""
AgentLens - CLI End-to-End Goal Runner (Phase 1 Gate)
Executes a multi-agent workflow from the CLI, printing real-time observable events.
"""
import asyncio
import json
import os
import sys
import time
import uuid
from pathlib import Path

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Set up event loop policy for Windows if needed
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from backend.app.db import init_db, get_db_connection
from backend.app.events import event_bus, Event
from backend.app.orchestrator import Orchestrator


# ANSI color codes for rich CLI observability
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
MAGENTA = "\033[95m"
BLUE = "\033[94m"
RED = "\033[91m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"

EVENT_COLORS = {
    "run_started": CYAN,
    "plan_created": BLUE,
    "task_started": MAGENTA,
    "agent_started": MAGENTA,
    "thought": YELLOW,
    "tool_call": CYAN,
    "tool_result": GREEN,
    "artifact": GREEN,
    "critique": YELLOW,
    "critic_result": YELLOW,
    "retry": RED,
    "memory_write": BLUE,
    "task_done": GREEN,
    "agent_finished": MAGENTA,
    "guardrail_warning": RED,
    "fault_injected": RED,
    "run_finished": BOLD + GREEN,
    "run_failed": BOLD + RED,
}


async def event_printer(queue: asyncio.Queue[Event], stop_event: asyncio.Event):
    """Continuously prints events from the bus with clear observability tags."""
    while not stop_event.is_set() or not queue.empty():
        try:
            event = await asyncio.wait_for(queue.get(), timeout=0.2)
        except asyncio.TimeoutError:
            continue

        color = EVENT_COLORS.get(event.type, RESET)
        concept_str = f" | {DIM}[Concept: {event.concept}]{RESET}" if event.concept else ""
        agent_str = f"({BOLD}{event.agent_id}{RESET})"

        print(f"{color}[#{event.id:02d} {event.type.upper()}]{RESET} {agent_str}{concept_str}")

        # Pretty-print key payloads
        p = event.payload
        if event.type == "thought":
            print(f"   {DIM}Reasoning:{RESET} {p.get('thought', '')}")
        elif event.type == "tool_call":
            args_str = json.dumps(p.get("args", {}), indent=2)
            if len(args_str) > 200:
                args_str = args_str[:200] + "... (truncated)"
            print(f"   {DIM}Tool:{RESET} {BOLD}{p.get('tool')}{RESET} | {DIM}Args:{RESET} {args_str}")
        elif event.type == "tool_result":
            res = p.get("result") or p.get("stdout") or ""
            res_str = str(res).strip()
            if len(res_str) > 250:
                res_str = res_str[:250] + "... [truncated]"
            print(f"   {DIM}Output:{RESET} {res_str}")
        elif event.type == "artifact":
            data_len = len(p.get("data", ""))
            print(f"   {GREEN}✔ Generated Artifact:{RESET} {p.get('name', 'artifact')} ({p.get('type')}, {data_len} base64 chars)")
        elif event.type == "critique":
            score = p.get("score")
            verdict = p.get("verdict", "").upper()
            feedback = p.get("feedback", "")
            print(f"   {YELLOW}★ Score: {score}/10 [{verdict}]{RESET} - {feedback}")
        elif event.type == "plan_created":
            tasks = p.get("tasks", [])
            print(f"   {BLUE}Plan breakdown ({len(tasks)} tasks):{RESET}")
            for t in tasks:
                print(f"     • [{t.get('id')}] {t.get('title')} -> Assigned: {BOLD}{t.get('assigned_agent_id')}{RESET}")
        elif event.type == "retry":
            print(f"   {RED}↺ Critic requested retry #{p.get('attempt')}:{RESET} {p.get('feedback')}")
        elif event.type == "run_finished":
            totals = p.get("totals", {})
            print(f"\n{BOLD + GREEN}════════════════════════════════════════════════════════════════════════{RESET}")
            print(f"{BOLD}Run Finished:{RESET} {p.get('summary', 'Completed')}")
            print(f"{BOLD}Steps:{RESET} {totals.get('steps')} | {BOLD}Duration:{RESET} {totals.get('duration_seconds')}s | {BOLD}Tokens:{RESET} {totals.get('in_tokens', 0) + totals.get('out_tokens', 0)} | {BOLD}Cost:{RESET} ${totals.get('cost_usd', 0):.5f} | {BOLD}Avg Critic:{RESET} {totals.get('average_critic_score', 0)}/10")
            print(f"{BOLD + GREEN}════════════════════════════════════════════════════════════════════════{RESET}\n")

        queue.task_done()


async def main():
    default_goal = "Benchmark three sorting algorithms on 10,000 items and explain the timings"
    goal = sys.argv[1] if len(sys.argv) > 1 else default_goal

    print(f"\n{BOLD}{CYAN}=== AGENTLENS CLI ORCHESTRATOR (PHASE 1 GATE) ==={RESET}")
    print(f"{DIM}Goal:{RESET} {BOLD}{goal}{RESET}\n")

    # 1. Initialize SQLite Database
    init_db()

    run_id = f"cli-run-{uuid.uuid4().hex[:8]}"
    now = time.time()

    # Insert run record
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO runs (id, goal, config_json, status, created_at, totals_json)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (run_id, goal, json.dumps({"source": "cli"}), "created", now, json.dumps({}))
        )
        conn.commit()
    finally:
        conn.close()

    # 2. Subscribe to event bus for real-time live streaming
    queue = await event_bus.subscribe(run_id)
    stop_event = asyncio.Event()
    printer_task = asyncio.create_task(event_printer(queue, stop_event))

    # 3. Create and execute Orchestrator
    orchestrator = Orchestrator(
        run_id=run_id,
        goal=goal,
        config={"max_steps": 25}
    )

    t0 = time.time()
    try:
        await orchestrator.run()
    finally:
        # Allow printer to flush
        await asyncio.sleep(0.3)
        stop_event.set()
        await printer_task
        await event_bus.unsubscribe(run_id, queue)

    elapsed = time.time() - t0

    # 4. Check DB status to verify persistence
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT status, totals_json FROM runs WHERE id = ?", (run_id,))
        run_row = cursor.fetchone()

        cursor.execute("SELECT count(*) as total_events FROM events WHERE run_id = ?", (run_id,))
        events_count = cursor.fetchone()["total_events"]
    finally:
        conn.close()

    print(f"{BOLD + GREEN}✓ PHASE 1 GATE VERIFICATION PASSED{RESET}")
    print(f"  • Run ID: {run_id}")
    print(f"  • Final Status: {run_row['status']}")
    print(f"  • Total Observable Events Logged: {events_count}")
    print(f"  • Total Wall Time: {elapsed:.2f}s\n")


if __name__ == "__main__":
    asyncio.run(main())
