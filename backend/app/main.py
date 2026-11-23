from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings
from backend.app.db import init_db
from backend.app.golden_runs import seed_golden_runs
from backend.app.routes import runs, agents, tools

# 8 Core Agentic AI Concepts for the Why? Panel
CONCEPTS_DATA = [
    {
        "id": "react",
        "title": "ReAct Pattern (Reasoning + Acting)",
        "explanation": "Interleaves internal reasoning ('thought') with environment action ('tool_call') and observation ('tool_result'), allowing agents to dynamically adjust their plan as new facts emerge.",
        "learn_more_url": "https://arxiv.org/abs/2210.03629"
    },
    {
        "id": "planning",
        "title": "Strategic Task Decomposition",
        "explanation": "Breaks down an ambiguous user goal into bounded sub-tasks with explicit dependencies and deterministic success criteria before execution begins.",
        "learn_more_url": "https://lilianweng.github.io/posts/2023-06-23-agent/"
    },
    {
        "id": "tool_use",
        "title": "Sandboxed Tool Use",
        "explanation": "Extends LLM capabilities with deterministic tools (e.g., web search, code compilers). Security guardrails strictly restrict execution environment privileges.",
        "learn_more_url": "https://platform.openai.com/docs/guides/function-calling"
    },
    {
        "id": "reflection",
        "title": "Critic Reflection & Self-Correction",
        "explanation": "A specialized evaluator agent reviews task outputs against criteria. On failure, it provides actionable diagnostic feedback to steer automatic retry attempts.",
        "learn_more_url": "https://arxiv.org/abs/2303.11366"
    },
    {
        "id": "orchestration",
        "title": "State-Machine Orchestration",
        "explanation": "A predictable, hand-written state machine coordinates agent handoffs, enforces sequential ordering, and guarantees structured event propagation.",
        "learn_more_url": "https://martinfowler.com/articles/event-sourcing.html"
    },
    {
        "id": "memory",
        "title": "Run-Scoped Working Memory",
        "explanation": "Maintains shared structured state and key-value memory across multiple dependent agent tasks without cross-tenant memory leakage.",
        "learn_more_url": "https://arxiv.org/abs/2305.10403"
    },
    {
        "id": "guardrails",
        "title": "Code-Enforced Guardrails",
        "explanation": "Hard limits on step count, token budget, runtime seconds, and tool timeouts enforced programmatically in backend logic rather than solely in prompts.",
        "learn_more_url": "https://github.com/guardrails-ai/guardrails"
    },
    {
        "id": "evaluation",
        "title": "Observability & Quantitative Evaluation",
        "explanation": "Tracks token usage, dollar cost, execution latency, and reviewer scores across every step to calculate ROI and detect algorithmic drift.",
        "learn_more_url": "https://arize.com/blog-course/llm-evaluation/"
    }
]

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schema
    init_db()
    # Seed golden showcase runs
    seed_golden_runs()
    yield

app = FastAPI(
    title=settings.app_name,
    description="Glass-box Multi-Agent AI Platform with Live Observability & Custom Agent Builder",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(runs.router)
app.include_router(agents.router)
app.include_router(tools.router)

@app.get("/health")
def health_check():
    return {"status": "ok", "app": settings.app_name, "version": "1.0.0"}

@app.get("/concepts")
def get_concepts():
    return CONCEPTS_DATA

