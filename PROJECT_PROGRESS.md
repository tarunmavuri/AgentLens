# AgentLens Product Development Progress Document

**Current Status:** V1.0 Complete & Verified  
**Date:** November 23, 2026  
**Tech Lead:** Senior AI Systems Architect & Full-Stack Lead  

---

## 1. What Was Implemented

### Layer 1: Frontend & Design System
- **Visual Identity**: Warm cream light theme (`#F5F0EA`) and deep charcoal dark theme (`#151217`) with coral accent (`#FF513C`) and warm amber (`#F47742`).
- **Typography**: Inter / Geist for interface typography and Instrument Serif italic headlines matching reference screenshots.
- **Landing Page**: Two-column editorial hero with live multi-agent preview card, architectural value pillars, and CTAs.
- **Application Dashboard**: Real-time KPI telemetry (Total runs, registered agents, tokens, cost), recent executions table with status badges, and 1-click trace export.
- **Live Execution Workspace**:
  - React Flow dynamic graph with custom nodes for Planner, Researcher, Coder, Critic, and Custom Agents.
  - Animated edges representing task dependencies and handoffs.
  - Active status badges (Idle, Waiting, Planning, Running, Using Tool, Reviewing, Retrying, Completed, Failed).
  - Right-side Agent Inspector (role, specialization, tool permissions, activity counters).
  - Activity Timeline stream with ReAct thought previews and Why? concept pills.
  - Coder Live panel with syntax-highlighted code, sandbox stdout/stderr, and inline base64 matplotlib plot artifacts.
- **Custom Agent Builder**: 6-section no-code agent creator (Identity, Instructions, Model, Allowed Tools, Output Schema, Execution Limits) with live configuration preview and independent test execution runner.
- **Evaluations Dashboard**: Token consumption meters, cost tracking, latency, retry counts, critic evaluation score history, and code-enforced guardrail budget meters.
- **Historical Replay & Trace Export**: Event-sourced scrub bar (Play/Pause, 1x/2x/5x speed, step forward/back) and full JSON trace export.
- **Break-it Feature**: Fault injection toggle with 4 modes (`wrong_answer`, `empty`, `garbage`, `timeout`).

### Layer 2: Backend & Orchestration
- **FastAPI Core**: Modular architecture with routes for `/runs`, `/agents`, `/tools`, `/concepts`, `/health`.
- **Event Bus & Storage**: SQLite-persisted monotonic event log with SSE streaming (`/runs/{id}/events`) supporting `Last-Event-ID` reconnection.
- **Hand-Rolled State Machine**: Clean, transparent ~300-line Python state machine without LangGraph.
- **Guardrails**: Hard programmatic caps on max steps (25), max tokens (60,000), runtime seconds (120s), and tool timeouts (10s), with automatic warnings emitted at 80% budget.

### Layer 3: Agent Engine
- **Planner Agent**: Interprets goals, breaks them into max 5 dependent tasks with success criteria, and dynamically assigns tasks to enabled built-in or custom agents.
- **Researcher Agent**: ReAct search loop using `web_search`, emits thoughts, tool calls, and structured summaries with source citations.
- **Coder Agent**: Writes Python scripts, executes them in the sandbox, captures outputs and matplotlib plots, and performs up to 3 self-correction fix attempts.
- **Critic Agent**: Evaluates completed tasks, assigns scores (0-10), issues verdicts (`accept` or `retry`), and delivers constructive feedback for up to 2 retries.
- **Custom Agent Engine**: Dynamic agent execution runner operating under custom system instructions, allowed tools, and model configs.

### Layer 4: Tools & Sandbox
- **Python Sandbox**: Isolated subprocess runner with import denylisting (`subprocess`, `os.system`, `socket`), execution timeout, 10 KB output limit, and headless matplotlib plot extraction.
- **Web Search**: DuckDuckGo / Tavily integration with domain-aware fallback.
- **Run-Scoped Memory**: SQLite key-value store isolated per execution.
- **Fault Injector**: Tool wrapper supporting Break-it modes.

### Phase 1 & Phase 2 Gate Completion (Updated Plan)
- **Phase 1 Gate Passed**: Tested and demonstrated CLI end-to-end execution script (`backend/run_goal.py`) proving real-time multi-agent orchestration, event logging (21 observable events), plot artifact generation, and Critic evaluations.
- **EventType Formal Enumeration**: Strictly typed Pydantic `Literal` validating all agent sub-events (`thought`, `tool_call`, `tool_result`, `artifact`, `critique`, `memory_write`), orchestrator lifecycle events, and fault injection events.
- **CoderLive Diff View**: Built-in Myers-style diff view in `CoderLive.tsx` showing colored additions/deletions between consecutive fix attempts to visualize self-correction.
- **60-Second Demo Script**: Comprehensive timestamped video recording guide (`DEMO_SCRIPT.md`) covering all 8 observable agentic AI concepts.
- **ProactorEventLoop Conftest**: Overcame Windows subprocess event loop timeouts in `backend/tests/conftest.py`. Full test suite: 19/19 passing.

---

## 2. Files Created or Modified

### Backend:
- `backend/app/config.py`: Environment configuration and limits.
- `backend/app/pricing.py`: Per-model token pricing calculations.
- `backend/app/db.py`: SQLite schema (`runs`, `events`, `agents`, `memory`).
- `backend/app/events.py`: Pydantic Event schema and async EventBus.
- `backend/app/guardrails.py`: Programmatic budget manager.
- `backend/app/llm.py`: LLM abstraction supporting Google Gemini and offline simulation.
- `backend/app/golden_runs.py`: Pre-seeded showcase runs.
- `backend/app/main.py`: FastAPI application entrypoint.
- `backend/app/orchestrator.py`: Hand-rolled multi-agent state machine.
- `backend/app/tools/registry.py`: Modular Tool Registry.
- `backend/app/tools/search.py`: Web search tool.
- `backend/app/tools/sandbox.py`: Python sandbox with matplotlib extraction.
- `backend/app/tools/memory.py`: Run-scoped key-value memory.
- `backend/app/tools/faults.py`: Modular fault injection wrapper.
- `backend/app/agents/base.py`: AgentDefinition, TaskDefinition, Plan, AgentResult.
- `backend/app/agents/registry.py`: Dynamic agent registry with SQLite CRUD.
- `backend/app/agents/planner.py`: Planner agent.
- `backend/app/agents/researcher.py`: Researcher agent.
- `backend/app/agents/coder.py`: Coder agent with sandbox integration.
- `backend/app/agents/critic.py`: Critic evaluation agent.
- `backend/app/agents/custom_agent.py`: Dynamic custom agent runner.
- `backend/app/routes/runs.py`: Run execution, SSE stream, and trace export.
- `backend/app/routes/agents.py`: Agent management and independent test runner.
- `backend/app/routes/tools.py`: Tool discovery.
- `backend/tests/test_tools.py`: Tool unit tests.
- `backend/tests/test_agents.py`: Agent CRUD and registry tests.
- `backend/tests/test_orchestrator.py`: Multi-agent end-to-end and chaos tests.
- `backend/tests/test_api.py`: FastAPI endpoint tests.

### Frontend:
- `frontend/package.json`: Vite, React 19, Tailwind, React Flow, Zustand, Lucide.
- `frontend/vite.config.ts`: Proxy configuration to FastAPI backend.
- `frontend/tailwind.config.js`: Dark/light design tokens and typography.
- `frontend/src/styles/index.css`: Tailwind styles, CSS variables, and pulse animations.
- `frontend/src/types/index.ts`: TypeScript contracts for events, agents, and runs.
- `frontend/src/api/client.ts`: REST API client.
- `frontend/src/store/useAppStore.ts`: Global Zustand store with EventSource listener.
- `frontend/src/components/layout/Navbar.tsx`: Editorial header with theme switch.
- `frontend/src/components/layout/Sidebar.tsx`: Navigation sidebar with engine status.
- `frontend/src/components/NewRunModal.tsx`: Launch modal with Break-it toggle.
- `frontend/src/components/WhyModal.tsx`: Architectural explanation drawer.
- `frontend/src/components/graph/CustomAgentNode.tsx`: React Flow custom agent node.
- `frontend/src/components/workspace/AgentInspector.tsx`: Node inspector sidebar.
- `frontend/src/components/workspace/ActivityTimeline.tsx`: Filterable event stream.
- `frontend/src/components/workspace/CoderLive.tsx`: Split code/sandbox/plot inspector.
- `frontend/src/pages/LandingPage.tsx`: Editorial showcase landing page.
- `frontend/src/pages/DashboardPage.tsx`: Operations dashboard.
- `frontend/src/pages/AgentsPage.tsx`: Agent ecosystem cards & actions.
- `frontend/src/pages/CustomAgentBuilderPage.tsx`: 6-section custom agent builder.
- `frontend/src/pages/LiveWorkspacePage.tsx`: Live React Flow graph & telemetry.
- `frontend/src/pages/EvaluationsPage.tsx`: Resource evaluation & budget meters.
- `frontend/src/pages/ReplayPage.tsx`: Scrub bar historical player.
- `frontend/src/pages/SettingsPage.tsx`: Configuration and theme settings.
- `frontend/src/App.tsx`: App root.

### Deployment & Docs:
- `render.yaml`: Render deployment configuration.
- `frontend/vercel.json`: Vercel SPA routing configuration.
- `.env.example`: Template for environment variables.
- `requirements.txt`: Python package requirements.
- `README.md`: Comprehensive product architecture and guide.

---

## 3. Tests Executed & Results

- **Backend Test Suite**:
  - `backend/tests/test_tools.py`: 7 passed (sandbox, plot extraction, memory, security, timeout, search, fault injection).
  - `backend/tests/test_agents.py`: 3 passed (built-in agent listing, custom agent CRUD, protection against built-in deletion).
  - `backend/tests/test_orchestrator.py`: 2 passed (end-to-end multi-agent orchestration, Break-it fault injection & Critic recovery).
  - `backend/tests/test_api.py`: 7 passed (health, concepts, runs, trace export, agent test endpoint, tool schemas).
  - **Result: 19 passed out of 19 tests in 42.42s (100% success rate)**.
- **Frontend Production Build**:
  - Executed `tsc && vite build`.
  - Transformed 2,192 modules and generated minified production bundles in `frontend/dist/`.
  - **Result: Build completed with zero errors in 50.95s**.

---

## 4. Known Issues & Mitigations
- Subprocess sandbox isolation is restricted using import denylisting and timeouts suitable for single-tenant local/sandbox execution. For multi-tenant public production environments, document swapping to containerized sandboxes (e.g. Piston or gVisor) as noted in architecture docs.
- Golden traces guarantee immediate offline usability for demonstrations without requiring a live Gemini API key.

