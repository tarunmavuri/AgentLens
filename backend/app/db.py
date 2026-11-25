"""SQLite storage layer.

The platform is event-sourced: `events` is the source of truth and every
dashboard metric is derived from it. Connections are created per operation
(SQLite objects are not shared across threads) with WAL enabled so the SSE
readers do not block the orchestrator's writes.
"""

import sqlite3
from contextlib import contextmanager
from typing import Iterator

from backend.app.config import settings

SCHEMA_VERSION = 2


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(
        settings.db_path,
        check_same_thread=False,
        timeout=15.0,
    )
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA busy_timeout=15000")
    return conn


@contextmanager
def db_connection() -> Iterator[sqlite3.Connection]:
    """Context manager that always closes the connection and commits on success."""
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS runs (
            id TEXT PRIMARY KEY,
            goal TEXT NOT NULL,
            config_json TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at REAL NOT NULL,
            totals_json TEXT NOT NULL
        )
        """
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at DESC)")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS events (
            run_id TEXT NOT NULL,
            id INTEGER NOT NULL,
            ts REAL NOT NULL,
            type TEXT NOT NULL,
            agent_id TEXT NOT NULL,
            agent_category TEXT NOT NULL,
            task_id TEXT,
            payload_json TEXT NOT NULL,
            concept TEXT,
            usage_json TEXT,
            PRIMARY KEY (run_id, id)
        )
        """
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_events_agent ON events(agent_id, run_id)"
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS agents (
            agent_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            role TEXT NOT NULL,
            instructions TEXT NOT NULL,
            model_config_json TEXT NOT NULL,
            allowed_tools_json TEXT NOT NULL,
            output_schema_json TEXT NOT NULL,
            execution_limits_json TEXT NOT NULL,
            agent_type TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL
        )
        """
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(agent_type, enabled)")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS memory (
            run_id TEXT NOT NULL,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            created_at REAL NOT NULL,
            PRIMARY KEY (run_id, key)
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
        """
    )

    cursor.execute(
        "INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)",
        (str(SCHEMA_VERSION),),
    )

    conn.commit()
    conn.close()


def get_meta(key: str) -> str | None:
    with db_connection() as conn:
        row = conn.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
        return row["value"] if row else None


def set_meta(key: str, value: str) -> None:
    with db_connection() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", (key, value)
        )
