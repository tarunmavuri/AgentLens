import time
from typing import Optional
from backend.app.db import get_db_connection
from backend.app.tools.registry import ToolDefinition, tool_registry

class RunMemory:
    """Run-scoped key-value memory stored in SQLite."""

    @staticmethod
    def get(run_id: str, key: str) -> Optional[str]:
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM memory WHERE run_id = ? AND key = ?", (run_id, key))
            row = cursor.fetchone()
            return row["value"] if row else None
        finally:
            conn.close()

    @staticmethod
    def set(run_id: str, key: str, value: str):
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO memory (run_id, key, value, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (run_id, key, value, time.time())
            )
            conn.commit()
        finally:
            conn.close()

    @staticmethod
    def list_all(run_id: str) -> dict[str, str]:
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT key, value FROM memory WHERE run_id = ?", (run_id,))
            rows = cursor.fetchall()
            return {row["key"]: row["value"] for row in rows}
        finally:
            conn.close()

async def read_memory(run_id: str, key: str) -> str:
    val = RunMemory.get(run_id, key)
    return val if val is not None else ""

async def write_memory(run_id: str, key: str, value: str) -> str:
    RunMemory.set(run_id, key, value)
    return f"Stored key '{key}' in run memory."

tool_registry.register(
    ToolDefinition(
        name="read_memory",
        description="Read an entry from the run-scoped memory key-value store.",
        parameters={
            "type": "object",
            "properties": {
                "run_id": {"type": "string", "description": "The current run ID"},
                "key": {"type": "string", "description": "The key to read"}
            },
            "required": ["run_id", "key"]
        },
        category="memory"
    ),
    read_memory
)

tool_registry.register(
    ToolDefinition(
        name="write_memory",
        description="Write an entry to the run-scoped memory key-value store.",
        parameters={
            "type": "object",
            "properties": {
                "run_id": {"type": "string", "description": "The current run ID"},
                "key": {"type": "string", "description": "The key to store"},
                "value": {"type": "string", "description": "The value string"}
            },
            "required": ["run_id", "key", "value"]
        },
        category="memory"
    ),
    write_memory
)

