# AgentLens · The Glass-Box Multi-Agent AI Platform

> **"Build your own AI agent teams. Watch them collaborate. Understand, evaluate and improve every execution."**

AgentLens is a production-quality, glass-box multi-agent orchestration and observability platform. Unlike black-box agent frameworks, AgentLens makes every thought, tool invocation, critique, code execution, artifact, and retry completely transparent, observable, and measurable.

---

## 📸 Visual Identity & Design System

AgentLens features an editorial visual identity inspired by high-end design systems:
- **Dark Theme**: Deep charcoal background (`#151217`), surface containers (`#201B20`), coral accent (`#FF513C`), secondary warm amber (`#F47742`).
- **Light Theme**: Warm cream background (`#F5F0EA`), pure surface cards (`#FFFDFC`), espresso typography (`#1D1919`), coral accents (`#FF513C`).
- **Typography**: Inter / Geist combined with Instrument Serif italic highlights.

---

## 🏛️ System Architecture

AgentLens is built across 4 decoupled layers:

```
┌────────────────────────────────────────────────────────┐
│                   Layer 1: Frontend                    │
│   React · React Flow · Zustand · Tailwind · Replay     │
└───────────────────────────▲────────────────────────────┘
                            │ Server-Sent Events (SSE)
┌───────────────────────────▼────────────────────────────┐
│            Layer 2: Backend & Orchestration            │
│   FastAPI · Hand-Rolled State Machine · Guardrails     │
└───────────────────────────▲────────────────────────────┘
                            │ Async Function Calls
┌───────────────────────────▼────────────────────────────┐
│                  Layer 3: Agent Engine                 │
│   Planner · Researcher · Coder · Critic · Custom Agents│
└───────────────────────────▲────────────────────────────┘
                            │ Tool Execution Interface
┌───────────────────────────▼────────────────────────────┐
│               Layer 4: Tools & Services                │
│   Web Search · Python Sandbox · Run Memory · Faults    │
└────────────────────────────────────────────────────────┘
```

---

## ⚡ The 8 Core Architectural Concepts (Why? Panel)

1. **ReAct Pattern (Reasoning + Acting)**: Interleaves internal reasoning (`thought`) with environment action (`tool_call`) and observation (`tool_result`), allowing agents to dynamically adjust their plan as new facts emerge.
2. **Strategic Task Decomposition**: Breaks down an ambiguous user goal into bounded sub-tasks (max 5) with explicit dependencies and deterministic success criteria before execution begins.
3. **Sandboxed Tool Use**: Extends LLM capabilities with deterministic tools (`web_search`, `python_sandbox`). Security guardrails strictly restrict execution environment privileges.
4. **Critic Reflection & Self-Correction**: A specialized evaluator agent reviews task outputs against criteria. On failure, it provides actionable diagnostic feedback to steer automatic retry attempts (up to 2 retries).
5. **State-Machine Orchestration**: A predictable, hand-written state machine coordinates agent handoffs, enforces sequential ordering, and guarantees structured event propagation without LangGraph.
6. **Run-Scoped Working Memory**: Maintains shared structured state and key-value memory across multiple dependent agent tasks without cross-tenant memory leakage.
7. **Code-Enforced Guardrails**: Hard limits on step count (25 steps), token budget (60,000 tokens), runtime seconds (120s), and tool timeouts (10s) enforced programmatically in backend logic rather than solely in prompts.
8. **Observability & Quantitative Evaluation**: Tracks token usage, dollar cost, execution latency, and reviewer scores across every step to calculate ROI and detect algorithmic drift.

---

## 🤖 Built-in & Custom Agent System

### Built-in Agents:
- **Planner**: Decomposes user goals into up to 5 structured tasks with explicit dependencies and success criteria.
- **Researcher**: Executes web searches, gathers empirical sources, and synthesizes findings with confidence scores.
- **Coder**: Writes executable Python code, runs scripts in the isolated sandbox, captures stdout/stderr, extracts matplotlib plots as base64 PNG artifacts, and performs up to 3 self-correction fix attempts.
- **Critic**: Rigorously evaluates completed tasks against criteria, assigns scores (0-10), issues verdicts (`accept` / `retry`), and delivers structured feedback.

### Custom Agent Builder (v1.0 Core Feature):
Users can configure and deploy specialized custom agents without writing backend Python code:
- **Identity**: Name, description, specialized role.
- **System Instructions**: Custom prompt rules.
- **Model Selection**: Gemini 2.5 Flash, 1.5 Flash, or 1.5 Pro.
- **Tool Permissions**: Granular backend-enforced tool allowlists (`web_search`, `python_sandbox`, `read_memory`, `write_memory`).
- **Execution Limits**: Step caps and timeout budgets.
- **Independent Testing**: Test custom agents independently in a sandbox preview before deployment.

---

## 🛡️ Reliability & Break-It Fault Injection

AgentLens includes a dedicated fault injection engine to evaluate agent resilience:
- **Modes**: `wrong_answer`, `empty`, `garbage`, `timeout`.
- When enabled, the tool wrapper injects faults during tool execution, emitting a `fault_injected` event.
- The Critic agent catches the resulting failure and automatically triggers a corrective retry, proving real self-healing capabilities.

---

## 🚀 Getting Started

### Prerequisites:
- Python 3.10+
- Node.js 18+ and npm

### 1. Backend Setup:
```bash
# Clone the repository
git clone https://github.com/your-username/agentlens.git
cd agentlens

# Install Python dependencies
pip install -r requirements.txt

# (Optional) Configure environment variables
cp .env.example .env
# Add your GEMINI_API_KEY in .env if you wish to use live Google Gemini API

# Start FastAPI backend
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend Setup:
```bash
cd frontend

# Install Node dependencies
npm install

# Start Vite development server
npm run dev
```

Visit `http://localhost:3000` in your browser.

---

## 🧪 Automated Testing

AgentLens comes with a comprehensive automated test suite covering unit, integration, and end-to-end multi-agent flows:

```bash
# Run all backend tests
python -m pytest backend/tests

# Build frontend production bundle
cd frontend && npm run build
```

---

## 🌐 Deployment Configuration

- **Frontend**: Configured for Vercel with `frontend/vercel.json`.
- **Backend**: Configured for Render with `render.yaml`.

---

## 📄 License
MIT License. Built for production-grade agentic AI engineering.

