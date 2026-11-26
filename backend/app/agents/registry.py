"""Dynamic agent registry backed by SQLite.

Built-in and custom agents live in the same table and share one execution
contract, so the orchestrator never needs to know how an agent was created.
"""

from __future__ import annotations

import json
import sqlite3
import time
from typing import Any, Optional

from backend.app.agents.base import AgentDefinition
from backend.app.config import settings
from backend.app.db import db_connection, get_db_connection
from backend.app.tools.registry import tool_registry

# Agents the orchestrator itself drives; they cannot be assigned worker tasks.
SYSTEM_AGENT_IDS = {"planner", "critic"}

BUILT_IN_AGENTS: list[AgentDefinition] = [
    AgentDefinition(
        agent_id="planner",
        name="Planner",
        description="Decomposes goals into dependent tasks and assigns them to registered agents.",
        role="Strategic Planning and Task Decomposition",
        instructions="Analyse the goal, identify dependencies, assign agents, and define measurable success criteria.",
        llm_config={"model": settings.default_model, "temperature": 0.2},
        allowed_tools=[],
        output_schema={"type": "object", "properties": {"tasks": {"type": "array"}}},
        execution_limits={"max_steps": 5, "timeout_seconds": 60},
        agent_type="built_in",
        enabled=True,
    ),
    AgentDefinition(
        agent_id="researcher",
        name="Researcher",
        description="Searches the web, gathers evidence, and synthesises source-backed findings.",
        role="Information Gathering & Technical Research",
        instructions="Use web search to gather sources, verify factual accuracy, and summarise with citations.",
        llm_config={"model": settings.default_model, "temperature": 0.2},
        allowed_tools=["web_search", "read_memory", "write_memory"],
        output_schema={
            "type": "object",
            "properties": {"summary": {"type": "string"}, "sources": {"type": "array"}},
        },
        execution_limits={"max_steps": 10, "timeout_seconds": 90},
        agent_type="built_in",
        enabled=True,
    ),
    AgentDefinition(
        agent_id="coder",
        name="Coder",
        description="Writes Python, executes it in the sandbox, captures output and plots, and self-corrects.",
        role="Algorithm Engineering & Sandbox Execution",
        instructions="Write reproducible Python, execute it, inspect errors, repair failures, and plot results.",
        llm_config={"model": settings.default_model, "temperature": 0.1},
        allowed_tools=["python_sandbox", "read_memory", "write_memory"],
        output_schema={
            "type": "object",
            "properties": {"code": {"type": "string"}, "stdout": {"type": "string"}},
        },
        execution_limits={"max_steps": 10, "timeout_seconds": 90},
        agent_type="built_in",
        enabled=True,
    ),
    AgentDefinition(
        agent_id="critic",
        name="Critic",
        description="Scores task outputs against success criteria and directs retries.",
        role="Quality Evaluation & Verification",
        instructions="Evaluate strictly against criteria, score 0-10, and demand retries with actionable feedback.",
        llm_config={"model": settings.default_model, "temperature": 0.1},
        allowed_tools=[],
        output_schema={
            "type": "object",
            "properties": {"score": {"type": "number"}, "verdict": {"type": "string"}},
        },
        execution_limits={"max_steps": 5, "timeout_seconds": 45},
        agent_type="built_in",
        enabled=True,
    ),
]

# Pre-registered custom agents so the builder has working examples out of the box.
DEFAULT_CUSTOM_AGENTS: list[AgentDefinition] = [
    AgentDefinition(
        agent_id="security_reviewer",
        name="Security Reviewer",
        description="Audits generated code, dependencies and queries for security risks and unsafe practices.",
        role="Cybersecurity & Code Audit Specialist",
        instructions="Analyse generated artefacts for unsafe operations, data exposure and injection risks.",
        llm_config={"model": settings.default_model, "temperature": 0.1},
        allowed_tools=["read_memory"],
        output_schema={
            "type": "object",
            "properties": {
                "security_score": {"type": "number"},
                "vulnerabilities": {"type": "array"},
            },
        },
        execution_limits={"max_steps": 5, "timeout_seconds": 60},
        agent_type="custom",
        enabled=True,
    ),
    AgentDefinition(
        agent_id="fact_checker",
        name="Fact Checker",
        description="Cross-references research claims and citations against independent sources.",
        role="Truth & Verification Analyst",
        instructions="Cross-examine claims, verify citations and metrics, and flag discrepancies.",
        llm_config={"model": settings.default_model, "temperature": 0.1},
        allowed_tools=["web_search", "read_memory"],
        output_schema={
            "type": "object",
            "properties": {
                "factual_accuracy": {"type": "number"},
                "claims": {"type": "array"},
            },
        },
        execution_limits={"max_steps": 8, "timeout_seconds": 90},
        agent_type="custom",
        enabled=True,
    ),
]


class AgentValidationError(ValueError):
    """Raised when a custom agent configuration is invalid."""


def validate_agent_definition(agent: AgentDefinition) -> AgentDefinition:
    """Validate and normalise a user-supplied agent configuration."""
    if not agent.name.strip():
        raise AgentValidationError("Agent name is required.")
    if not agent.role.strip():
        raise AgentValidationError("Agent role is required.")
    if len(agent.instructions.strip()) < 10:
        raise AgentValidationError("System instructions must be at least 10 characters.")

    model = agent.llm_config.get("model", settings.default_model)
    if model not in settings.allowed_models:
        raise AgentValidationError(
            f"Unsupported model '{model}'. Choose one of: {', '.join(settings.allowed_models)}."
        )

    try:
        temperature = float(agent.llm_config.get("temperature", 0.2))
    except (TypeError, ValueError) as exc:
        raise AgentValidationError("Temperature must be a number between 0 and 1.") from exc
    if not 0.0 <= temperature <= 1.0:
        raise AgentValidationError("Temperature must be between 0 and 1.")

    known_tools = {tool.name for tool in tool_registry.list_tools()}
    unknown = [tool for tool in agent.allowed_tools if tool not in known_tools]
    if unknown:
        raise AgentValidationError(
            f"Unknown tool(s): {', '.join(unknown)}. Available: {', '.join(sorted(known_tools))}."
        )

    if not isinstance(agent.output_schema, dict):
        raise AgentValidationError("Output schema must be a JSON object.")

    max_steps = agent.execution_limits.get("max_steps", 5)
    timeout = agent.execution_limits.get("timeout_seconds", 60)
    if not isinstance(max_steps, int) or not 1 <= max_steps <= 20:
        raise AgentValidationError("max_steps must be an integer between 1 and 20.")
    if not isinstance(timeout, int) or not 5 <= timeout <= 300:
        raise AgentValidationError("timeout_seconds must be an integer between 5 and 300.")

    agent.llm_config["model"] = model
    agent.llm_config["temperature"] = temperature
    agent.execution_limits["max_steps"] = max_steps
    agent.execution_limits["timeout_seconds"] = timeout
    return agent


class AgentRegistry:
    """Reads and writes agent definitions; no state is cached in memory."""

    # ---------------------------------------------------------------- seeding
    def seed_defaults(self) -> None:
        with db_connection() as conn:
            self._insert_missing(conn, BUILT_IN_AGENTS + DEFAULT_CUSTOM_AGENTS)
        self.sync_builtin_definitions()

    def _insert_missing(self, conn: sqlite3.Connection, agents: list[AgentDefinition]) -> None:
        for agent in agents:
            conn.execute(
                """
                INSERT OR IGNORE INTO agents
                (agent_id, user_id, name, description, role, instructions, model_config_json,
                 allowed_tools_json, output_schema_json, execution_limits_json,
                 agent_type, enabled, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    agent.agent_id,
                    "system",
                    agent.name,
                    agent.description,
                    agent.role,
                    agent.instructions,
                    json.dumps(agent.llm_config),
                    json.dumps(agent.allowed_tools),
                    json.dumps(agent.output_schema),
                    json.dumps(agent.execution_limits),
                    agent.agent_type,
                    1 if agent.enabled else 0,
                    agent.created_at,
                    agent.updated_at,
                ),
            )

    def sync_builtin_definitions(self) -> None:
        """Keep built-in code definitions authoritative while preserving enabled flags."""
        with db_connection() as conn:
            for agent in BUILT_IN_AGENTS:
                conn.execute(
                    """
                    UPDATE agents SET
                        name = ?, description = ?, role = ?, instructions = ?,
                        model_config_json = ?, allowed_tools_json = ?,
                        output_schema_json = ?, execution_limits_json = ?, updated_at = ?
                    WHERE agent_id = ? AND agent_type = 'built_in'
                    """,
                    (
                        agent.name,
                        agent.description,
                        agent.role,
                        agent.instructions,
                        json.dumps(agent.llm_config),
                        json.dumps(agent.allowed_tools),
                        json.dumps(agent.output_schema),
                        json.dumps(agent.execution_limits),
                        time.time(),
                        agent.agent_id,
                    ),
                )

    # ------------------------------------------------------------------- read
    def list_agents(
        self,
        agent_type: Optional[str] = None,
        enabled_only: bool = False,
        user_id: Optional[str] = None,
    ) -> list[AgentDefinition]:
        query = "SELECT * FROM agents WHERE 1=1"
        params: list[Any] = []
        if user_id is not None:
            query += " AND (user_id = 'system' OR user_id = ?)"
            params.append(user_id)
        if agent_type:
            query += " AND agent_type = ?"
            params.append(agent_type)
        if enabled_only:
            query += " AND enabled = 1"
        query += " ORDER BY agent_type ASC, name ASC"

        with db_connection() as conn:
            rows = conn.execute(query, params).fetchall()
            return [self._row_to_agent(row) for row in rows]

    def get_agent(
        self, agent_id: str, user_id: Optional[str] = None
    ) -> Optional[AgentDefinition]:
        query = "SELECT * FROM agents WHERE agent_id = ?"
        params: list[Any] = [agent_id]
        if user_id is not None:
            query += " AND (user_id = 'system' OR user_id = ?)"
            params.append(user_id)
        with db_connection() as conn:
            row = conn.execute(query, params).fetchone()
            return self._row_to_agent(row) if row else None

    def list_worker_agents(
        self, enabled_only: bool = True, user_id: Optional[str] = None
    ) -> list[AgentDefinition]:
        return [
            agent
            for agent in self.list_agents(enabled_only=enabled_only, user_id=user_id)
            if agent.agent_id not in SYSTEM_AGENT_IDS
        ]

    # ------------------------------------------------------------------ write
    def create_agent(
        self, agent: AgentDefinition, user_id: Optional[str] = None
    ) -> AgentDefinition:
        validate_agent_definition(agent)
        if agent.agent_id in SYSTEM_AGENT_IDS:
            raise AgentValidationError("Agent id collides with a system agent.")

        owner_id = user_id if user_id is not None else agent.user_id
        now = time.time()
        try:
            with db_connection() as conn:
                conn.execute(
                    """
                    INSERT INTO agents
                    (agent_id, user_id, name, description, role, instructions, model_config_json,
                     allowed_tools_json, output_schema_json, execution_limits_json,
                     agent_type, enabled, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        agent.agent_id,
                        owner_id,
                        agent.name,
                        agent.description,
                        agent.role,
                        agent.instructions,
                        json.dumps(agent.llm_config),
                        json.dumps(agent.allowed_tools),
                        json.dumps(agent.output_schema),
                        json.dumps(agent.execution_limits),
                        agent.agent_type,
                        1 if agent.enabled else 0,
                        now,
                        now,
                    ),
                )
        except sqlite3.IntegrityError as exc:
            raise AgentValidationError(f"Agent '{agent.agent_id}' already exists.") from exc

        created = self.get_agent(agent.agent_id)
        if created is None:  # pragma: no cover - defensive
            raise AgentValidationError("Agent could not be persisted.")
        return created

    def update_agent(
        self,
        agent_id: str,
        updates: dict[str, Any],
        user_id: Optional[str] = None,
    ) -> Optional[AgentDefinition]:
        current = self.get_agent(agent_id, user_id=user_id)
        if not current:
            return None
        if user_id is not None and current.user_id != user_id:
            return None

        merged = current.model_copy(
            update={
                "name": updates.get("name", current.name),
                "description": updates.get("description", current.description),
                "role": updates.get("role", current.role),
                "instructions": updates.get("instructions", current.instructions),
                "llm_config": updates.get("llm_config", current.llm_config),
                "allowed_tools": updates.get("allowed_tools", current.allowed_tools),
                "output_schema": updates.get("output_schema", current.output_schema),
                "execution_limits": updates.get("execution_limits", current.execution_limits),
                "enabled": updates.get("enabled", current.enabled),
            }
        )
        validate_agent_definition(merged)

        with db_connection() as conn:
            conn.execute(
                """
                UPDATE agents SET
                    name = ?, description = ?, role = ?, instructions = ?,
                    model_config_json = ?, allowed_tools_json = ?, output_schema_json = ?,
                    execution_limits_json = ?, enabled = ?, updated_at = ?
                WHERE agent_id = ?
                """,
                (
                    merged.name,
                    merged.description,
                    merged.role,
                    merged.instructions,
                    json.dumps(merged.llm_config),
                    json.dumps(merged.allowed_tools),
                    json.dumps(merged.output_schema),
                    json.dumps(merged.execution_limits),
                    1 if merged.enabled else 0,
                    time.time(),
                    agent_id,
                ),
            )
        return self.get_agent(agent_id)

    def delete_agent(self, agent_id: str, user_id: Optional[str] = None) -> bool:
        agent = self.get_agent(agent_id, user_id=user_id)
        if not agent or agent.agent_type == "built_in":
            return False
        if user_id is not None and agent.user_id != user_id:
            return False
        with db_connection() as conn:
            cursor = conn.execute("DELETE FROM agents WHERE agent_id = ?", (agent_id,))
            return cursor.rowcount > 0

    def _row_to_agent(self, row: Any) -> AgentDefinition:
        return AgentDefinition(
            agent_id=row["agent_id"],
            user_id=row["user_id"] if "user_id" in row.keys() else "system",
            name=row["name"],
            description=row["description"],
            role=row["role"],
            instructions=row["instructions"],
            llm_config=json.loads(row["model_config_json"]),
            allowed_tools=json.loads(row["allowed_tools_json"]),
            output_schema=json.loads(row["output_schema_json"]),
            execution_limits=json.loads(row["execution_limits_json"]),
            agent_type=row["agent_type"],
            enabled=bool(row["enabled"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )


def seed_default_agents() -> None:
    """Idempotently seed built-in and example custom agents."""
    agent_registry.seed_defaults()


agent_registry = AgentRegistry()
