"""Seeds two recorded showcase traces so the UI is explorable with no API key.

These are explicitly labelled as recorded demo traces (`llm_mode:
"recorded_demo"`, `config.is_golden: true`). Their totals are *computed from
the seeded events* by the same rules the metrics endpoint uses, so the
dashboard never shows a number the event log cannot reproduce.
"""

from __future__ import annotations

import json
import time
from typing import Any, Optional

from backend.app.db import db_connection, get_meta, set_meta

GOLDEN_VERSION = "3"
GOLDEN_RUN_IDS = ("golden-run-rag-vs-finetuning", "golden-run-sorting-benchmark")

# (type, agent_id, category, task_id, payload, concept, usage)
GoldenEvent = tuple[str, str, str, Optional[str], dict[str, Any], Optional[str], Optional[dict[str, Any]]]


def _totals(events: list[GoldenEvent]) -> dict[str, Any]:
    in_tokens = sum(int((event[6] or {}).get("in_tokens", 0)) for event in events)
    out_tokens = sum(int((event[6] or {}).get("out_tokens", 0)) for event in events)
    cost = round(sum(float((event[6] or {}).get("cost_usd", 0.0)) for event in events), 6)
    scores = [
        float(event[4]["score"])
        for event in events
        if event[0] == "critique" and isinstance(event[4].get("score"), (int, float))
    ]
    return {
        "in_tokens": in_tokens,
        "out_tokens": out_tokens,
        "cost_usd": cost,
        "steps": sum(1 for event in events if event[0] in {"plan_created", "thought", "tool_call", "critique"}),
        "retries": sum(1 for event in events if event[0] == "retry"),
        "tool_calls": sum(1 for event in events if event[0] == "tool_call"),
        "faults_injected": sum(1 for event in events if event[0] == "fault_injected"),
        "critic_scores": scores,
        "average_critic_score": round(sum(scores) / len(scores), 1) if scores else None,
        "failed_tasks": [],
        "duration_seconds": round(len(events) * 0.9, 2),
        "llm_latency_ms": round(sum(float((event[6] or {}).get("latency_ms", 0)) for event in events), 2),
    }


def _usage(in_tokens: int, out_tokens: int, cost_usd: float) -> dict[str, Any]:
    return {
        "in_tokens": in_tokens,
        "out_tokens": out_tokens,
        "cost_usd": cost_usd,
        "latency_ms": 0.0,
        "model": "recorded-demo-trace",
    }


def _rag_trace(goal: str) -> list[GoldenEvent]:
    code = (
        "import matplotlib.pyplot as plt\n"
        "approaches = ['Pure RAG', 'Fine-tuned LLM', 'Hybrid']\n"
        "accuracy = [94.5, 87.2, 96.8]\n"
        "plt.bar(approaches, accuracy)\n"
        "plt.ylim(80, 100)\n"
    )
    return [
        ("run_started", "system", "system", None, {"goal": goal, "mode": "recorded_demo", "llm_mode": "recorded_demo"}, "orchestration", None),
        ("plan_created", "planner", "built_in", None, {
            "tasks": [
                {"id": "task-1", "title": "Investigate RAG vs Fine-tuning Trade-offs", "assigned_agent_id": "researcher", "task_type": "research", "depends_on": []},
                {"id": "task-2", "title": "Code Experiment: Retrieval vs Direct Prediction", "assigned_agent_id": "coder", "task_type": "code", "depends_on": ["task-1"]},
                {"id": "task-3", "title": "Security Review of the Experiment", "assigned_agent_id": "security_reviewer", "task_type": "review", "depends_on": ["task-2"]},
            ],
            "total_tasks": 3,
        }, "planning", _usage(320, 180, 0.000546)),
        ("task_started", "system", "system", "task-1", {"task": {"id": "task-1", "title": "Investigate RAG vs Fine-tuning Trade-offs"}}, "orchestration", None),
        ("agent_started", "researcher", "built_in", "task-1", {"agent_id": "researcher", "name": "Researcher", "agent_type": "built_in"}, "orchestration", None),
        ("thought", "researcher", "built_in", "task-1", {"thought": "Compare latency, accuracy, knowledge freshness and maintenance cost for enterprise support."}, "react", _usage(410, 96, 0.000363)),
        ("tool_call", "researcher", "built_in", "task-1", {"tool": "web_search", "args": {"query": "RAG vs fine-tuning customer support benchmark"}}, "tool_use", None),
        ("tool_result", "researcher", "built_in", "task-1", {
            "tool": "web_search",
            "success": True,
            "result": [
                {"title": "Retrieval-Augmented Generation for Knowledge-Intensive NLP", "url": "https://arxiv.org/abs/2005.11401", "snippet": "RAG grounds generation in a retrievable index.", "provider": "recorded-demo-trace"},
                {"title": "Fine-tuning vs retrieval trade-offs", "url": "https://huggingface.co/docs/transformers/training", "snippet": "Fine-tuning adapts style and task format, not live facts.", "provider": "recorded-demo-trace"},
            ],
        }, "tool_use", None),
        ("memory_write", "researcher", "built_in", "task-1", {"key": "task-1_research", "preview": "RAG keeps answers grounded in a live index..."}, "memory", None),
        ("critique", "critic", "built_in", "task-1", {"score": 9.0, "verdict": "accept", "feedback": "Comparative summary with two credible sources and stated limitations.", "retry_count": 0, "enforced_by": "model", "evaluated_status": "completed"}, "reflection", _usage(520, 84, 0.000366)),
        ("task_done", "system", "system", "task-1", {"task_id": "task-1", "summary": "RAG trades retrieval latency for freshness; fine-tuning trades freshness for lower per-call cost.", "attempts": 1}, "orchestration", None),
        ("agent_finished", "researcher", "built_in", "task-1", {"agent_id": "researcher", "status": "completed", "duration": 1.4, "attempts": 1}, "orchestration", None),
        ("task_started", "system", "system", "task-2", {"task": {"id": "task-2", "title": "Code Experiment: Retrieval vs Direct Prediction"}}, "orchestration", None),
        ("agent_started", "coder", "built_in", "task-2", {"agent_id": "coder", "name": "Coder", "agent_type": "built_in"}, "orchestration", None),
        ("thought", "coder", "built_in", "task-2", {"thought": "Build a small comparison and plot accuracy by approach.", "attempt": 1}, "react", _usage(480, 260, 0.000794)),
        ("tool_call", "coder", "built_in", "task-2", {"tool": "python_sandbox", "args": {"code": code, "attempt": 1}}, "tool_use", None),
        ("tool_result", "coder", "built_in", "task-2", {"tool": "python_sandbox", "success": True, "stdout": "Pure RAG 94.5 | Fine-tuned 87.2 | Hybrid 96.8\n", "stderr": "", "duration_ms": 240.0, "attempt": 1}, "tool_use", None),
        ("critique", "critic", "built_in", "task-2", {"score": 9.2, "verdict": "accept", "feedback": "Experiment executed cleanly and the comparison is labelled.", "retry_count": 0, "enforced_by": "model", "evaluated_status": "completed"}, "reflection", _usage(560, 82, 0.000373)),
        ("task_done", "system", "system", "task-2", {"task_id": "task-2", "summary": "Sandbox experiment produced the comparison table and chart.", "attempts": 1}, "orchestration", None),
        ("agent_finished", "coder", "built_in", "task-2", {"agent_id": "coder", "status": "completed", "duration": 2.1, "attempts": 1}, "orchestration", None),
        ("task_started", "system", "system", "task-3", {"task": {"id": "task-3", "title": "Security Review of the Experiment"}}, "orchestration", None),
        ("agent_started", "security_reviewer", "custom", "task-3", {"agent_id": "security_reviewer", "name": "Security Reviewer", "agent_type": "custom"}, "orchestration", None),
        ("thought", "security_reviewer", "custom", "task-3", {"thought": "Audit the generated script for unsafe operations or data exposure."}, "react", _usage(390, 120, 0.000285)),
        ("memory_read", "security_reviewer", "custom", "task-3", {"keys": ["task_2_code", "task_2_output"]}, "memory", None),
        ("critique", "critic", "built_in", "task-3", {"score": 8.8, "verdict": "accept", "feedback": "Review scoped to the script and identified no unsafe operations.", "retry_count": 0, "enforced_by": "model", "evaluated_status": "completed"}, "reflection", _usage(450, 78, 0.00033)),
        ("task_done", "system", "system", "task-3", {"task_id": "task-3", "summary": "No unsafe operations found; the script only uses the standard library and matplotlib.", "attempts": 1}, "orchestration", None),
        ("agent_finished", "security_reviewer", "custom", "task-3", {"agent_id": "security_reviewer", "status": "completed", "duration": 1.2, "attempts": 1}, "orchestration", None),
        ("final_answer", "system", "system", None, {"answer": "RAG for freshness and citations; fine-tuning for style and format; production teams usually combine both.", "tasks": 3, "failed_tasks": []}, "evaluation", None),
    ]


def _sorting_trace(goal: str) -> list[GoldenEvent]:
    code = (
        "import random, time\n"
        "import matplotlib.pyplot as plt\n"
        "def quicksort(values):\n"
        "    if len(values) <= 1:\n"
        "        return values\n"
        "    pivot = values[len(values) // 2]\n"
        "    return quicksort([v for v in values if v < pivot]) + [v for v in values if v == pivot] + quicksort([v for v in values if v > pivot])\n"
        "data = [random.randint(0, 100000) for _ in range(10000)]\n"
        "start = time.perf_counter(); quicksort(data.copy()); quick = time.perf_counter() - start\n"
        "start = time.perf_counter(); sorted(data.copy()); tim = time.perf_counter() - start\n"
        "print(f'Quicksort: {quick:.4f}s')\n"
        "print(f'Timsort: {tim:.4f}s')\n"
        "plt.bar(['Quicksort', 'Timsort'], [quick, tim])\n"
    )
    return [
        ("run_started", "system", "system", None, {"goal": goal, "mode": "recorded_demo", "llm_mode": "recorded_demo"}, "orchestration", None),
        ("plan_created", "planner", "built_in", None, {
            "tasks": [
                {"id": "task-1", "title": "Benchmark Sorting Algorithms on 10,000 Items", "assigned_agent_id": "coder", "task_type": "code", "depends_on": []},
                {"id": "task-2", "title": "Explain the Sorting Benchmark Results", "assigned_agent_id": "researcher", "task_type": "research", "depends_on": ["task-1"]},
            ],
            "total_tasks": 2,
        }, "planning", _usage(290, 150, 0.000462)),
        ("task_started", "system", "system", "task-1", {"task": {"id": "task-1", "title": "Benchmark Sorting Algorithms on 10,000 Items"}}, "orchestration", None),
        ("agent_started", "coder", "built_in", "task-1", {"agent_id": "coder", "name": "Coder", "agent_type": "built_in"}, "orchestration", None),
        ("thought", "coder", "built_in", "task-1", {"thought": "Implement Quicksort, time it against CPython's Timsort, and plot both.", "attempt": 1}, "react", _usage(460, 240, 0.000738)),
        ("tool_call", "coder", "built_in", "task-1", {"tool": "python_sandbox", "args": {"code": code, "attempt": 1}}, "tool_use", None),
        ("tool_result", "coder", "built_in", "task-1", {"tool": "python_sandbox", "success": True, "stdout": "Quicksort: 0.0213s\nTimsort: 0.0012s\n", "stderr": "", "duration_ms": 210.0, "attempt": 1}, "tool_use", None),
        ("critique", "critic", "built_in", "task-1", {"score": 9.4, "verdict": "accept", "feedback": "Timings are internally consistent and the chart matches the printed numbers.", "retry_count": 0, "enforced_by": "model", "evaluated_status": "completed"}, "reflection", _usage(470, 80, 0.000341)),
        ("task_done", "system", "system", "task-1", {"task_id": "task-1", "summary": "Quicksort in pure Python is ~18x slower than C-level Timsort on 10k items.", "attempts": 1}, "orchestration", None),
        ("agent_finished", "coder", "built_in", "task-1", {"agent_id": "coder", "status": "completed", "duration": 2.0, "attempts": 1}, "orchestration", None),
        ("task_started", "system", "system", "task-2", {"task": {"id": "task-2", "title": "Explain the Sorting Benchmark Results"}}, "orchestration", None),
        ("agent_started", "researcher", "built_in", "task-2", {"agent_id": "researcher", "name": "Researcher", "agent_type": "built_in"}, "orchestration", None),
        ("thought", "researcher", "built_in", "task-2", {"thought": "Explain the gap through interpreter overhead, adaptivity and cache behaviour."}, "react", _usage(420, 140, 0.000476)),
        ("tool_call", "researcher", "built_in", "task-2", {"tool": "web_search", "args": {"query": "Timsort adaptive mergesort complexity Python"}}, "tool_use", None),
        ("tool_result", "researcher", "built_in", "task-2", {"tool": "web_search", "success": True, "result": [{"title": "Python sorting HOWTO", "url": "https://docs.python.org/3/howto/sorting.html", "snippet": "Timsort is adaptive and stable, O(n log n) worst case.", "provider": "recorded-demo-trace"}], "error": None, "fault_injected": False}, "tool_use", None),
        ("critique", "critic", "built_in", "task-2", {"score": 9.1, "verdict": "accept", "feedback": "Explanation connects the measured numbers to algorithmic properties.", "retry_count": 0, "enforced_by": "model", "evaluated_status": "completed"}, "reflection", _usage(500, 90, 0.000361)),
        ("task_done", "system", "system", "task-2", {"task_id": "task-2", "summary": "Timsort wins because it runs in C, is adaptive on real data, and avoids Python-level recursion.", "attempts": 1}, "orchestration", None),
        ("agent_finished", "researcher", "built_in", "task-2", {"agent_id": "researcher", "status": "completed", "duration": 1.3, "attempts": 1}, "orchestration", None),
        ("final_answer", "system", "system", None, {"answer": "Timsort is fastest for typical inputs; algorithmic complexity alone does not predict wall-clock time in CPython.", "tasks": 2, "failed_tasks": []}, "evaluation", None),
    ]


def _insert_trace(
    conn,
    run_id: str,
    goal: str,
    events: list[GoldenEvent],
    created_at: float,
) -> None:
    totals = _totals(events)
    conn.execute(
        """
        INSERT OR REPLACE INTO runs (id, goal, config_json, status, created_at, totals_json)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            run_id,
            goal,
            json.dumps({"is_golden": True, "llm_mode": "recorded_demo"}),
            "completed",
            created_at,
            json.dumps(totals),
        ),
    )
    conn.execute("DELETE FROM events WHERE run_id = ?", (run_id,))
    for index, event in enumerate(events, start=1):
        event_type, agent_id, category, task_id, payload, concept, usage = event
        conn.execute(
            """
            INSERT INTO events
            (run_id, id, ts, type, agent_id, agent_category, task_id, payload_json, concept, usage_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                index,
                created_at + index * 0.9,
                event_type,
                agent_id,
                category,
                task_id,
                json.dumps(payload),
                concept,
                json.dumps(usage) if usage else None,
            ),
        )


def seed_golden_runs() -> None:
    """Seed or refresh the recorded showcase traces (idempotent)."""
    if get_meta("golden_runs_version") == GOLDEN_VERSION:
        return

    rag_goal = (
        "Compare RAG vs fine-tuning for a customer-support bot and back it up with a "
        "small code experiment"
    )
    sorting_goal = "Benchmark three sorting algorithms on 10,000 items and explain the timings"

    with db_connection() as conn:
        for run_id in GOLDEN_RUN_IDS:
            conn.execute("DELETE FROM events WHERE run_id = ?", (run_id,))
            conn.execute("DELETE FROM runs WHERE id = ?", (run_id,))
        _insert_trace(
            conn,
            GOLDEN_RUN_IDS[0],
            rag_goal,
            _rag_trace(rag_goal),
            time.time() - 86400,
        )
        _insert_trace(
            conn,
            GOLDEN_RUN_IDS[1],
            sorting_goal,
            _sorting_trace(sorting_goal),
            time.time() - 43200,
        )
    set_meta("golden_runs_version", GOLDEN_VERSION)
