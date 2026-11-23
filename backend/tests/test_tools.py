import pytest
import asyncio
from backend.app.tools.sandbox import run_python_code
from backend.app.tools.search import web_search
from backend.app.tools.memory import RunMemory
from backend.app.tools.faults import FaultInjector, FaultConfig
from backend.app.db import init_db

@pytest.fixture(autouse=True)
def setup_db():
    init_db()

@pytest.mark.asyncio
async def test_sandbox_execution():
    res = await run_python_code("print('Hello Sandbox')")
    assert res.success is True
    assert "Hello Sandbox" in res.stdout

@pytest.mark.asyncio
async def test_sandbox_security():
    res = await run_python_code("import subprocess\nsubprocess.run(['ls'])")
    assert res.success is False
    assert "Security Violation" in res.stderr

@pytest.mark.asyncio
async def test_sandbox_timeout():
    res = await run_python_code("import time\ntime.sleep(5)", timeout_seconds=1)
    assert res.success is False
    assert "timed out" in res.stderr

@pytest.mark.asyncio
async def test_sandbox_matplotlib_artifact():
    code = (
        "import matplotlib.pyplot as plt\n"
        "plt.figure()\n"
        "plt.plot([1, 2, 3], [4, 5, 6])\n"
        "print('Plot generated')\n"
    )
    res = await run_python_code(code)
    assert res.success is True
    assert len(res.artifacts) >= 1
    assert res.artifacts[0]["type"] == "image/png"
    assert len(res.artifacts[0]["data"]) > 100

@pytest.mark.asyncio
async def test_web_search():
    results = await web_search("sorting algorithms")
    assert len(results) > 0
    assert "title" in results[0]
    assert "url" in results[0]
    assert "snippet" in results[0]

def test_run_memory():
    run_id = "test-run-1"
    RunMemory.set(run_id, "summary", "Sorting analysis complete")
    val = RunMemory.get(run_id, "summary")
    assert val == "Sorting analysis complete"
    all_mem = RunMemory.list_all(run_id)
    assert all_mem.get("summary") == "Sorting analysis complete"

@pytest.mark.asyncio
async def test_fault_injection():
    config = FaultConfig(enabled=True, target_tool="web_search", mode="empty")
    injector = FaultInjector(config)
    
    async def dummy_call():
        return [{"title": "Real"}]
        
    res, injected = await injector.maybe_inject("web_search", dummy_call)
    assert injected is True
    assert res == []

