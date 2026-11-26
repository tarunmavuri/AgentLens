"""Hand-written, event-sourced multi-agent state machine.

Guarantees:
* tasks run in dependency order (cycles are broken deterministically);
* only enabled agents from the registry can be dispatched, and built-in and
  custom agents share one contract;
* every task is wrapped in a timeout and a failure is recorded rather than
  aborting the whole run;
* retries receive the Critic's feedback;
* every transition is an immutable, ordered event persisted before it is
  streamed, so replay and export never re-run a model.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, Optional

from backend.app.agents.base import AgentDefinition, AgentResult, Plan, TaskDefinition
from backend.app.agents.coder import coder_agent
from backend.app.agents.critic import critic_agent
from backend.app.agents.custom_agent import CustomAgentRunner
from backend.app.agents.planner import planner_agent
from backend.app.agents.registry import SYSTEM_AGENT_IDS, agent_registry
from backend.app.agents.researcher import researcher_agent
from backend.app.config import settings
from backend.app.db import db_connection
from backend.app.events import STEP_EVENT_TYPES, Event, EventType, Usage, event_bus
from backend.app.guardrails import GuardrailExceeded, GuardrailLimits, GuardrailManager
from backend.app.llm import llm_client
from backend.app.tools.faults import FaultConfig, FaultInjector
from backend.app.tools.memory import RunMemory

logger = logging.getLogger(__name__)

STATUS_COMPLETED = "completed"
STATUS_COMPLETED_WITH_ERRORS = "completed_with_errors"
STATUS_FAILED = "failed"


async def run_agent_task(
    agent: AgentDefinition,
    run_id: str,
    task: TaskDefinition,
    emit_event: Any,
    fault_injector: Any = None,
    feedback: str = "",
) -> AgentResult:
    """Single dispatch point shared by the orchestrator and the agent test endpoint."""
    if agent.agent_type == "built_in":
        if agent.agent_id == "researcher":
            return await researcher_agent.execute_task(
                run_id, task, emit_event, fault_injector, agent_def=agent, feedback=feedback
            )
        if agent.agent_id == "coder":
            return await coder_agent.execute_task(
                run_id, task, emit_event, fault_injector, agent_def=agent, feedback=feedback
            )
        raise ValueError(
            f"Built-in agent '{agent.agent_id}' has no worker runner."
        )
    return await CustomAgentRunner(agent).execute_task(
        run_id, task, emit_event, fault_injector, feedback=feedback
    )


class Orchestrator:
    def __init__(
        self,
        run_id: str,
        goal: str,
        config: Optional[dict[str, Any]] = None,
        fault_config: Optional[FaultConfig] = None,
        user_id: str = "system",
    ) -> None:
        self.run_id = run_id
        self.user_id = user_id
        self.goal = goal
        self.config = config or {}
        self.event_seq = 0
        self.max_retries = max(
            0, int(self.config.get("max_retries", settings.max_retries_default))
        )
        self.guardrails = GuardrailManager(
            GuardrailLimits(
                max_steps=int(self.config.get("max_steps", settings.max_steps_default)),
                max_tokens=int(self.config.get("max_tokens", settings.max_tokens_default)),
                max_seconds=float(
                    self.config.get("max_seconds", settings.max_seconds_default)
                ),
            )
        )
        self.fault_injector = FaultInjector(fault_config)
        self.totals: dict[str, Any] = {
            "in_tokens": 0,
            "out_tokens": 0,
            "cost_usd": 0.0,
            "duration_seconds": 0.0,
            "steps": 0,
            "retries": 0,
            "tool_calls": 0,
            "faults_injected": 0,
            "critic_scores": [],
            "average_critic_score": None,
            "failed_tasks": [],
            "llm_latency_ms": 0.0,
        }
        self.plan: Optional[Plan] = None
        self.task_results: dict[str, AgentResult] = {}

    # ------------------------------------------------------------------ events
    async def emit(
        self,
        event_type: EventType,
        payload: dict[str, Any],
        concept: Optional[str] = None,
        agent_id: str = "system",
        agent_category: str = "system",
        task_id: Optional[str] = None,
        usage: Optional[Usage] = None,
    ) -> None:
        if event_type in STEP_EVENT_TYPES:
            ok, error = self.guardrails.check_step()
            if not ok:
                raise GuardrailExceeded(error or "Step budget exceeded")

        if usage is not None:
            self.guardrails.add_tokens(usage.in_tokens + usage.out_tokens)
            self.totals["in_tokens"] += usage.in_tokens
            self.totals["out_tokens"] += usage.out_tokens
            self.totals["cost_usd"] = round(
                self.totals["cost_usd"] + usage.cost_usd, 6
            )
            self.totals["llm_latency_ms"] = round(
                self.totals["llm_latency_ms"] + usage.latency_ms, 2
            )

        if event_type == "tool_call":
            self.totals["tool_calls"] += 1
        if event_type == "fault_injected":
            self.totals["faults_injected"] += 1

        for warning in self.guardrails.check_warnings():
            self.event_seq += 1
            await event_bus.publish(
                Event(
                    id=self.event_seq,
                    run_id=self.run_id,
                    type="guardrail_warning",
                    agent_id="system",
                    agent_category="system",
                    task_id=task_id,
                    payload={"warning": warning},
                    concept="guardrails",
                )
            )

        self.event_seq += 1
        await event_bus.publish(
            Event(
                id=self.event_seq,
                run_id=self.run_id,
                type=event_type,
                agent_id=agent_id,
                agent_category=agent_category,
                task_id=task_id,
                payload=payload,
                concept=concept,
                usage=usage,
            )
        )

    # --------------------------------------------------------------------- run
    async def run(self) -> None:
        started = time.time()
        self._save_run_state("running")

        try:
            await self.emit(
                "run_started",
                {
                    "goal": self.goal,
                    "config": self.config,
                    "llm_mode": llm_client.mode,
                    "default_model": settings.default_model,
                    "fault_injection": self.fault_injector.config.model_dump(),
                    "guardrails": self.guardrails.limits.model_dump(),
                },
                concept="orchestration",
                agent_id="system",
                agent_category="system",
            )

            plan, plan_usage = await self._create_plan()
            self.plan = plan

            await self.emit(
                "plan_created",
                {
                    "tasks": [task.model_dump() for task in plan.tasks],
                    "total_tasks": len(plan.tasks),
                    "reasoning": plan.reasoning,
                },
                concept="planning",
                agent_id="planner",
                agent_category="built_in",
                usage=plan_usage,
            )

            for task in self._execution_order(plan.tasks):
                await self._execute_task(task)

            failed = self.totals["failed_tasks"]
            final_answer = self._compose_final_answer(plan)
            await self.emit(
                "final_answer",
                {
                    "answer": final_answer,
                    "tasks": len(plan.tasks),
                    "failed_tasks": failed,
                },
                concept="evaluation",
                agent_id="system",
                agent_category="system",
            )

            status = STATUS_FAILED if failed else STATUS_COMPLETED
            if failed and len(failed) < len(plan.tasks):
                status = STATUS_COMPLETED_WITH_ERRORS
            self._finalise_totals(started)
            await self.emit(
                "run_finished",
                {
                    "status": status,
                    "totals": self.totals,
                    "final_answer": final_answer,
                    "summary": self._summary_line(status, len(plan.tasks)),
                },
                concept="evaluation",
                agent_id="system",
                agent_category="system",
            )
            self._save_run_state(status)

        except GuardrailExceeded as exc:
            await self._fail_run(str(exc), started, "guardrails")
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception("Run %s failed", self.run_id)
            await self._fail_run(f"{type(exc).__name__}: {exc}", started, "orchestration")

    async def _fail_run(self, error: str, started: float, concept: str) -> None:
        self._finalise_totals(started)
        try:
            await self.emit(
                "run_failed",
                {"error": error, "totals": self.totals},
                concept=concept,
                agent_id="system",
                agent_category="system",
            )
        except Exception:  # pragma: no cover - last resort
            logger.exception("Could not emit run_failed for %s", self.run_id)
        self._save_run_state(STATUS_FAILED)

    # ------------------------------------------------------------------ phases
    async def _create_plan(self) -> tuple[Plan, Usage]:
        available = agent_registry.list_agents(enabled_only=True, user_id=self.user_id)
        timeout = 60.0
        try:
            return await asyncio.wait_for(
                planner_agent.create_plan(self.goal, available), timeout=timeout
            )
        except asyncio.TimeoutError as exc:
            raise RuntimeError(f"Planner timed out after {timeout:.0f}s") from exc

    def _execution_order(self, tasks: list[TaskDefinition]) -> list[TaskDefinition]:
        """Kahn-style ordering; unknown deps are treated as satisfied."""
        by_id = {task.id: task for task in tasks}
        completed: set[str] = set()
        ordered: list[TaskDefinition] = []
        remaining = list(tasks)

        while remaining:
            progressed = False
            for task in list(remaining):
                met = all(
                    dep in completed for dep in task.depends_on if dep in by_id
                )
                if met:
                    ordered.append(task)
                    completed.add(task.id)
                    remaining.remove(task)
                    progressed = True
            if not progressed:
                # Dependency cycle: preserve declared order so the run still ends.
                ordered.extend(remaining)
                break
        return ordered

    async def _execute_task(self, task: TaskDefinition) -> None:
        agent = agent_registry.get_agent(task.assigned_agent_id, user_id=self.user_id)
        if task.assigned_agent_id in SYSTEM_AGENT_IDS:
            await self._record_task_failure(
                task, f"'{task.assigned_agent_id}' is a system agent and cannot execute tasks."
            )
            return
        if agent is None:
            await self._record_task_failure(
                task, f"Assigned agent '{task.assigned_agent_id}' is not registered."
            )
            return
        if not agent.enabled:
            await self._record_task_failure(
                task,
                f"Assigned agent '{agent.name}' is disabled and cannot execute tasks.",
            )
            return

        await self.emit(
            "task_started",
            {"task": task.model_dump()},
            concept="orchestration",
            agent_id="system",
            agent_category="system",
            task_id=task.id,
        )
        await self.emit(
            "agent_started",
            {
                "agent_id": agent.agent_id,
                "name": agent.name,
                "role": agent.role,
                "agent_type": agent.agent_type,
            },
            concept="orchestration",
            agent_id=agent.agent_id,
            agent_category=agent.agent_type,
            task_id=task.id,
        )

        result: Optional[AgentResult] = None
        retry_count = 0
        feedback = ""
        evaluation_verdict = "accept"

        while True:
            result = await self._dispatch(agent, task, feedback)

            async def critic_emitter(
                event_type: str,
                payload: dict[str, Any],
                concept: str,
                task_id: Optional[str],
                usage: Optional[Usage] = None,
            ) -> None:
                await self.emit(
                    event_type,
                    payload,
                    concept=concept,
                    agent_id="critic",
                    agent_category="built_in",
                    task_id=task_id,
                    usage=usage,
                )

            try:
                evaluation = await critic_agent.evaluate_task(
                    task,
                    result,
                    retry_count,
                    critic_emitter,
                    max_retries=self.max_retries,
                )
            except GuardrailExceeded:
                raise
            except Exception as exc:
                logger.exception("Critic failed for task %s", task.id)
                await self.emit(
                    "error",
                    {"error": f"Critic evaluation failed: {type(exc).__name__}: {exc}"},
                    concept="reflection",
                    agent_id="critic",
                    agent_category="built_in",
                    task_id=task.id,
                )
                evaluation_verdict = "accept"
                break

            self.totals["critic_scores"].append(evaluation.score)
            evaluation_verdict = evaluation.verdict

            if evaluation.verdict == "accept" or retry_count >= self.max_retries:
                break

            retry_count += 1
            self.totals["retries"] += 1
            feedback = evaluation.feedback
            if evaluation.suggested_corrections:
                feedback += " Corrections: " + "; ".join(evaluation.suggested_corrections)
            await self.emit(
                "retry",
                {
                    "attempt": retry_count,
                    "max_retries": self.max_retries,
                    "feedback": evaluation.feedback,
                    "corrections": evaluation.suggested_corrections,
                    "agent_id": agent.agent_id,
                },
                concept="reflection",
                agent_id="system",
                agent_category="system",
                task_id=task.id,
            )

        if result is None:  # pragma: no cover - defensive
            await self._record_task_failure(task, "Agent produced no result.")
            return

        self.task_results[task.id] = result

        # Structured communication: downstream agents read this from run memory.
        RunMemory.set(
            self.run_id,
            f"task_{task.id}_result",
            json.dumps(
                {
                    "task_id": task.id,
                    "title": task.title,
                    "agent_id": result.agent_id,
                    "status": result.status,
                    "summary": result.summary,
                    "structured_output": result.structured_output,
                },
                default=str,
            )[:12000],
        )
        await self.emit(
            "memory_write",
            {"key": f"task_{task.id}_result", "preview": result.summary[:120]},
            concept="memory",
            agent_id="system",
            agent_category="system",
            task_id=task.id,
        )

        duration = result.execution_duration
        if result.status == "failed":
            self.totals["failed_tasks"].append(
                {"task_id": task.id, "agent_id": agent.agent_id, "reason": result.summary[:300]}
            )
            await self.emit(
                "task_failed",
                {"task_id": task.id, "reason": result.summary, "agent_id": agent.agent_id},
                concept="orchestration",
                agent_id="system",
                agent_category="system",
                task_id=task.id,
            )
        else:
            await self.emit(
                "task_done",
                {
                    "task_id": task.id,
                    "summary": result.summary,
                    "attempts": retry_count + 1,
                    "verdict": evaluation_verdict,
                },
                concept="orchestration",
                agent_id="system",
                agent_category="system",
                task_id=task.id,
            )

        await self.emit(
            "agent_finished",
            {
                "agent_id": agent.agent_id,
                "status": result.status,
                "duration": duration,
                "attempts": retry_count + 1,
            },
            concept="orchestration",
            agent_id=agent.agent_id,
            agent_category=agent.agent_type,
            task_id=task.id,
        )

    async def _dispatch(
        self, agent: AgentDefinition, task: TaskDefinition, feedback: str
    ) -> AgentResult:
        timeout = max(5, agent.timeout_seconds)

        async def agent_emitter(
            event_type: str,
            payload: dict[str, Any],
            concept: str,
            task_id: Optional[str],
            usage: Optional[Usage] = None,
        ) -> None:
            await self.emit(
                event_type,
                payload,
                concept=concept,
                agent_id=agent.agent_id,
                agent_category=agent.agent_type,
                task_id=task_id,
                usage=usage,
            )

        async def invoke() -> AgentResult:
            return await run_agent_task(
                agent,
                self.run_id,
                task,
                agent_emitter,
                self.fault_injector,
                feedback=feedback,
            )

        try:
            return await asyncio.wait_for(invoke(), timeout=timeout)
        except asyncio.TimeoutError:
            await self.emit(
                "error",
                {"error": f"Agent '{agent.name}' exceeded its {timeout}s execution limit."},
                concept="guardrails",
                agent_id=agent.agent_id,
                agent_category=agent.agent_type,
                task_id=task.id,
            )
            return AgentResult(
                agent_id=agent.agent_id,
                task_id=task.id,
                status="failed",
                summary=f"Execution exceeded the {timeout}s agent timeout.",
                structured_output={"error": "agent_timeout"},
            )
        except GuardrailExceeded:
            raise
        except Exception as exc:
            logger.exception("Agent %s failed on task %s", agent.agent_id, task.id)
            await self.emit(
                "error",
                {"error": f"Agent '{agent.name}' raised {type(exc).__name__}: {exc}"},
                concept="orchestration",
                agent_id=agent.agent_id,
                agent_category=agent.agent_type,
                task_id=task.id,
            )
            return AgentResult(
                agent_id=agent.agent_id,
                task_id=task.id,
                status="failed",
                summary=f"Agent error: {type(exc).__name__}: {exc}",
                structured_output={"error": str(exc)},
            )

    async def _record_task_failure(self, task: TaskDefinition, reason: str) -> None:
        self.totals["failed_tasks"].append(
            {"task_id": task.id, "agent_id": task.assigned_agent_id, "reason": reason}
        )
        await self.emit(
            "error",
            {"error": reason, "task_id": task.id},
            concept="orchestration",
            agent_id="system",
            agent_category="system",
            task_id=task.id,
        )
        await self.emit(
            "task_failed",
            {"task_id": task.id, "reason": reason, "agent_id": task.assigned_agent_id},
            concept="orchestration",
            agent_id="system",
            agent_category="system",
            task_id=task.id,
        )

    # ------------------------------------------------------------------ totals
    def _finalise_totals(self, started: float) -> None:
        scores: list[float] = self.totals["critic_scores"]
        self.totals["llm_mode"] = llm_client.mode
        self.totals["default_model"] = settings.default_model
        self.totals["duration_seconds"] = round(time.time() - started, 2)
        self.totals["steps"] = self.guardrails.steps_taken
        self.totals["tokens_used"] = self.guardrails.tokens_used
        self.totals["average_critic_score"] = (
            round(sum(scores) / len(scores), 1) if scores else None
        )

    def _summary_line(self, status: str, task_count: int) -> str:
        if status == STATUS_COMPLETED:
            return (
                f"All {task_count} task(s) completed. Average critic score "
                f"{self.totals.get('average_critic_score')}/10."
            )
        failed = len(self.totals["failed_tasks"])
        return f"{task_count - failed}/{task_count} task(s) completed; {failed} failed."

    def _compose_final_answer(self, plan: Plan) -> str:
        """Deterministic synthesis of stored task outputs (no extra model call)."""
        parts: list[str] = []
        for task in plan.tasks:
            result = self.task_results.get(task.id)
            if result is None:
                continue
            marker = "⚠️" if result.status == "failed" else "✅"
            parts.append(f"{marker} {task.title}\n{result.summary.strip()}")
            sources = result.structured_output.get("sources") if isinstance(result.structured_output, dict) else None
            if isinstance(sources, list) and sources:
                cited = ", ".join(
                    source.get("url", "") for source in sources[:3] if source.get("url")
                )
                if cited:
                    parts.append(f"Sources: {cited}")
        if not parts:
            return "No task produced an output."
        return "\n\n".join(parts)[:8000]

    def _save_run_state(self, status: str) -> None:
        with db_connection() as conn:
            conn.execute(
                "UPDATE runs SET status = ?, totals_json = ? WHERE id = ?",
                (status, json.dumps(self.totals), self.run_id),
            )
