"""Python execution sandbox.

Security model (defence in depth, none of it foolproof):

1. Static rejection of obvious escape attempts in the submitted source.
2. A dedicated child interpreter (`python -B -X utf8`) inside a throwaway
   working directory with a stripped environment; only the interpreter's own
   site-packages are exposed so numpy/matplotlib work.
3. A CPython audit hook installed *inside* the child before user code runs. It
   blocks process creation, network sockets and filesystem writes outside the
   sandbox directory. Audit hooks cannot be uninstalled from Python code, so
   this closes the "import a module the denylist forgot" gap.
4. POSIX resource limits (CPU, address space, file size, open files) and a hard
   wall-clock timeout that kills the whole process group.
5. Output caps and plot extraction on the parent side.

This is process-level isolation, not a container boundary. For multi-tenant or
untrusted public execution, run the sandbox inside gVisor/Piston/Firecracker or
another VM-based runner. See README "Sandbox security".
"""

from __future__ import annotations

import asyncio
import base64
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from typing import Optional

from pydantic import BaseModel, Field

from backend.app.config import settings
from backend.app.tools.registry import ToolDefinition, tool_registry

ARTIFACT_MARKER = "__AGENTLENS_ARTIFACT_PNG__:"

# Fast-fail static screen. The runtime audit hook is the real enforcement.
DENIED_PATTERNS: list[tuple[str, str]] = [
    (r"\b(?:import|from)\s+(?:subprocess|socket|ctypes|pty|multiprocessing)\b", "process/network module import"),
    (r"\b__import__\s*\(\s*['\"](?:subprocess|socket|ctypes|pty|multiprocessing)", "dynamic import of a restricted module"),
    (r"\bos\.(?:system|popen|exec|spawn|fork|kill)\b", "process control"),
    (r"\bsubprocess\.", "process control"),
    (r"\bsocket\.", "network access"),
    (r"\bctypes\.", "native library access"),
    (r"\bshutil\.rmtree\b", "recursive deletion"),
    (r"\bpty\.", "terminal control"),
    (r"\bmultiprocessing\.", "process creation"),
]


def check_security(code: str) -> tuple[bool, str]:
    for pattern, reason in DENIED_PATTERNS:
        if re.search(pattern, code):
            return False, f"Security violation: {reason} is not permitted in the sandbox."
    return True, ""


WRAPPER_TEMPLATE = r'''
import base64
import io
import os
import sys

_SANDBOX_DIR = os.path.realpath(__SANDBOX_DIR__)
_MAX_REPORTED_OUTPUT = __MAX_OUTPUT__

def _deny(reason):
    raise PermissionError("AgentLens sandbox: " + reason)

def _within_sandbox(path):
    try:
        if isinstance(path, (bytes, bytearray)):
            path = os.fsdecode(path)
        if not isinstance(path, str):
            return True
        target = os.path.realpath(os.path.abspath(path))
        return target == _SANDBOX_DIR or target.startswith(_SANDBOX_DIR + os.sep)
    except Exception:
        return False

_DENIED_EVENTS = {
    "os.system": "os.system() is disabled",
    "subprocess.Popen": "starting processes is disabled",
    "os.fork": "process creation is disabled",
    "os.forkpty": "process creation is disabled",
    "os.posix_spawn": "process creation is disabled",
    "os.exec": "process creation is disabled",
    "os.spawn": "process creation is disabled",
    "socket.__new__": "network sockets are disabled",
    "socket.connect": "network connections are disabled",
    "socket.bind": "network listeners are disabled",
    "socket.getaddrinfo": "network lookups are disabled",
    "socket.gethostbyname": "network lookups are disabled",
    "urllib.Request": "network requests are disabled",
    "http.client.connect": "network requests are disabled",
    "os.kill": "signalling processes is disabled",
    "os.killpg": "signalling processes is disabled",
}

def _audit(event, args):
    reason = _DENIED_EVENTS.get(event)
    if reason:
        _deny(reason + " [" + event + "]")
    if event == "open":
        mode = args[1] if len(args) > 1 else None
        if mode and any(ch in str(mode) for ch in "wax+"):
            if not _within_sandbox(args[0]):
                _deny("writing outside the sandbox directory is disabled")
    if event in ("os.remove", "os.rmdir", "os.rename", "os.chmod", "os.truncate"):
        if args and not _within_sandbox(args[0]):
            _deny("modifying files outside the sandbox directory is disabled")

sys.addaudithook(_audit)

os.environ.setdefault("MPLCONFIGDIR", os.path.join(_SANDBOX_DIR, ".matplotlib"))
os.environ.setdefault("HOME", _SANDBOX_DIR)
os.environ.setdefault("TMPDIR", _SANDBOX_DIR)

_has_mpl = False
try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    _has_mpl = True
except Exception:
    _has_mpl = False

user_code = __USER_CODE__
_globals = {"__name__": "__main__", "__builtins__": __builtins__}

try:
    exec(compile(user_code, "<agentlens-task>", "exec"), _globals)

    if _has_mpl:
        for fig_num in plt.get_fignums():
            fig = plt.figure(fig_num)
            buf = io.BytesIO()
            fig.savefig(buf, format="png", bbox_inches="tight", dpi=100)
            buf.seek(0)
            img_b64 = base64.b64encode(buf.read()).decode("ascii")
            sys.stdout.write("\n" + __ARTIFACT_MARKER__ + img_b64 + "\n")
            sys.stdout.flush()
        plt.close("all")
except SystemExit as exc:
    code = exc.code if isinstance(exc.code, int) else 1
    if code:
        sys.stderr.write("SystemExit: " + str(exc.code) + "\n")
        raise SystemExit(code)
except BaseException:
    import traceback
    tb = traceback.format_exc()
    if len(tb) > _MAX_REPORTED_OUTPUT:
        tb = tb[:_MAX_REPORTED_OUTPUT] + "\n...[traceback truncated]"
    sys.stderr.write(tb)
    sys.stderr.flush()
    raise SystemExit(1)
'''


class SandboxResult(BaseModel):
    success: bool
    stdout: str
    stderr: str
    exit_code: int
    duration_ms: float
    artifacts: list[dict[str, str]] = Field(default_factory=list)
    timed_out: bool = False
    injected_fault: bool = False
    isolation: str = "subprocess+audit-hook"


def _apply_resource_limits(timeout_seconds: int):
    """POSIX-only rlimits applied in the child before exec."""
    try:
        import resource  # noqa: PLC0415 - POSIX only

        cpu = int(timeout_seconds) + 1
        resource.setrlimit(resource.RLIMIT_CPU, (cpu, cpu + 1))
        memory = 768 * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (memory, memory))
        file_size = 8 * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_FSIZE, (file_size, file_size))
        resource.setrlimit(resource.RLIMIT_NOFILE, (128, 128))
    except Exception:
        # Limits are a hardening layer; the timeout and audit hook still apply.
        pass


def _kill_process(proc: subprocess.Popen) -> None:
    try:
        if os.name == "posix":
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        else:
            proc.kill()
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass


def _run_subprocess(
    script_path: str,
    workdir: str,
    env: dict[str, str],
    timeout_seconds: int,
) -> tuple[bytes, bytes, int, bool]:
    kwargs: dict = {}
    if os.name == "posix":
        kwargs["start_new_session"] = True

    # `-I`/`-s` would hide the interpreter's installed packages (matplotlib,
    # numpy), so isolation relies on the stripped environment, the throwaway
    # cwd and the in-child audit hook instead.
    proc = subprocess.Popen(
        [sys.executable, "-B", "-X", "utf8", script_path],
        cwd=workdir,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=(lambda: _apply_resource_limits(timeout_seconds))
        if os.name == "posix"
        else None,
        **kwargs,
    )
    timed_out = False
    try:
        stdout, stderr = proc.communicate(timeout=timeout_seconds)
    except subprocess.TimeoutExpired:
        timed_out = True
        _kill_process(proc)
        try:
            stdout, stderr = proc.communicate(timeout=5)
        except subprocess.TimeoutExpired:  # pragma: no cover - defensive
            stdout, stderr = b"", b""
    return stdout, stderr, proc.returncode if proc.returncode is not None else -1, timed_out


def _build_script(code: str, sandbox_dir: str) -> str:
    return (
        WRAPPER_TEMPLATE.replace("__SANDBOX_DIR__", repr(sandbox_dir))
        .replace("__MAX_OUTPUT__", str(settings.sandbox_max_output_chars))
        .replace("__ARTIFACT_MARKER__", repr(ARTIFACT_MARKER))
        .replace("__USER_CODE__", repr(code))
    )


def _extract_artifacts(stdout: str) -> tuple[str, list[dict[str, str]]]:
    artifacts: list[dict[str, str]] = []
    if ARTIFACT_MARKER not in stdout:
        return stdout, artifacts

    parts = stdout.split(ARTIFACT_MARKER)
    clean_stdout = parts[0].strip()
    for index, part in enumerate(parts[1:], start=1):
        payload = part.splitlines()[0].strip() if part.splitlines() else ""
        if not payload:
            continue
        try:
            base64.b64decode(payload, validate=True)
        except Exception:
            continue
        artifacts.append(
            {"type": "image/png", "data": payload, "name": f"plot-{index}.png"}
        )
    return clean_stdout, artifacts


async def run_python_code(
    code: str, timeout_seconds: Optional[int] = None
) -> SandboxResult:
    """Execute Python code in an isolated child process."""
    timeout = int(timeout_seconds or settings.sandbox_timeout_seconds)
    timeout = max(1, min(timeout, 120))

    is_safe, security_error = check_security(code)
    if not is_safe:
        return SandboxResult(
            success=False,
            stdout="",
            stderr=security_error,
            exit_code=1,
            duration_ms=0.0,
        )

    workdir = tempfile.mkdtemp(prefix="agentlens-sandbox-")
    script_path = os.path.join(workdir, "task.py")
    # Expose only the interpreter's installed package directories, not the
    # parent's arbitrary sys.path entries.
    package_paths = [
        path
        for path in sys.path
        if path
        and os.path.isdir(path)
        and ("site-packages" in path or "dist-packages" in path)
    ]
    env = {
        "PATH": os.environ.get("PATH", ""),
        "PYTHONPATH": os.pathsep.join(package_paths),
        "PYTHONIOENCODING": "utf-8",
        "PYTHONNOUSERSITE": "1",
        "HOME": workdir,
        "TMPDIR": workdir,
        "TEMP": workdir,
        "TMP": workdir,
        "MPLCONFIGDIR": os.path.join(workdir, ".matplotlib"),
        "MPLBACKEND": "Agg",
        "LANG": "C.UTF-8",
    }

    started = time.monotonic()
    try:
        with open(script_path, "w", encoding="utf-8") as handle:
            handle.write(_build_script(code, workdir))

        stdout_data, stderr_data, exit_code, timed_out = await asyncio.to_thread(
            _run_subprocess, script_path, workdir, env, timeout
        )
        duration_ms = (time.monotonic() - started) * 1000.0

        stdout_str = stdout_data.decode("utf-8", errors="replace")
        stderr_str = stderr_data.decode("utf-8", errors="replace")
        artifacts: list[dict[str, str]] = []

        if timed_out:
            stdout_str = ""
            stderr_str = f"Execution timed out after {timeout} seconds."
        else:
            stdout_str, artifacts = _extract_artifacts(stdout_str)

        max_chars = settings.sandbox_max_output_chars
        if len(stdout_str) > max_chars:
            stdout_str = stdout_str[:max_chars] + "\n...[stdout truncated]"
        if len(stderr_str) > max_chars:
            stderr_str = stderr_str[:max_chars] + "\n...[stderr truncated]"

        return SandboxResult(
            success=(exit_code == 0 and not timed_out),
            stdout=stdout_str,
            stderr=stderr_str,
            exit_code=-1 if timed_out else exit_code,
            duration_ms=round(duration_ms, 2),
            artifacts=artifacts if not timed_out else [],
            timed_out=timed_out,
        )
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


tool_registry.register(
    ToolDefinition(
        name="python_sandbox",
        description=(
            "Execute Python code in an isolated subprocess (audit-hook guarded, "
            "resource limited) and capture stdout, stderr and matplotlib plots."
        ),
        parameters={
            "type": "object",
            "properties": {
                "code": {"type": "string", "description": "Python source to execute"},
                "timeout_seconds": {
                    "type": "integer",
                    "description": "Execution timeout in seconds",
                    "default": settings.sandbox_timeout_seconds,
                },
            },
            "required": ["code"],
        },
        category="code",
    ),
    run_python_code,
)
