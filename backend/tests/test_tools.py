import pytest

from backend.app.tools.faults import FaultConfig, FaultInjector
from backend.app.tools.memory import RunMemory
from backend.app.tools.sandbox import check_security, run_python_code
from backend.app.tools.search import web_search


@pytest.mark.asyncio
async def test_sandbox_execution():
    res = await run_python_code("print('Hello Sandbox')")
    assert res.success is True
    assert "Hello Sandbox" in res.stdout
    assert res.exit_code == 0


@pytest.mark.asyncio
async def test_sandbox_security_static_screen():
    res = await run_python_code("import subprocess\nsubprocess.run(['ls'])")
    assert res.success is False
    assert "Security violation" in res.stderr

    ok, reason = check_security("import os\nprint(os.getcwd())")
    assert ok, reason


@pytest.mark.asyncio
async def test_sandbox_blocks_dynamic_process_import():
    """A constructed import bypasses the static denylist; the runtime audit hook must stop it."""
    code = (
        "mod = __import__('sub' + 'process')\n"
        "mod.run(['echo', 'escaped'])\n"
        "print('ESCAPED')\n"
    )
    res = await run_python_code(code)
    assert res.success is False
    assert "ESCAPED" not in res.stdout
    assert "sandbox" in res.stderr.lower()
    assert "process" in res.stderr.lower()


@pytest.mark.asyncio
async def test_sandbox_blocks_write_outside_workspace():
    code = (
        "import os\n"
        "with open(os.path.join('..', 'agentlens-escape.txt'), 'w') as f:\n"
        "    f.write('escaped')\n"
        "print('ESCAPED')\n"
    )
    res = await run_python_code(code)
    assert res.success is False
    assert "ESCAPED" not in res.stdout
    assert "outside the sandbox" in res.stderr


@pytest.mark.asyncio
async def test_sandbox_timeout():
    res = await run_python_code("import time\ntime.sleep(5)", timeout_seconds=1)
    assert res.success is False
    assert res.timed_out is True
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
async def test_web_search_returns_well_formed_results():
    results = await web_search("python sorting algorithms")
    assert results
    assert {"title", "url", "snippet", "provider"} <= set(results[0])
    if results[0]["provider"] != "none":
        assert results[0]["url"].startswith("http")


def test_run_memory_is_run_scoped():
    RunMemory.set("test-run-1", "summary", "Sorting analysis complete")
    RunMemory.set("test-run-2", "summary", "Different run")
    assert RunMemory.get("test-run-1", "summary") == "Sorting analysis complete"
    assert RunMemory.get("test-run-2", "summary") == "Different run"
    assert RunMemory.list_all("test-run-1")["summary"] == "Sorting analysis complete"
    RunMemory.clear("test-run-1")
    assert RunMemory.list_all("test-run-1") == {}


@pytest.mark.asyncio
async def test_fault_injection():
    config = FaultConfig(enabled=True, target_tool="web_search", mode="empty")
    injector = FaultInjector(config)

    async def dummy_call():
        return [{"title": "Real"}]

    res, injected = await injector.maybe_inject("web_search", dummy_call)
    assert injected is True
    assert res == []

    # A single fault per run: the next call passes through.
    res2, injected2 = await injector.maybe_inject("web_search", dummy_call)
    assert injected2 is False
    assert res2 == [{"title": "Real"}]
