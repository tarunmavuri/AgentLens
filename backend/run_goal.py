#!/usr/bin/env python3
"""AgentLens CLI goal runner.

Executes one real multi-agent workflow and prints every persisted event as it
happens, then verifies the stored run. Exit code is non-zero unless the run
actually finished, so it can be used as a smoke test:

    python backend/run_goal.py "Summarise RAG evaluation methods"

Add --mock to run without a Gemini key (offline simulation, clearly labelled).
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
import uuid
from pathlib import Path

# The Windows console often defaults to cp1252, which cannot encode the
# status glyphs used below.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
except (AttributeError, ValueError):
    pass

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from backend.app.agents.registry import seed_default_agents
from backend.app.db import db_connection, init_db
from backend.app.events import Event, event_bus
from backend.app.golden_runs import seed_golden_runs
from backend.app.orchestrator import Orchestrator

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
    "agent_finished": MAGENTA,
    "thought": YELLOW,
    "tool_call": CYAN,
    "tool_result": GREEN,
    "artifact": GREEN,
    "critique": YELLOW,
    "retry": RED,
    "task_failed": RED,
    "memory_read": BLUE,
    "memory_write": BLUE,
    "task_done": GREEN,
    "final_answer": BOLD + GREEN,
    "guardrail_warning": RED,
    "fault_injected": RED,
    "run_finished": BOLD + GREEN,
    "run_failed": BOLD + RED,
}


def _truncate(value: object, limit: int = 250) -> str:
    text = str(value).strip()
    return text if len(text) <= limit else text[:limit] + "… [truncated]"


async def event_printer(queue: asyncio.Queue[Event], stop_event: asyncio.Event) -> None:
    while not stop_event.is_set() or not queue.empty():
        try:
            event = await asyncio.wait_for(queue.get(), timeout=0.2)
        except asyncio.TimeoutError:
            continue

        color = EVENT_COLORS.get(event.type, RESET)
        concept = f" | {DIM}[Concept: {event.concept}]{RESET}" if event.concept else ""
        print(f"{color}[#{event.id:02d} {event.type.upper()}]{RESET} ({BOLD}{event.agent_id}{RESET}){concept}")

        payload = event.payload
        if event.type == "thought":
            print(f"   {DIM}Reasoning:{RESET} {_truncate(payload.get('thought', ''), 600)}")
        elif event.type == "tool_call":
            args = _truncate(json.dumps(payload.get("args", {})), 200)
            print(f"   {DIM}Tool:{RESET} {BOLD}{payload.get('tool')}{RESET} | {DIM}Args:{RESET} {args}")
        elif event.type == "tool_result":
            result = payload.get("stdout") or payload.get("stderr") or payload.get("result") or ""
            status = "ok" if payload.get("success", True) else "failed"
            print(f"   {DIM}Output ({status}):{RESET} {_truncate(result)}")
        elif event.type == "artifact":
            print(
                f"   {GREEN}✔ Artifact:{RESET} {payload.get('name', 'artifact')} "
                f"({payload.get('type')}, {len(payload.get('data', ''))} base64 chars)"
            )
        elif event.type == "critique":
            print(
                f"   {YELLOW}★ Score {payload.get('score')}/10 "
                f"[{str(payload.get('verdict', '')).upper()}]{RESET} - "
                f"{_truncate(payload.get('feedback', ''), 400)}"
            )
        elif event.type == "plan_created":
            tasks = payload.get("tasks", [])
            print(f"   {BLUE}Plan ({len(tasks)} tasks):{RESET}")
            for task in tasks:
                deps = ", ".join(task.get("depends_on") or []) or "none"
                print(
                    f"     • [{task.get('id')}] {task.get('title')} -> "
                    f"{BOLD}{task.get('assigned_agent_id')}{RESET} (depends: {deps})"
                )
        elif event.type == "retry":
            print(f"   {RED}↺ Critic retry #{payload.get('attempt')}:{RESET} {payload.get('feedback')}")
        elif event.type == "task_failed":
            print(f"   {RED}✖ Task failed:{RESET} {payload.get('error')}")
        elif event.type == "guardrail_warning":
            print(f"   {RED}Guardrail:{RESET} {payload.get('message')}")
        elif event.type == "final_answer":
            print(f"   {BOLD}Final answer:{RESET} {_truncate(payload.get('answer', ''), 800)}")
        elif event.type in {"run_finished", "run_failed"}:
            totals = payload.get("totals", {})
            print(f"\n{BOLD}Run status:{RESET} {payload.get('status', event.type)}")
            print(
                f"{BOLD}Steps:{RESET} {totals.get('steps')} | "
                f"{BOLD}Duration:{RESET} {totals.get('duration_seconds')}s | "
                f"{BOLD}Tokens:{RESET} {totals.get('in_tokens', 0) + totals.get('out_tokens', 0)} | "
                f"{BOLD}Cost:{RESET} ${totals.get('cost_usd', 0):.5f} | "
                f"{BOLD}Avg critic:{RESET} {totals.get('average_critic_score', 0)}/10"
            )

        queue.task_done()


async def main() -> int:
    parser = argparse.ArgumentParser(description="Run one AgentLens goal from the CLI")
    parser.add_argument("goal", nargs="?", help="Goal for the agent team")
    parser.add_argument("--mock", action="store_true", help="Force offline simulation")
    parser.add_argument("--max-seconds", type=int, default=300)
    args = parser.parse_args()

    goal = args.goal or "Benchmark three sorting algorithms on 10,000 items and explain the timings"

    print(f"\n{BOLD}{CYAN}=== AGENTLENS CLI ORCHESTRATOR ==={RESET}")
    print(f"{DIM}Goal:{RESET} {BOLD}{goal}{RESET}\n")

    init_db()
    seed_default_agents()
    seed_golden_runs()

    run_id = f"cli-run-{uuid.uuid4().hex[:8]}"
    with db_connection() as conn:
        conn.execute(
            "INSERT INTO runs (id, goal, config_json, status, created_at, totals_json) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                run_id,
                goal,
                json.dumps({"source": "cli", "mock": args.mock}),
                "created",
                time.time(),
                json.dumps({}),
            ),
        )

    queue = await event_bus.subscribe(run_id)
    stop_event = asyncio.Event()
    printer_task = asyncio.create_task(event_printer(queue, stop_event))

    orchestrator = Orchestrator(
        run_id=run_id,
        goal=goal,
        config={"max_steps": 25, "max_seconds": args.max_seconds, "mock": args.mock},
    )

    started = time.time()
    error: Exception | None = None
    try:
        await orchestrator.run()
    except Exception as exc:  # surfaced below with a non-zero exit code
        error = exc
    finally:
        await asyncio.sleep(0.3)
        stop_event.set()
        await printer_task
        await event_bus.unsubscribe(run_id, queue)

    elapsed = time.time() - started

    with db_connection() as conn:
        row = conn.execute(
            "SELECT status, totals_json FROM runs WHERE id = ?", (run_id,)
        ).fetchone()
        events_count = conn.execute(
            "SELECT count(*) AS total FROM events WHERE run_id = ?", (run_id,)
        ).fetchone()["total"]
        totals = json.loads(row["totals_json"] or "{}") if row else {}

    ok = bool(row) and row["status"] in {"completed", "completed_with_errors"} and events_count > 0
    header = f"{BOLD + GREEN}PASS{RESET}" if ok else f"{BOLD + RED}FAIL{RESET}"

    print(f"\n{header} CLI smoke test")
    print(f"  • Run ID: {run_id}")
    print(f"  • Status: {row['status'] if row else 'missing'}")
    print(f"  • Events persisted: {events_count}")
    print(f"  • Wall time: {elapsed:.2f}s")
    print(f"  • llm_mode: {totals.get('llm_mode', 'unknown')}")
    if error:
        print(f"  • Error: {error}")

    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
