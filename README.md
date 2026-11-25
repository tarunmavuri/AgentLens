<div align="center">

# AgentLens

### The glass-box multi-agent platform

**Build your own AI agent teams. Watch them collaborate. Understand every execution.**

![Backend tests](https://img.shields.io/badge/backend%20tests-51%20passed-2ea44f?style=for-the-badge)
![Frontend build](https://img.shields.io/badge/frontend%20build-passing-2ea44f?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-3.10%E2%80%933.14-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)

</div>

---

AgentLens runs a team of LLM agents on one goal, then shows you exactly what happened: the plan, every tool call, every observation, every critic verdict, every retry, and what it cost. Runs are event-sourced in SQLite and streamed to the browser over SSE, so a trace can be replayed byte-for-byte without calling a model again.

- **Hand-rolled orchestrator** — no LangGraph, no LangChain, no MCP. The state machine is auditable Python.
- **Built-in agents** — Planner, Researcher, Coder, Critic.
- **Custom agents** — configured in the UI (role, instructions, model, tool permissions, output schema, limits), stored in SQLite, registered dynamically, and assigned work by the Planner alongside built-in agents.
- **Real Gemini integration** — structured JSON output validated with Pydantic, token/latency/cost accounting, repair pass on invalid JSON, retry with backoff, and model fallback when a model is unavailable or out of quota.
- **Live execution graph** — nodes and edges are derived from persisted events, never from frontend timers.

---

## Quickstart

```bash
git clone <your-fork> AgentLens && cd AgentLens
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # optional: add GEMINI_API_KEY
```

Backend:

```bash
uvicorn backend.app.main:app --reload --port 8000
```

Frontend (second terminal):

```bash
cd frontend
npm install
npm run dev            # http://localhost:3000
```

The Vite dev server proxies `/runs`, `/agents`, `/tools`, `/config`, `/concepts` and `/health` to `127.0.0.1:8000`, so no `VITE_API_URL` is needed locally.

### Run one goal from the CLI

```bash
python backend/run_goal.py "Benchmark three sorting algorithms on 10,000 items and explain the timings"
```

The CLI seeds the registry, streams every event, and exits non-zero unless the stored run actually finished. Add `--mock` to force offline simulation.

### Offline simulation

With **no** `GEMINI_API_KEY`, runs use a deterministic simulation so the UI, replay and tests work without credentials. Those runs are labelled `llm_mode: "offline_simulation"` and cost `$0`. A configured key never silently degrades to simulation: provider failures surface as `LLMError` and appear in the run as `task_failed` / `run_failed` events.

---

## Configuration

All settings are environment variables; see `.env.example` for the full list.

| Variable | Default | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | — | Enables live Gemini calls. Server-side only. |
| `DEFAULT_MODEL` | `gemini-2.5-flash` | Model used when an agent does not specify one. |
| `ALLOWED_MODELS` | current Gemini text models | Allowlist enforced for every request, including custom agents. |
| `MODEL_FALLBACK_MODELS` | `gemini-3-flash-preview, gemini-3.1-flash-lite, gemini-3.5-flash` | Tried in order on 404/429/503 after retries; a model that failed is skipped for 10 minutes. Usage records the model that answered. |
| `TAVILY_API_KEY` | — | Search provider; falls back to DuckDuckGo. |
| `DB_PATH` | `agentlens.db` | SQLite file (WAL mode). |
| `CORS_ORIGINS` | `*` | Comma-separated browser origins. Set explicit origins in production. |
| `RATE_LIMIT_REQUESTS` / `RATE_LIMIT_WINDOW_SECONDS` | 30 / 60 | Per-IP limit on `POST /runs` and agent test endpoints. |
| `SANDBOX_TIMEOUT_SECONDS` | 20 | Hard wall-clock limit per Python execution. |
| `MAX_STEPS_DEFAULT` / `MAX_TOKENS_DEFAULT` / `MAX_SECONDS_DEFAULT` | 25 / 60000 / 300 | Guardrail budgets per run. |
| `MODEL_PRICING_JSON` | — | Overrides the built-in $/million-token price table. |

`GET /config` exposes the non-secret subset (mode, default/allowed models, limits, pricing) and powers the Settings screen.

---

## Architecture

```
Goal
  │
  ▼
Planner ──► Plan (tasks, dependencies, assigned agents)
  │
  ▼
Orchestrator (hand-rolled state machine)
  ├─ resolves dependency order, timeouts, guardrails
  ├─ dispatches any registered agent through one contract
  ├─ Critic evaluates each output; bounded retries with feedback
  ├─ persists every event before streaming it
  └─ composes a deterministic final answer from stored results
  │
  ▼
SQLite (runs, events, agents, memory)  ──►  SSE /runs/{id}/events
                                            ├─ Last-Event-ID resume
                                            ├─ metrics derived from events
                                            └─ full JSON trace export
```

| Layer | Location |
|---|---|
| FastAPI app, CORS, rate limiting, error shape | `backend/app/main.py`, `middleware.py` |
| Orchestrator | `backend/app/orchestrator.py` |
| Event model, bus, SSE ordering | `backend/app/events.py` |
| Agent contract, registry, built-ins, custom runner | `backend/app/agents/` |
| LLM client, retries, fallback, repair | `backend/app/llm.py` |
| Pricing | `backend/app/pricing.py` |
| Tools: sandbox, search, memory, faults | `backend/app/tools/` |
| Routes: runs, agents, tools | `backend/app/routes/` |
| React app, store, pages, graph, Coder Live | `frontend/src/` |

### Agent contract

Every agent — built-in or custom — is an `AgentDefinition` with the same fields and runs through `run_agent_task()`:

```text
agent_id, name, description, role, instructions
llm_config{model, temperature}
allowed_tools[]        # enforced server-side per call
output_schema          # JSON Schema; becomes a validated Pydantic model
execution_limits{max_steps, timeout_seconds}
agent_type             # built_in | custom
enabled
```

Agent results carry structured output, a summary, timing, and the model actually used. The Planner is given the live registry (enabled agents only) and may assign any of them, so mixed built-in/custom workflows work without code changes. The offline simulator assigns matching security/test/verification agents to dependent tasks so those workflows can be exercised without a key.

### Events

`Event` fields: `id` (monotonic per run), `run_id`, `ts`, `type`, `agent_id`, `agent_category`, `task_id`, `payload`, `concept`, `usage`. Event types cover `run_started`, `plan_created`, `task_started`, `agent_started`, `thought`, `tool_call`, `tool_result`, `artifact`, `critique`, `retry`, `memory_read`, `memory_write`, `task_done`, `task_failed`, `final_answer`, `run_finished`, `run_failed`, and fault/guardrail events.

SSE frames are `id: N` + `data: {...}`, with `retry: 3000`. The endpoint subscribes before replaying persisted events, supports `Last-Event-ID` / `last_event_id`, closes on terminal events, and keeps events available after a client disconnects. Replay and trace export read stored events only.

Agent "thoughts" are deliberately short decision summaries; raw chain-of-thought is not stored or shown.

---

## Custom agents

Create, edit, duplicate, enable/disable, delete and test agents from the UI or the API.

- Configurations persist in SQLite and register immediately.
- Disabled agents are rejected by the test endpoint and excluded from plans.
- Tool permissions are checked on the server for every tool call (not in the browser).
- Every execution emits the same events as built-in agents, so custom agents appear in the graph, timeline, metrics and history.
- `GET /agents/{id}/history` lists that agent's recorded executions (run, task, status, counts, critic score).
- Output schemas are JSON Schema objects edited in the builder; the runtime turns them into Pydantic models and the offline simulator fills declared fields.

No arbitrary user Python is uploaded or executed as agent code. Custom agents are configuration only. MCP is intentionally out of scope for this release.

---

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/runs` | Create and start a run (`goal`, optional guardrail/fault config). Rate limited. |
| `GET` | `/runs` | List runs (most recent first). |
| `GET` | `/runs/{id}` | Run summary + totals. |
| `GET` | `/runs/{id}/events` | SSE stream (resumable). |
| `GET` | `/runs/{id}/metrics` | Per-run and per-agent metrics derived from events: tokens, cost, latency, steps, tool calls, retries, critic scores, budget. |
| `GET` | `/runs/{id}/trace` | Full JSON trace (no secrets). |
| `GET` | `/agents` | List agents (`agent_type`, `enabled_only`). |
| `POST` / `PUT` / `DELETE` | `/agents`, `/agents/{id}` | CRUD (built-ins protected from deletion). |
| `POST` | `/agents/{id}/duplicate`, `/agents/{id}/toggle` | Clone or enable/disable. |
| `GET` | `/agents/{id}/history` | Recent executions of one agent. |
| `POST` | `/agents/{id}/test` | Isolated single-agent test. Disabled and system agents are rejected; rate limited. |
| `GET` | `/tools`, `/tools/{name}` | Tool registry metadata. |
| `GET` | `/config` | Public configuration and pricing. |
| `GET` | `/concepts`, `/health` | Educational concept list, liveness. |

Errors use stable status codes (`400` validation, `404` missing, `409` conflict, `429` rate limit) and never include API keys or stack traces.

---

## Evaluation and cost

`/runs/{id}/metrics` and the Evaluations screen are computed from persisted events, not from frontend estimates:

- input/output tokens, model, latency per call (from each event's `usage`),
- estimated cost via the configurable price table,
- steps (action events only), tool calls, retries, critic scores,
- guardrail consumption versus limits,
- per-agent breakdown.

Golden demo runs are pre-seeded from their stored events and labelled `recorded_demo`; they are never presented as live telemetry. Unknown models are priced with the table's `default` entry, so treat cost as an estimate and verify rates with your provider.

---

## Security model

- **API keys** live only in backend environment variables. They are never returned by `/config`, trace export, logs or the browser bundle.
- **Input validation** via Pydantic models on every route; agent definitions are validated (tool names, model allowlist, schema shape, limits).
- **Prompt injection**: retrieved web content and custom instructions are agent-level context only. They cannot change platform system instructions, guardrails, tool permissions or allowlists, which are enforced in code.
- **Tool permissions** are checked server-side for built-in and custom agents.
- **Memory isolation**: memory rows are keyed by `run_id`; agents can only read/write the current run.
- **Rate limiting** per client IP on expensive POST routes.
- **Sandbox** (`backend/app/tools/sandbox.py`), defence in depth:
  1. static rejection of obvious escapes,
  2. a child interpreter in a throwaway directory with a stripped environment,
  3. an in-child CPython audit hook that blocks process creation, sockets, network requests and writes/deletes outside the sandbox,
  4. POSIX resource limits (CPU, address space, file size, open files) and a wall-clock timeout that kills the process group,
  5. output caps and parent-side plot extraction.
- **Remaining limitations** (documented honestly):
  - This is process isolation, not a container/VM boundary. Untrusted multi-tenant code needs gVisor, Firecracker or a hosted sandbox such as Piston.
  - `rlimits` are POSIX-only; on Windows the timeout and audit hook are the enforced layers.
  - The audit hook is enforced by CPython; a memory-corruption exploit in a native extension is out of scope for it.
  - The API is single-tenant and unauthenticated by design. Put it behind an authenticated proxy before exposing it publicly.

---

## Tests

```bash
python -m pytest backend/tests -q
```

Current result: **51 passed** (~3 minutes on Windows; most time is real sandbox execution and search timeouts in offline runs).

Coverage includes: LLM client (retries, repair, fallback, offline labelling), pricing, sandbox execution/security/timeout/plot artifact, search unavailable handling, fault injection, memory isolation, registry CRUD/validation, agent contract, orchestrator end-to-end, dependency ordering, graceful task failure, guardrails, Break-it recovery, SSE resume, trace export, metrics, rate limiting, custom-agent API validation, and five showcase scenarios (research, coding artifact, custom fact-checker, security+testing agents, replay determinism) in `backend/tests/test_scenarios.py`.

Tests isolate state: `backend/tests/conftest.py` points `DB_PATH` at a temp directory, clears `GEMINI_API_KEY`, enables offline simulation, disables rate limits and shortens search timeouts.

There is no frontend unit-test suite; the frontend is verified by `tsc` + `vite build`. Do not treat the build as a functional test of interactions.

---

## Deployment

### Backend on Render

`render.yaml` is ready: Python 3.12, health check on `/health`, and a 1 GB disk mounted at `/var/data` with `DB_PATH=/var/data/agentlens.db`.

- Set `GEMINI_API_KEY` and, optionally, `TAVILY_API_KEY` in the Render dashboard.
- Set `CORS_ORIGINS` to the exact Vercel origin (for example `https://agentlens.vercel.app`). Do not leave `*` in production.
- SQLite must be on the persistent disk. **Without a disk (or on a free instance that does not offer one), every deploy/restart loses runs, agents and traces.** For multi-instance or long-term production use, migrate the storage layer to PostgreSQL; the event-sourced schema maps directly (runs, events, agents, memory).
- The container is not a hardened sandbox host: if you allow untrusted users, move code execution to a VM-based runner.

### Frontend on Vercel

- Root directory: `frontend`. Build: `npm run build`. Output: `dist` (see `frontend/vercel.json`, which also rewrites SPA routes to `index.html`).
- Set `VITE_API_URL=https://<your-render-service>` in Vercel's environment variables; the client appends `/runs`, `/agents`, etc.
- Redeploy after changing the backend URL so the value is baked into the bundle.

Never commit `.env`; `.env.example` contains placeholders only.

---

## Project layout

```
backend/
  app/
    agents/       base contract, registry, planner, researcher, coder, critic, custom runner
    routes/       runs (incl. SSE, metrics, trace), agents (incl. history, test), tools
    tools/        sandbox, search, memory, faults, registry
    config.py db.py events.py llm.py orchestrator.py guardrails.py pricing.py middleware.py
  tests/          51 tests including showcase scenarios
  run_goal.py     CLI smoke test / demo
frontend/
  src/            api, components, pages, store, types
  vite.config.ts  dev proxy
render.yaml       Render blueprint
```

## Roadmap (not in this release)

MCP integration, external agent APIs, more LLM providers, parallel task execution, richer evaluation suites, PostgreSQL storage, containerized sandboxing.

## License

MIT.
