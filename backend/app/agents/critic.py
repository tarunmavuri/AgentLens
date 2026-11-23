import time
from typing import Any, Callable, Awaitable
from backend.app.agents.base import TaskDefinition, AgentResult, CriticEvaluation
from backend.app.events import Event, Usage
from backend.app.llm import llm_client

class CriticAgent:
    def __init__(self):
        self.agent_id = "critic"
        self.name = "Critic"
        self.category = "built_in"

    async def evaluate_task(
        self,
        task: TaskDefinition,
        result: AgentResult,
        retry_count: int,
        emit_event: Callable[[str, dict[str, Any], str, str | None, Usage | None], Awaitable[None]]
    ) -> CriticEvaluation:
        start_time = time.time()

        system_prompt = (
            "You are the Lead Critic & Evaluator Agent in AgentLens. "
            "Your role is to rigorously evaluate completed task outputs against their defined success criteria. "
            "You assign a score from 0.0 to 10.0, decide whether to 'accept' or request a 'retry' (maximum 2 retries), "
            "and provide actionable, constructive critique feedback."
        )
        prompt = (
            f"Task Title: {task.title}\n"
            f"Success Criteria: {task.success_criteria}\n"
            f"Executing Agent: {result.agent_id}\n"
            f"Status: {result.status}\n"
            f"Summary: {result.summary}\n"
            f"Structured Output: {result.structured_output}\n"
            f"Current Retry Count: {retry_count}\n\n"
            "Evaluate whether this output meets the success criteria. "
            "If it fails or has major errors, request a retry (if retry_count < 2) with clear instructions."
        )

        def mock_critic(p: str) -> dict[str, Any]:
            # If the task failed completely (e.g. sandbox error or empty search)
            if result.status == "failed" or "error" in result.summary.lower():
                if retry_count < 2:
                    return {
                        "score": 4.5,
                        "verdict": "retry",
                        "feedback": "Execution encountered an error. Please adjust the parameters and retry.",
                        "failed_criteria": ["Execution was not successful"],
                        "suggested_corrections": ["Check error trace and fix variable bindings."]
                    }
                else:
                    return {
                        "score": 5.5,
                        "verdict": "accept",
                        "feedback": "Completed with partial warnings after maximum retry budget reached.",
                        "failed_criteria": [],
                        "suggested_corrections": []
                    }

            # High quality output
            return {
                "score": 9.2,
                "verdict": "accept",
                "feedback": "Outstanding execution. Meets and exceeds all specified criteria with concrete evidence and validation.",
                "failed_criteria": [],
                "suggested_corrections": []
            }

        evaluation, usage = await llm_client.generate_structured(
            schema=CriticEvaluation,
            system_instruction=system_prompt,
            prompt=prompt,
            mock_response_generator=mock_critic
        )

        # Emit critique event (Concept: Reflection)
        await emit_event(
            "critique",
            {
                "score": evaluation.score,
                "verdict": evaluation.verdict,
                "feedback": evaluation.feedback,
                "failed_criteria": evaluation.failed_criteria,
                "suggested_corrections": evaluation.suggested_corrections,
                "retry_count": retry_count
            },
            "reflection",
            task.id,
            usage
        )

        return evaluation

critic_agent = CriticAgent()

