import json
import time
from backend.app.db import get_db_connection

def seed_golden_runs():
    """Seeds two prebuilt golden showcase runs so the platform has rich data out-of-the-box."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Check if golden runs already exist
        cursor.execute("SELECT count(*) as cnt FROM runs WHERE id = 'golden-run-rag-vs-finetuning'")
        if cursor.fetchone()["cnt"] > 0:
            return

        # ----------------- GOLDEN RUN 1: RAG vs Fine-tuning -----------------
        run1_id = "golden-run-rag-vs-finetuning"
        run1_goal = "Compare RAG vs fine-tuning for a customer-support bot and back it up with a small code experiment"
        run1_config = {"max_steps": 25, "is_golden": True}
        run1_totals = {
            "in_tokens": 12450,
            "out_tokens": 3820,
            "cost_usd": 0.00208,
            "duration_seconds": 18.4,
            "steps": 14,
            "retries": 1,
            "average_critic_score": 9.4
        }
        cursor.execute(
            """
            INSERT OR REPLACE INTO runs (id, goal, config_json, status, created_at, totals_json)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (run1_id, run1_goal, json.dumps(run1_config), "completed", time.time() - 86400, json.dumps(run1_totals))
        )

        run1_events = [
            (1, "run_started", "system", "system", None, {"goal": run1_goal, "mode": "Golden Showcase"}, "orchestration", None),
            (2, "plan_created", "planner", "built_in", None, {
                "tasks": [
                    {"id": "task-1", "title": "Investigate RAG vs Fine-tuning Trade-offs", "assigned_agent_id": "researcher", "task_type": "research"},
                    {"id": "task-2", "title": "Code Experiment: Retrieval vs Direct Prediction", "assigned_agent_id": "coder", "task_type": "code"},
                    {"id": "task-3", "title": "Security & Safety Review", "assigned_agent_id": "security_reviewer", "task_type": "custom"}
                ]
            }, "planning", {"in_tokens": 320, "out_tokens": 180, "cost_usd": 0.000078, "latency_ms": 120.0}),
            (3, "task_started", "system", "system", "task-1", {"task_title": "Investigate RAG vs Fine-tuning Trade-offs"}, "orchestration", None),
            (4, "thought", "researcher", "built_in", "task-1", {"thought": "Comparing accuracy, latency, and knowledge obsolescence across enterprise customer service architectures."}, "react", None),
            (5, "tool_call", "researcher", "built_in", "task-1", {"tool": "web_search", "args": {"query": "RAG vs fine-tuning customer support latency accuracy benchmarks"}}, "tool_use", None),
            (6, "tool_result", "researcher", "built_in", "task-1", {
                "tool": "web_search",
                "result": [
                    {"title": "Retrieval-Augmented Generation vs Fine-Tuning for Enterprise NLP", "url": "https://arxiv.org/abs/2312.05934", "snippet": "RAG reduces customer support hallucination by 42% over static weights."},
                    {"title": "Hybrid Architectures: Combining RAG with LoRA", "url": "https://huggingface.co/blog/rag-vs-finetuning", "snippet": "Best practice: Fine-tune small models for query routing, use RAG for real-time customer data."}
                ]
            }, "tool_use", None),
            (7, "critique", "critic", "built_in", "task-1", {"score": 9.2, "verdict": "accept", "feedback": "Well-supported comparative literature with peer-reviewed arXiv citations."}, "reflection", {"in_tokens": 410, "out_tokens": 95, "cost_usd": 0.000059, "latency_ms": 85.0}),
            (8, "task_done", "system", "system", "task-1", {"summary": "Completed research on RAG vs Fine-Tuning."}, "orchestration", None),
            (9, "task_started", "system", "system", "task-2", {"task_title": "Code Experiment: Retrieval vs Direct Prediction"}, "orchestration", None),
            (10, "tool_call", "coder", "built_in", "task-2", {"tool": "python_sandbox", "args": {"code": "import matplotlib.pyplot as plt\n# Accuracy benchmark\n..."}}, "tool_use", None),
            (11, "tool_result", "coder", "built_in", "task-2", {"tool": "python_sandbox", "success": True, "stdout": "Pure RAG: 94.5% accuracy | Fine-Tuned LLM: 87.2% | Hybrid: 96.8%", "duration_ms": 280.0}, "tool_use", None),
            (12, "critique", "critic", "built_in", "task-2", {"score": 9.6, "verdict": "accept", "feedback": "Empirical code experiment ran cleanly in sandbox with conclusive comparative metrics."}, "reflection", None),
            (13, "task_done", "system", "system", "task-2", {"summary": "Executed benchmark experiment."}, "orchestration", None),
            (14, "run_finished", "system", "system", None, {"status": "completed", "totals": run1_totals}, "evaluation", None)
        ]

        for ev in run1_events:
            cursor.execute(
                """
                INSERT OR REPLACE INTO events 
                (run_id, id, ts, type, agent_id, agent_category, task_id, payload_json, concept, usage_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (run1_id, ev[0], time.time() - 86400 + ev[0], ev[1], ev[2], ev[3], ev[4], json.dumps(ev[5]), ev[6], json.dumps(ev[7]) if ev[7] else None)
            )

        # ----------------- GOLDEN RUN 2: Sorting Benchmark -----------------
        run2_id = "golden-run-sorting-benchmark"
        run2_goal = "Benchmark three sorting algorithms on 10,000 items and explain the timings"
        run2_config = {"max_steps": 25, "is_golden": True}
        run2_totals = {
            "in_tokens": 9850,
            "out_tokens": 2940,
            "cost_usd": 0.00162,
            "duration_seconds": 12.1,
            "steps": 10,
            "retries": 0,
            "average_critic_score": 9.5
        }
        cursor.execute(
            """
            INSERT OR REPLACE INTO runs (id, goal, config_json, status, created_at, totals_json)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (run2_id, run2_goal, json.dumps(run2_config), "completed", time.time() - 43200, json.dumps(run2_totals))
        )

        run2_events = [
            (1, "run_started", "system", "system", None, {"goal": run2_goal, "mode": "Golden Showcase"}, "orchestration", None),
            (2, "plan_created", "planner", "built_in", None, {
                "tasks": [
                    {"id": "task-1", "title": "Benchmark Sorting Algorithms on 10,000 Items", "assigned_agent_id": "coder", "task_type": "code"},
                    {"id": "task-2", "title": "Analyze Sorting Benchmark Results & Complexity", "assigned_agent_id": "researcher", "task_type": "research"}
                ]
            }, "planning", {"in_tokens": 290, "out_tokens": 150, "cost_usd": 0.000066, "latency_ms": 110.0}),
            (3, "task_started", "system", "system", "task-1", {"task_title": "Benchmark Sorting Algorithms on 10,000 Items"}, "orchestration", None),
            (4, "thought", "coder", "built_in", "task-1", {"thought": "Writing Python script benchmarking Quicksort, Mergesort, and native Timsort with a matplotlib plot."}, "react", None),
            (5, "tool_call", "coder", "built_in", "task-1", {"tool": "python_sandbox", "args": {"code": "def quicksort(arr)..."}}, "tool_use", None),
            (6, "tool_result", "coder", "built_in", "task-1", {"tool": "python_sandbox", "success": True, "stdout": "Quicksort: 0.0210s\nMergesort: 0.0345s\nTimsort (Python): 0.0012s", "duration_ms": 195.0}, "tool_use", None),
            (7, "critique", "critic", "built_in", "task-1", {"score": 9.5, "verdict": "accept", "feedback": "Accurate timings and plot generated."}, "reflection", None),
            (8, "task_done", "system", "system", "task-1", {"summary": "Completed sorting benchmarks."}, "orchestration", None),
            (9, "task_started", "system", "system", "task-2", {"task_title": "Analyze Sorting Benchmark Results & Complexity"}, "orchestration", None),
            (10, "run_finished", "system", "system", None, {"status": "completed", "totals": run2_totals}, "evaluation", None)
        ]

        for ev in run2_events:
            cursor.execute(
                """
                INSERT OR REPLACE INTO events 
                (run_id, id, ts, type, agent_id, agent_category, task_id, payload_json, concept, usage_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (run2_id, ev[0], time.time() - 43200 + ev[0], ev[1], ev[2], ev[3], ev[4], json.dumps(ev[5]), ev[6], json.dumps(ev[7]) if ev[7] else None)
            )

        conn.commit()
    finally:
        conn.close()

