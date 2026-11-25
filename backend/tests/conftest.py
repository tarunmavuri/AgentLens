"""Shared test configuration.

Environment must be set *before* backend modules import `settings`, so the suite
uses an isolated temporary database, explicit offline simulation (never a live
API key from a developer's .env), and no rate limiting.
"""

import asyncio
import os
import sys
import tempfile

import pytest

_TMP_DB_DIR = tempfile.mkdtemp(prefix="agentlens-tests-")
os.environ["DB_PATH"] = os.path.join(_TMP_DB_DIR, "agentlens-test.db")
os.environ["GEMINI_API_KEY"] = ""
os.environ["TAVILY_API_KEY"] = ""
os.environ["ALLOW_OFFLINE_SIMULATION"] = "true"
os.environ["RATE_LIMIT_REQUESTS"] = "0"
os.environ["SANDBOX_TIMEOUT_SECONDS"] = "20"
os.environ["SEARCH_TIMEOUT_SECONDS"] = "1.5"
os.environ["MAX_SECONDS_DEFAULT"] = "120"

# pytest-asyncio replaces the Windows event loop policy; subprocess work in the
# sandbox and orchestrator needs the Proactor loop on Windows.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())


@pytest.fixture(scope="session", autouse=True)
def _prepared_database():
    from backend.app.agents.registry import seed_default_agents
    from backend.app.db import init_db
    from backend.app.golden_runs import seed_golden_runs

    init_db()
    seed_default_agents()
    seed_golden_runs()
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    yield


@pytest.fixture()
def db():
    from backend.app.db import init_db

    init_db()
    return None
