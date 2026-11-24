# 🎬 AgentLens — 60-Second Product Demonstration Script

A step-by-step walkthrough script for a 60-second screen recording showing all 8 observable agentic AI concepts in AgentLens.

---

## ⏱️ Video Breakdown & Click Path

| Timestamp | Screen / Location | Actions to Perform | Voiceover Narration | Concept Highlighted |
|---|---|---|---|---|
| **0:00 - 0:08** | **Landing Page** (`/`) | Start at the landing page. Click **"Launch Platform"** or **"Explore Demo Runs"**. | *"Most multi-agent systems are black boxes. Meet AgentLens — the glass-box orchestration platform that makes AI agent teams fully observable."* | Glass-Box Observability |
| **0:08 - 0:18** | **Dashboard** (`/dashboard`) | Highlight the 2 pre-seeded golden runs. Click **"New Run"** modal. Type: `Benchmark three sorting algorithms on 10,000 items and explain the timings`. Toggle **"Break-it (Fault Injection)"** to show chaos engineering. Click **"Start Run"**. | *"Let's launch a run. We give our agents a complex goal and inject an intermittent tool fault to see how the system handles turbulence."* | **Orchestration** & **Guardrails** |
| **0:18 - 0:30** | **Live Workspace** (`/workspace/:id`) | Observe the **Live Directed Agent Graph** (React Flow). The Planner breaks the goal into tasks. Watch the Coder and Researcher nodes activate and pulse. | *"The Planner breaks the goal into ordered tasks. Watch live as the state machine coordinates the Planner, Coder, and Researcher."* | **Planning** & **ReAct** |
| **0:30 - 0:42** | **Coder Live Tab** (`/workspace/:id`) | Click the **Coder Live** tab at the bottom. Show code on the left, sandbox output on the right, and the generated **matplotlib plot** rendered inline. Click **"Diff View"** to inspect the red/green self-correction. | *"In the Coder Live panel, we see the code execution, the stdout, and the matplotlib plot generated in our sandbox. Toggle Diff View to see the exact lines the agent corrected after failure."* | **Tool Use** (`python_sandbox`), **Artifact**, & **Reflection** (Self-Correction) |
| **0:42 - 0:50** | **Critic & Activity Stream** | Click on the Critic event in the timeline. Show the 0–10 score, verdict, and reflection feedback. Point to the top stats: token count, duration, and exact cost ($0.0004). | *"The Critic evaluates each output against strict success criteria. In the top bar, token budgets, latency, and costs are tracked down to the fraction of a cent."* | **Reflection** & **Evaluations** |
| **0:50 - 0:55** | **Custom Agent Builder** (`/agents/builder`) | Navigate to Custom Agent Builder. Show the configuration form (Name, System Instructions, Model, Allowed Tools). Point out that dynamic agents are immediately usable by the Planner. | *"Need custom capabilities? Build custom agents directly in the UI with modular tools and instructions — no backend code required."* | **Custom Agent Builder** |
| **0:55 - 1:00** | **Trace Export & Why Panel** (`/dashboard` & `/evaluations`) | Click **"Export Trace (JSON)"** on the run. Click the **"Why?"** concept badge to reveal the 8 architectural principles. | *"Export the full event trace for offline replay. That's AgentLens — build, observe, and understand every AI agent execution."* | **Trace Replay** & Transparency |

---

## 🔑 Key Features Demonstrated

1. **Live Event Stream:** Every `thought`, `tool_call`, `tool_result`, `artifact`, `critique`, and `guardrail` is emitted via Server-Sent Events (SSE).
2. **Coder Live & Diff View:** Real-time sandbox execution, error capture, inline base64 plot rendering, and Myers-style line diffing of corrections.
3. **Fault Injection (Break-it):** Deliberate tool failure simulation (timeout, error, empty result) testing agent resilience and Critic retries.
4. **Zero-API-Key Offline Mode:** 2 cached golden showcase runs (`golden-run-rag-vs-finetuning` and `golden-run-sorting-benchmark`) allow immediate demoing without external API keys.
5. **Trace Export:** Complete JSON replay artifact exported from `GET /runs/{id}/trace`.

---

## 🚀 One-Line CLI Demo (Phase 1 Gate Proof)

To demo or verify the platform directly from the terminal:

```bash
python backend/run_goal.py "Benchmark three sorting algorithms on 10,000 items and explain the timings"
```

