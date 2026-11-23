import json
import time
from typing import Optional
from backend.app.agents.base import AgentDefinition
from backend.app.db import get_db_connection

# Default built-in agent definitions
BUILT_IN_AGENTS: list[AgentDefinition] = [
    AgentDefinition(
        agent_id="planner",
        name="Planner",
        description="Analyzes goals, decomposes complex problems into small dependent tasks, and assigns tasks to specialized agents.",
        role="Strategic Planning and Task Decomposition",
        instructions="Analyze user goals, identify dependencies, determine agent assignments, and define measurable success criteria.",
        llm_config={"model": "gemini-2.5-flash", "temperature": 0.2},
        allowed_tools=[],
        output_schema={"type": "object", "properties": {"tasks": {"type": "array"}}},
        execution_limits={"max_steps": 5, "timeout_seconds": 60},
        agent_type="built_in",
        enabled=True,
    ),
    AgentDefinition(
        agent_id="researcher",
        name="Researcher",
        description="Conducts web searches, gathers empirical data, identifies authoritative literature, and synthesizes source-backed findings.",
        role="Information Gathering & Technical Research",
        instructions="Use web search to gather high-quality sources, verify factual accuracy, and formulate objective summaries with citations.",
        llm_config={"model": "gemini-2.5-flash", "temperature": 0.2},
        allowed_tools=["web_search", "read_memory", "write_memory"],
        output_schema={"type": "object", "properties": {"summary": {"type": "string"}, "sources": {"type": "array"}}},
        execution_limits={"max_steps": 10, "timeout_seconds": 60},
        agent_type="built_in",
        enabled=True,
    ),
    AgentDefinition(
        agent_id="coder",
        name="Coder",
        description="Writes executable Python code, runs scripts in the isolated sandbox, captures stdout/plots, and performs error self-correction.",
        role="Algorithm Engineering & Sandbox Execution",
        instructions="Write clear, reproducible Python code, execute it in the sandbox, inspect output/errors, self-correct if broken, and generate plots.",
        llm_config={"model": "gemini-2.5-flash", "temperature": 0.1},
        allowed_tools=["python_sandbox", "read_memory", "write_memory"],
        output_schema={"type": "object", "properties": {"code": {"type": "string"}, "stdout": {"type": "string"}}},
        execution_limits={"max_steps": 10, "timeout_seconds": 60},
        agent_type="built_in",
        enabled=True,
    ),
    AgentDefinition(
        agent_id="critic",
        name="Critic",
        description="Rigorously inspects completed tasks, evaluates success criteria, scores outputs (0-10), and directs retries if needed.",
        role="Quality Evaluation & Verification",
        instructions="Evaluate results strictly against criteria. Demand retries on failures or hallucinations. Offer actionable constructive feedback.",
        llm_config={"model": "gemini-2.5-flash", "temperature": 0.1},
        allowed_tools=[],
        output_schema={"type": "object", "properties": {"score": {"type": "number"}, "verdict": {"type": "string"}}},
        execution_limits={"max_steps": 5, "timeout_seconds": 45},
        agent_type="built_in",
        enabled=True,
    ),
]

# Sample pre-registered Custom Agents to showcase out-of-the-box flexibility
DEFAULT_CUSTOM_AGENTS: list[AgentDefinition] = [
    AgentDefinition(
        agent_id="security_reviewer",
        name="Security Reviewer",
        description="Inspects Python scripts, dependencies, and queries for security risks, injection threats, or insecure sandbox practices.",
        role="Cybersecurity & Code Audit Specialist",
        instructions="Analyze generated code for unsafe operations, sensitive data exposure, and security vulnerabilities.",
        llm_config={"model": "gemini-2.5-flash", "temperature": 0.1},
        allowed_tools=["read_memory"],
        output_schema={"type": "object", "properties": {"security_score": {"type": "number"}, "vulnerabilities": {"type": "array"}}},
        execution_limits={"max_steps": 5, "timeout_seconds": 45},
        agent_type="custom",
        enabled=True,
    ),
    AgentDefinition(
        agent_id="fact_checker",
        name="Fact Checker",
        description="Cross-references research claims and citations against authoritative benchmarks and scientific literature.",
        role="Truth & Verification Analyst",
        instructions="Cross-examine extracted facts, check claim veracity, verify publication years and metrics, and flag any discrepancies.",
        llm_config={"model": "gemini-2.5-flash", "temperature": 0.1},
        allowed_tools=["web_search", "read_memory"],
        output_schema={"type": "object", "properties": {"factual_accuracy": {"type": "number"}, "claims": {"type": "array"}}},
        execution_limits={"max_steps": 8, "timeout_seconds": 60},
        agent_type="custom",
        enabled=True,
    ),
]

class AgentRegistry:
    def __init__(self):
        self._ensure_defaults_seeded()

    def _ensure_defaults_seeded(self):
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            for agent in BUILT_IN_AGENTS + DEFAULT_CUSTOM_AGENTS:
                cursor.execute(
                    """
                    INSERT OR IGNORE INTO agents 
                    (agent_id, name, description, role, instructions, model_config_json, 
                     allowed_tools_json, output_schema_json, execution_limits_json, agent_type, enabled, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        agent.agent_id,
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
            conn.commit()
        finally:
            conn.close()

    def list_agents(self, agent_type: Optional[str] = None, enabled_only: bool = False) -> list[AgentDefinition]:
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            query = "SELECT * FROM agents WHERE 1=1"
            params: list[Any] = []
            if agent_type:
                query += " AND agent_type = ?"
                params.append(agent_type)
            if enabled_only:
                query += " AND enabled = 1"
            query += " ORDER BY agent_type DESC, name ASC"

            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [self._row_to_agent(row) for row in rows]
        finally:
            conn.close()

    def get_agent(self, agent_id: str) -> Optional[AgentDefinition]:
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM agents WHERE agent_id = ?", (agent_id,))
            row = cursor.fetchone()
            return self._row_to_agent(row) if row else None
        finally:
            conn.close()

    def create_agent(self, agent: AgentDefinition) -> AgentDefinition:
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            now = time.time()
            cursor.execute(
                """
                INSERT INTO agents 
                (agent_id, name, description, role, instructions, model_config_json, 
                 allowed_tools_json, output_schema_json, execution_limits_json, agent_type, enabled, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    agent.agent_id,
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
            conn.commit()
            return self.get_agent(agent.agent_id) # type: ignore
        finally:
            conn.close()

    def update_agent(self, agent_id: str, updates: dict[str, Any]) -> Optional[AgentDefinition]:
        current = self.get_agent(agent_id)
        if not current:
            return None

        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            now = time.time()
            cursor.execute(
                """
                UPDATE agents SET
                    name = ?,
                    description = ?,
                    role = ?,
                    instructions = ?,
                    model_config_json = ?,
                    allowed_tools_json = ?,
                    output_schema_json = ?,
                    execution_limits_json = ?,
                    enabled = ?,
                    updated_at = ?
                WHERE agent_id = ?
                """,
                (
                    updates.get("name", current.name),
                    updates.get("description", current.description),
                    updates.get("role", current.role),
                    updates.get("instructions", current.instructions),
                    json.dumps(updates.get("llm_config", current.llm_config)),
                    json.dumps(updates.get("allowed_tools", current.allowed_tools)),
                    json.dumps(updates.get("output_schema", current.output_schema)),
                    json.dumps(updates.get("execution_limits", current.execution_limits)),
                    1 if updates.get("enabled", current.enabled) else 0,
                    now,
                    agent_id,
                ),
            )
            conn.commit()
            return self.get_agent(agent_id)
        finally:
            conn.close()

    def delete_agent(self, agent_id: str) -> bool:
        agent = self.get_agent(agent_id)
        if not agent or agent.agent_type == "built_in":
            return False  # Cannot delete built-in agents

        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM agents WHERE agent_id = ?", (agent_id,))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    def _row_to_agent(self, row: Any) -> AgentDefinition:
        return AgentDefinition(
            agent_id=row["agent_id"],
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

agent_registry = AgentRegistry()
