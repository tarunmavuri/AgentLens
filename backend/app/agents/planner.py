import json
from typing import Any
from pydantic import BaseModel, Field
from backend.app.agents.base import Plan, TaskDefinition, AgentDefinition
from backend.app.llm import llm_client
from backend.app.events import Usage

class PlannerOutputSchema(BaseModel):
    reasoning: str
    tasks: list[TaskDefinition] = Field(max_length=5)

class PlannerAgent:
    def __init__(self):
        self.agent_id = "planner"
        self.name = "Planner"
        self.category = "built_in"

    async def create_plan(
        self,
        goal: str,
        available_agents: list[AgentDefinition]
    ) -> tuple[Plan, Usage]:
        agent_descriptions = "\n".join([
            f"- ID: {a.agent_id} | Name: {a.name} | Role: {a.role} | Capabilities: {a.description}"
            for a in available_agents if a.enabled and a.agent_id not in ["planner", "critic"]
        ])

        system_instruction = (
            "You are the Lead Multi-Agent Planner in AgentLens. "
            "Your job is to analyze the user's high-level goal, break it into a clear, logical sequence "
            "of tasks (maximum 5 tasks), identify explicit dependencies, and assign each task to the most "
            "appropriate registered agent based on their specific role and capabilities.\n\n"
            f"Available Registered Agents:\n{agent_descriptions}\n\n"
            "Rules:\n"
            "1. Maximum of 5 tasks total.\n"
            "2. Define explicit task dependencies (depends_on list of task IDs).\n"
            "3. Specify unambiguous, measurable success criteria for each task.\n"
            "4. Only assign tasks to agents listed in the Available Registered Agents.\n"
            "5. Return output conforming to the required JSON schema."
        )

        prompt = f"Goal: {goal}\n\nGenerate an optimal execution plan with tasks, dependencies, and agent assignments."

        def mock_plan(p: str) -> dict[str, Any]:
            g_lower = goal.lower()
            tasks = []
            
            # Check if custom agents are available
            agent_ids = [a.agent_id for a in available_agents if a.enabled]

            if "rag" in g_lower and "fine-tuning" in g_lower:
                tasks.append({
                    "id": "task-1",
                    "title": "Investigate RAG vs Fine-tuning Trade-offs",
                    "description": "Search literature and industry benchmarks for latency, accuracy, and maintenance costs.",
                    "assigned_agent_id": "researcher" if "researcher" in agent_ids else agent_ids[0],
                    "task_type": "research",
                    "depends_on": [],
                    "success_criteria": "Clear summary of RAG vs fine-tuning pros/cons with 2+ credible sources."
                })
                tasks.append({
                    "id": "task-2",
                    "title": "Code Experiment: Retrieval vs Direct Prediction",
                    "description": "Write a Python simulation benchmarking keyword/vector retrieval against direct lookup.",
                    "assigned_agent_id": "coder" if "coder" in agent_ids else agent_ids[0],
                    "task_type": "code",
                    "depends_on": ["task-1"],
                    "success_criteria": "Executable Python script producing latency and token cost comparisons."
                })
                # Check for custom reviewer or analyst
                if "security_reviewer" in agent_ids:
                    tasks.append({
                        "id": "task-3",
                        "title": "Security & Safety Review",
                        "description": "Review the experimental code for potential injection or unsafe operations.",
                        "assigned_agent_id": "security_reviewer",
                        "task_type": "custom",
                        "depends_on": ["task-2"],
                        "success_criteria": "Audit report confirming safe sandbox and parameter execution."
                    })

            elif "sort" in g_lower or "sorting" in g_lower:
                tasks.append({
                    "id": "task-1",
                    "title": "Benchmark Sorting Algorithms on 10,000 Items",
                    "description": "Implement Quicksort, Mergesort, and Python's Timsort on 10,000 random integers and record execution times.",
                    "assigned_agent_id": "coder" if "coder" in agent_ids else agent_ids[0],
                    "task_type": "code",
                    "depends_on": [],
                    "success_criteria": "Python script timing Quicksort, Mergesort, and Timsort on 10k items with matplotlib visual plot."
                })
                tasks.append({
                    "id": "task-2",
                    "title": "Analyze Sorting Benchmark Results & Complexity",
                    "description": "Explain why Timsort and Mergesort perform differently than Quicksort in terms of cache locality and worst-case bounds.",
                    "assigned_agent_id": "researcher" if "researcher" in agent_ids else agent_ids[0],
                    "task_type": "research",
                    "depends_on": ["task-1"],
                    "success_criteria": "Detailed technical explanation comparing asymptotic complexity and real runtime."
                })

            elif "eval" in g_lower or "approach" in g_lower:
                tasks.append({
                    "id": "task-1",
                    "title": "Survey Recent LLM Agent Evaluation Methodologies",
                    "description": "Identify 3 prominent recent evaluation frameworks (e.g. AgentBench, SWE-bench, WebArena).",
                    "assigned_agent_id": "researcher" if "researcher" in agent_ids else agent_ids[0],
                    "task_type": "research",
                    "depends_on": [],
                    "success_criteria": "Summary of 3 agent evaluation benchmarks with primary sources and methodologies."
                })
                if "fact_checker" in agent_ids:
                    tasks.append({
                        "id": "task-2",
                        "title": "Fact-Check Evaluation Benchmarks",
                        "description": "Verify benchmark citations, paper dates, and metric accuracy.",
                        "assigned_agent_id": "fact_checker",
                        "task_type": "custom",
                        "depends_on": ["task-1"],
                        "success_criteria": "Fact check verification confirming benchmark details."
                    })

            else:
                # General default workflow
                tasks.append({
                    "id": "task-1",
                    "title": f"Investigate core requirements for: {goal[:40]}",
                    "description": f"Gather relevant technical context and approaches for {goal}.",
                    "assigned_agent_id": "researcher" if "researcher" in agent_ids else agent_ids[0],
                    "task_type": "research",
                    "depends_on": [],
                    "success_criteria": "Contextual overview and reference data collected."
                })
                tasks.append({
                    "id": "task-2",
                    "title": f"Implement solution or prototype",
                    "description": f"Build code or computational model to execute {goal}.",
                    "assigned_agent_id": "coder" if "coder" in agent_ids else agent_ids[0],
                    "task_type": "code",
                    "depends_on": ["task-1"],
                    "success_criteria": "Functional implementation validated."
                })

            return {
                "reasoning": f"Decomposed goal into {len(tasks)} sequential/dependent tasks matching registered agent capabilities.",
                "tasks": tasks[:5]
            }

        output, usage = await llm_client.generate_structured(
            schema=PlannerOutputSchema,
            system_instruction=system_instruction,
            prompt=prompt,
            mock_response_generator=mock_plan
        )

        plan = Plan(goal=goal, tasks=output.tasks)
        return plan, usage

planner_agent = PlannerAgent()

