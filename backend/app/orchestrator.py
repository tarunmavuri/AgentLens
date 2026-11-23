import asyncio
import json
import time
from typing import Any, Optional
from backend.app.config import settings
from backend.app.events import Event, Usage, event_bus
from backend.app.db import get_db_connection
from backend.app.guardrails import GuardrailManager, GuardrailLimits
from backend.app.tools.faults import FaultInjector, FaultConfig
from backend.app.agents.base import Plan, TaskDefinition, AgentResult, CriticEvaluation
from backend.app.agents.registry import agent_registry
from backend.app.agents.planner import planner_agent
from backend.app.agents.researcher import researcher_agent
from backend.app.agents.coder import coder_agent
from backend.app.agents.critic import critic_agent
from backend.app.agents.custom_agent import CustomAgentRunner

class Orchestrator:
    """Hand-written, event-sourced multi-agent state machine."""

    def __init__(
        self,
        run_id: str,
        goal: str,
        config: Optional[dict[str, Any]] = None,
        fault_config: Optional[FaultConfig] = None
    ):
        self.run_id = run_id
        self.goal = goal
        self.config = config or {}
        self.event_seq = 0
        self.guardrails = GuardrailManager(
            GuardrailLimits(
                max_steps=self.config.get("max_steps", settings.max_steps_default),
                max_tokens=self.config.get("max_tokens", settings.max_tokens_default),
                max_seconds=self.config.get("max_seconds", settings.max_seconds_default),
            )
        )
        self.fault_injector = FaultInjector(fault_config)
        self.totals = {
            "in_tokens": 0,
            "out_tokens": 0,
            "cost_usd": 0.0,
            "duration_seconds": 0.0,
            "steps": 0,
            "retries": 0,
            "critic_scores": []
        }

    async def emit(
        self,
        event_type: str,
        payload: dict[str, Any],
        concept: Optional[str] = None,
        agent_id: str = "system",
        agent_category: str = "built_in",
        task_id: Optional[str] = None,
        usage: Optional[Usage] = None
    ):
        self.event_seq += 1

        # Check guardrails on state updates
        ok, err = self.guardrails.check_step()
        if usage:
            self.guardrails.add_tokens(usage.in_tokens + usage.out_tokens)
            self.totals["in_tokens"] += usage.in_tokens
            self.totals["out_tokens"] += usage.out_tokens
            self.totals["cost_usd"] = round(self.totals["cost_usd"] + usage.cost_usd, 6)

        # Emit warnings if near budget
        warnings = self.guardrails.check_warnings()
        for w in warnings:
            self.event_seq += 1
            w_event = Event(
                id=self.event_seq,
                run_id=self.run_id,
                type="guardrail_warning",
                agent_id="system",
                agent_category="system",
                task_id=task_id,
                payload={"warning": w},
                concept="guardrails"
            )
            await event_bus.publish(w_event)

        event = Event(
            id=self.event_seq,
            run_id=self.run_id,
            type=event_type,
            agent_id=agent_id,
            agent_category=agent_category,
            task_id=task_id,
            payload=payload,
            concept=concept,
            usage=usage
        )
        await event_bus.publish(event)

        if not ok and event_type not in ["run_failed", "run_finished"]:
            raise RuntimeError(err)

    async def run(self):
        start_time = time.time()
        self._save_run_state("running")

        try:
            # 1. run_started
            await self.emit(
                "run_started",
                {
                    "goal": self.goal,
                    "config": self.config,
                    "fault_injection": self.fault_injector.config.model_dump()
                },
                concept="orchestration",
                agent_id="system",
                agent_category="system"
            )

            # 2. Planning phase
            available_agents = agent_registry.list_agents(enabled_only=True)
            plan, planner_usage = await planner_agent.create_plan(self.goal, available_agents)

            await self.emit(
                "plan_created",
                {
                    "tasks": [t.model_dump() for t in plan.tasks],
                    "total_tasks": len(plan.tasks)
                },
                concept="planning",
                agent_id="planner",
                agent_category="built_in",
                usage=planner_usage
            )

            # 3. Execute tasks in order
            completed_tasks: dict[str, AgentResult] = {}

            for task in plan.tasks:
                # Resolve assigned agent
                assigned_def = agent_registry.get_agent(task.assigned_agent_id)
                if not assigned_def or not assigned_def.enabled:
                    raise ValueError(f"Assigned agent '{task.assigned_agent_id}' is not available or disabled.")

                await self.emit(
                    "task_started",
                    {"task": task.model_dump()},
                    concept="orchestration",
                    agent_id="system",
                    agent_category="system",
                    task_id=task.id
                )

                await self.emit(
                    "agent_started",
                    {"agent_id": assigned_def.agent_id, "name": assigned_def.name, "role": assigned_def.role},
                    concept="orchestration",
                    agent_id=assigned_def.agent_id,
                    agent_category=assigned_def.agent_type,
                    task_id=task.id
                )

                # Retry loop (up to 2 retries)
                retry_count = 0
                max_retries = 2
                task_accepted = False
                latest_result: Optional[AgentResult] = None

                while not task_accepted and retry_count <= max_retries:
                    # Helper for agent to emit sub-events
                    async def agent_emitter(e_type, payload, concept, t_id, usage=None):
                        await self.emit(
                            e_type,
                            payload,
                            concept=concept,
                            agent_id=assigned_def.agent_id,
                            agent_category=assigned_def.agent_type,
                            task_id=t_id,
                            usage=usage
                        )

                    # Dispatch to agent runner
                    if assigned_def.agent_id == "researcher":
                        latest_result = await researcher_agent.execute_task(
                            self.run_id, task, agent_emitter, self.fault_injector
                        )
                    elif assigned_def.agent_id == "coder":
                        latest_result = await coder_agent.execute_task(
                            self.run_id, task, agent_emitter, self.fault_injector
                        )
                    else:
                        # Custom agent runner
                        runner = CustomAgentRunner(assigned_def)
                        latest_result = await runner.execute_task(
                            self.run_id, task, agent_emitter, self.fault_injector
                        )

                    # Critic evaluation
                    async def critic_emitter(e_type, payload, concept, t_id, usage=None):
                        await self.emit(
                            e_type,
                            payload,
                            concept=concept,
                            agent_id="critic",
                            agent_category="built_in",
                            task_id=t_id,
                            usage=usage
                        )

                    eval_res = await critic_agent.evaluate_task(
                        task, latest_result, retry_count, critic_emitter
                    )
                    self.totals["critic_scores"].append(eval_res.score)

                    if eval_res.verdict == "accept" or retry_count >= max_retries:
                        task_accepted = True
                    else:
                        retry_count += 1
                        self.totals["retries"] += 1
                        await self.emit(
                            "retry",
                            {
                                "attempt": retry_count,
                                "feedback": eval_res.feedback,
                                "corrections": eval_res.suggested_corrections
                            },
                            concept="reflection",
                            agent_id="system",
                            agent_category="system",
                            task_id=task.id
                        )

                completed_tasks[task.id] = latest_result # type: ignore

                await self.emit(
                    "task_done",
                    {"task_id": task.id, "summary": latest_result.summary if latest_result else "Done"},
                    concept="orchestration",
                    agent_id="system",
                    agent_category="system",
                    task_id=task.id
                )

                await self.emit(
                    "agent_finished",
                    {"agent_id": assigned_def.agent_id, "duration": latest_result.execution_duration if latest_result else 0.0},
                    concept="orchestration",
                    agent_id=assigned_def.agent_id,
                    agent_category=assigned_def.agent_type,
                    task_id=task.id
                )

            # 4. Finish Run
            duration = time.time() - start_time
            self.totals["duration_seconds"] = round(duration, 2)
            self.totals["steps"] = self.guardrails.steps_taken
            avg_score = (
                round(sum(self.totals["critic_scores"]) / len(self.totals["critic_scores"]), 1)
                if self.totals["critic_scores"]
                else 9.0
            )
            self.totals["average_critic_score"] = avg_score

            await self.emit(
                "run_finished",
                {
                    "status": "completed",
                    "totals": self.totals,
                    "summary": f"All {len(plan.tasks)} tasks accomplished successfully with avg critic score {avg_score}/10."
                },
                concept="evaluation",
                agent_id="system",
                agent_category="system"
            )
            self._save_run_state("completed")

        except Exception as e:
            duration = time.time() - start_time
            self.totals["duration_seconds"] = round(duration, 2)
            self.totals["steps"] = self.guardrails.steps_taken

            await self.emit(
                "run_failed",
                {"error": str(e), "totals": self.totals},
                concept="guardrails",
                agent_id="system",
                agent_category="system"
            )
            self._save_run_state("failed")

    def _save_run_state(self, status: str):
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE runs SET status = ?, totals_json = ? WHERE id = ?
                """,
                (status, json.dumps(self.totals), self.run_id)
            )
            conn.commit()
        finally:
            conn.close()

