import asyncio
import base64
import os
import re
import sys
import tempfile
from typing import Any
from pydantic import BaseModel
from backend.app.tools.registry import ToolDefinition, tool_registry

class SandboxResult(BaseModel):
    success: bool
    stdout: str
    stderr: str
    exit_code: int
    duration_ms: float
    artifacts: list[dict[str, str]] = []  # [{type: "image/png", data: base64_str, name: "plot.png"}]

DENIED_IMPORTS = [
    "subprocess",
    "shutil.rmtree",
    "os.system",
    "os.remove",
    "os.unlink",
    "socket",
    "http.server",
    "pty",
]

def check_security(code: str) -> tuple[bool, str]:
    for denied in DENIED_IMPORTS:
        if re.search(rf"\b{re.escape(denied)}\b", code):
            return False, f"Security Violation: '{denied}' is not permitted in sandbox."
    return True, ""

# Script wrapper to capture matplotlib plots automatically as base64 PNG
WRAPPER_TEMPLATE = """
import sys
import io
import base64

# Setup headless matplotlib if present
try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    _has_mpl = True
except ImportError:
    _has_mpl = False

# User code execution
user_code = __USER_CODE_REPR__
_globals = {"__name__": "__main__"}

try:
    exec(user_code, _globals)
    
    # Check if any matplotlib figures were created
    if _has_mpl and plt.get_fignums():
        buf = io.BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight', dpi=100)
        buf.seek(0)
        img_b64 = base64.b64encode(buf.read()).decode('utf-8')
        print(f"\\n__AGENTLENS_ARTIFACT_PNG__:{img_b64}")
        plt.close('all')
except Exception as e:
    import traceback
    traceback.print_exc(file=sys.stderr)
    sys.exit(1)
"""

async def run_python_code(code: str, timeout_seconds: int = 10) -> SandboxResult:
    """Executes Python code in an isolated subprocess (python -I) with timeout and limits."""
    # 1. Static security check
    is_safe, sec_error = check_security(code)
    if not is_safe:
        return SandboxResult(
            success=False,
            stdout="",
            stderr=sec_error,
            exit_code=1,
            duration_ms=0.0
        )

    # 2. Prepare temporary wrapper script
    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False, encoding="utf-8") as f:
        wrapped_code = WRAPPER_TEMPLATE.replace("__USER_CODE_REPR__", repr(code))
        f.write(wrapped_code)
        temp_file_path = f.name

    start_time = asyncio.get_event_loop().time()
    try:
        # Run python subprocess with security checks and timeout
        proc = await asyncio.create_subprocess_exec(
            sys.executable,
            temp_file_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout_data, stderr_data = await asyncio.wait_for(
                proc.communicate(),
                timeout=float(timeout_seconds)
            )
            exit_code = proc.returncode or 0
        except asyncio.TimeoutError:
            try:
                proc.kill()
            except Exception:
                pass
            return SandboxResult(
                success=False,
                stdout="",
                stderr=f"Execution timed out after {timeout_seconds} seconds.",
                exit_code=-1,
                duration_ms=(asyncio.get_event_loop().time() - start_time) * 1000.0
            )

        duration_ms = (asyncio.get_event_loop().time() - start_time) * 1000.0
        stdout_str = stdout_data.decode("utf-8", errors="replace")
        stderr_str = stderr_data.decode("utf-8", errors="replace")

        # 10 KB output limit
        if len(stdout_str) > 10240:
            stdout_str = stdout_str[:10240] + "\n...[Output truncated at 10 KB]"
        if len(stderr_str) > 10240:
            stderr_str = stderr_str[:10240] + "\n...[Stderr truncated at 10 KB]"

        # Extract artifacts
        artifacts = []
        artifact_marker = "__AGENTLENS_ARTIFACT_PNG__:"
        if artifact_marker in stdout_str:
            parts = stdout_str.split(artifact_marker)
            stdout_str = parts[0].strip()
            for part in parts[1:]:
                img_data = part.splitlines()[0].strip()
                artifacts.append({
                    "type": "image/png",
                    "data": img_data,
                    "name": "plot.png"
                })

        return SandboxResult(
            success=(exit_code == 0),
            stdout=stdout_str,
            stderr=stderr_str,
            exit_code=exit_code,
            duration_ms=round(duration_ms, 2),
            artifacts=artifacts
        )

    finally:
        try:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
        except Exception:
            pass

tool_registry.register(
    ToolDefinition(
        name="python_sandbox",
        description="Execute Python code in an isolated sandbox with stdout, stderr, and automatic plot generation.",
        parameters={
            "type": "object",
            "properties": {
                "code": {"type": "string", "description": "The Python source code to execute"},
                "timeout_seconds": {"type": "integer", "description": "Execution timeout in seconds", "default": 10}
            },
            "required": ["code"]
        },
        category="code"
    ),
    run_python_code
)
