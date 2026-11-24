import asyncio
import sys
import pytest

# On Windows, asyncio.create_subprocess_exec requires ProactorEventLoop.
# pytest-asyncio 1.x defaults to SelectorEventLoop which causes subprocess
# calls to hang for the full timeout. Set the policy globally at import time.
if sys.platform == "win32":
    # ProactorEventLoop is the default in Python 3.8+ when using asyncio.run(),
    # but pytest-asyncio overrides it. Force it back here.
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())


@pytest.fixture(autouse=True, scope="session")
def _windows_proactor_policy():
    """Ensure ProactorEventLoop is active throughout the test session on Windows."""
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    yield
