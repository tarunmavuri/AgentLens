import time
from typing import Any, Callable, Awaitable
from backend.app.agents.base import TaskDefinition, AgentResult, AgentDefinition
from backend.app.events import Event, Usage
from backend.app.tools.registry import tool_registry
from backend.app.tools.memory import RunMemory
from backend.app.llm import llm_client
from pydantic import BaseModel, create_model

class CustomAgentRunner:
    """Executes a custom user-defined agent based on its configuration."""

    def __init__(self, definition: AgentDefinition):
        self.definition = definition
        self.agent_id = definition.agent_id
        self.name = definition.name
        self.category = definition.agent_type # "custom"

    async def execute_task(
        self,
        run_id: str,
        task: TaskDefinition,
        emit_event: Callable[[str, dict[str, Any], str, str | None, Usage | None], Awaitable[None]],
        fault_injector: Any = None
    ) -> AgentResult:
        start_time = time.time()
        memory_context = RunMemory.list_all(run_id)

        system_instruction = (
            f"You are the '{self.definition.name}' agent in AgentLens.\n"
            f"Role: {self.definition.role}\n"
            f"Instructions:\n{self.definition.instructions}\n\n"
            f"Allowed Tools: {', '.join(self.definition.allowed_tools) if self.definition.allowed_tools else 'None'}.\n"
            "Strictly follow your role and instructions."
        )

        prompt = (
            f"Task: {task.title}\n"
            f"Description: {task.description}\n"
            f"Success Criteria: {task.success_criteria}\n"
            f"Memory Context: {memory_context}\n\n"
            "Execute this task thoroughly and return your findings."
        )

        # Dynamic output model
        class CustomOutput(BaseModel):
            thought: str
            summary: str
            details: dict[str, Any] = {}
            score: float = 9.0

        def mock_custom(p: str) -> dict[str, Any]:
            return {
                "thought": f"Executing specialized task as {self.name}.",
                "summary": f"Completed analysis for '{task.title}' according to {self.name} specifications. Verified against role guidelines.",
                "details": {
                    "role": self.definition.role,
                    "criteria_evaluated": task.success_criteria,
                    "findings": "All validation checkpoints passed without critical anomalies."
                },
                "score": 9.5
            }

        # 1. Thought phase
        parsed, usage = await llm_client.generate_structured(
            schema=CustomOutput,
            system_instruction=system_instruction,
            prompt=prompt,
            model=self.definition.llm_config.get("model", "gemini-2.5-flash"),
            mock_response_generator=mock_custom
        )

        await emit_event(
            "thought",
            {"thought": parsed.thought, "agent": self.name},
            "react",
            task.id,
            usage
        )

        # 2. Tool calls if agent has allowed tools
        allowed_tools = self.definition.allowed_tools
        if "web_search" in allowed_tools:
            search_query = f"{task.title} verification"
            await emit_event(
                "tool_call",
                {"tool": "web_search", "args": {"query": search_query}},
                "tool_use",
                task.id,
                None
            )
            # Execute with tool registry
            res = await tool_registry.execute("web_search", query=search_query)
            await emit_event(
                "tool_result",
                {"tool": "web_search", "result": res},
                "tool_use",
                task.id,
                None
            )

        duration = time.time() - start_time
        return AgentResult(
            agent_id=self.agent_id,
            task_id=task.id,
            status="completed",
            summary=parsed.summary,
            structured_output=parsed.model_dump(),
            artifacts=[],
            usage=usage,
            execution_duration=round(duration, 2)
        )
