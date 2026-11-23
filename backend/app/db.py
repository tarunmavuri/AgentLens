import sqlite3
import json
from typing import Any, Optional
from backend.app.config import settings

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Runs table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS runs (
            id TEXT PRIMARY KEY,
            goal TEXT NOT NULL,
            config_json TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at REAL NOT NULL,
            totals_json TEXT NOT NULL
        )
    """)

    # Events table
    cursor.execute("""
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
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_run_id ON events(run_id)")

    # Agents table (supports built-in and custom agents)
    cursor.execute("""
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
            agent_type TEXT NOT NULL, -- 'built_in' or 'custom'
            enabled INTEGER NOT NULL DEFAULT 1,
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL
        )
    """)

    # Run-scoped memory table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS memory (
            run_id TEXT NOT NULL,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            created_at REAL NOT NULL,
            PRIMARY KEY (run_id, key)
        )
    """)

    conn.commit()
    conn.close()

