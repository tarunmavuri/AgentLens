"""FastAPI application entrypoint."""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.agents.registry import seed_default_agents
from backend.app.auth import AuthenticatedUser, get_current_user
from backend.app.config import settings
from backend.app.db import init_db
from backend.app.golden_runs import seed_golden_runs
from backend.app.middleware import RateLimitMiddleware
from backend.app.pricing import pricing_table
from backend.app.routes import agents, runs, tools

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("agentlens")

CONCEPTS_DATA = [
    {
        "id": "react",
        "title": "ReAct Pattern (Reasoning + Acting)",
        "explanation": "Interleaves internal reasoning ('thought') with environment action ('tool_call') and observation ('tool_result'), letting agents adjust as new facts arrive.",
        "learn_more_url": "https://arxiv.org/abs/2210.03629",
    },
    {
        "id": "planning",
        "title": "Strategic Task Decomposition",
        "explanation": "Breaks an ambiguous goal into bounded sub-tasks with explicit dependencies and measurable success criteria before execution starts.",
        "learn_more_url": "https://lilianweng.github.io/posts/2023-06-23-agent/",
    },
    {
        "id": "tool_use",
        "title": "Sandboxed Tool Use",
        "explanation": "Deterministic tools (search, code execution) extend the model. Permissions are enforced server-side and code runs under an audit-hook sandbox.",
        "learn_more_url": "https://platform.openai.com/docs/guides/function-calling",
    },
    {
        "id": "reflection",
        "title": "Critic Reflection & Self-Correction",
        "explanation": "A dedicated evaluator scores each output against its criteria and, on failure, sends actionable feedback into a bounded retry loop.",
        "learn_more_url": "https://arxiv.org/abs/2303.11366",
    },
    {
        "id": "orchestration",
        "title": "State-Machine Orchestration",
        "explanation": "A hand-written state machine resolves dependencies, dispatches agents and guarantees ordered, persisted event propagation.",
        "learn_more_url": "https://martinfowler.com/articles/event-sourcing.html",
    },
    {
        "id": "memory",
        "title": "Run-Scoped Working Memory",
        "explanation": "Each run has an isolated key-value store so downstream agents see upstream results without any cross-run or cross-user leakage.",
        "learn_more_url": "https://arxiv.org/abs/2305.10403",
    },
    {
        "id": "guardrails",
        "title": "Code-Enforced Guardrails",
        "explanation": "Step, token and wall-clock budgets are enforced in code on every agent action, with warnings emitted at 80% utilisation.",
        "learn_more_url": "https://github.com/guardrails-ai/guardrails",
    },
    {
        "id": "evaluation",
        "title": "Observability & Quantitative Evaluation",
        "explanation": "Every step records tokens, latency, cost and critic scores, all derived from the persisted event log rather than client-side estimates.",
        "learn_more_url": "https://arize.com/blog-course/llm-evaluation/",
    },
]


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    seed_default_agents()
    seed_golden_runs()
    logger.info(
        "AgentLens %s ready (llm_mode=%s, db=%s)",
        settings.version,
        settings.llm_mode,
        settings.db_path,
    )
    if settings.llm_mode != "gemini":
        logger.warning(
            "No GEMINI_API_KEY configured: runs will use explicit offline simulation "
            "and are labelled llm_mode=offline_simulation."
        )
    yield


app = FastAPI(
    title=settings.app_name,
    description="Glass-box multi-agent platform with live observability and a custom agent builder",
    version=settings.version,
    lifespan=lifespan,
)

allow_credentials = "*" not in settings.cors_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Last-Event-ID"],
)
app.add_middleware(
    RateLimitMiddleware,
    limit=settings.rate_limit_requests,
    window_seconds=settings.rate_limit_window_seconds,
)

app.include_router(runs.router)
app.include_router(agents.router)
app.include_router(tools.router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Return a stable error shape without leaking internals or credentials."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error_type": type(exc).__name__},
    )


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": settings.version,
        "llm_mode": settings.llm_mode,
        "llm_configured": settings.llm_configured,
        "timestamp": time.time(),
    }


@app.get("/config")
def public_config():
    return {
        **settings.public_dict(),
        "pricing_per_million_tokens": pricing_table(),
    }


@app.get("/concepts")
def get_concepts():
    return CONCEPTS_DATA


@app.get("/auth/me", response_model=AuthenticatedUser)
def get_authenticated_user(current_user: AuthenticatedUser = Depends(get_current_user)):
    """Return the verified Firebase user profile for the current bearer token."""
    return current_user
