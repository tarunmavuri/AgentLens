import time
from typing import Any, Callable, Awaitable
from pydantic import BaseModel, Field
from backend.app.agents.base import TaskDefinition, AgentResult
from backend.app.events import Event, Usage
from backend.app.tools.search import web_search
from backend.app.tools.memory import RunMemory
from backend.app.llm import llm_client

class SourceItem(BaseModel):
    title: str
    url: str

class ResearcherOutput(BaseModel):
    thought: str
    search_query: str
    summary: str
    sources: list[SourceItem] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0, default=0.9)
    limitations: str = ""

class ResearcherAgent:
    def __init__(self):
        self.agent_id = "researcher"
        self.name = "Researcher"
        self.category = "built_in"

    async def execute_task(
        self,
        run_id: str,
        task: TaskDefinition,
        emit_event: Callable[[str, dict[str, Any], str, str | None, Usage | None], Awaitable[None]],
        fault_injector: Any = None
    ) -> AgentResult:
        start_time = time.time()
        memory_context = RunMemory.list_all(run_id)

        # 1. Thought phase
        system_prompt = (
            "You are the Expert Technical Researcher Agent in AgentLens. "
            "You gather authoritative evidence, benchmarks, papers, and docs to fulfill the assigned task. "
            "Structure your research with verified sources and honest confidence scores."
        )
        prompt = (
            f"Task: {task.title}\n"
            f"Description: {task.description}\n"
            f"Success Criteria: {task.success_criteria}\n"
            f"Existing Run Context: {memory_context}\n\n"
            "Formulate your search query and comprehensive research summary."
        )

        def mock_research(p: str) -> dict[str, Any]:
            t_title = task.title.lower()
            if "rag" in t_title or "fine-tuning" in t_title:
                return {
                    "thought": "Need to compare RAG vs Fine-tuning across accuracy, latency, maintenance overhead, and domain specificity.",
                    "search_query": "RAG vs fine-tuning customer support latency accuracy benchmarks",
                    "summary": (
                        "Comprehensive analysis shows RAG is ideal for rapidly changing company documentation, reducing hallucinations by ~42% "
                        "and eliminating retraining cycles. Fine-Tuning excels at teaching specialized tone, style, and domain syntax, but is static "
                        "and prone to hallucinating facts outside its training window. In modern 2026 architectures, hybrid approaches (fine-tuned classifier/router + RAG vector store) achieve the highest enterprise SLA."
                    ),
                    "sources": [
                        {"title": "Retrieval-Augmented Generation vs Fine-Tuning for Enterprise NLP", "url": "https://arxiv.org/abs/2312.05934"},
                        {"title": "A Survey on RAG: Architectures and Trade-offs", "url": "https://arxiv.org/abs/2312.10997"},
                        {"title": "Hybrid Architectures: Combining RAG with LoRA", "url": "https://huggingface.co/blog/rag-vs-finetuning"}
                    ],
                    "confidence": 0.94,
                    "limitations": "Benchmark latencies depend heavily on vector database indexing and embedding model dimensions."
                }
            elif "sort" in t_title or "algorithm" in t_title:
                return {
                    "thought": "Explaining asymptotic and empirical runtime variance across Quicksort, Mergesort, and Timsort.",
                    "search_query": "Python Timsort vs Quicksort vs Mergesort cache locality benchmarks",
                    "summary": (
                        "Empirical evaluation reveals distinct algorithmic trade-offs:\n"
                        "- Timsort (Python default): Highly adaptive O(N log N) worst-case and O(N) on pre-sorted runs with superb C-level optimization.\n"
                        "- Mergesort: Strict O(N log N) guaranteed stability, requiring O(N) auxiliary memory.\n"
                        "- Quicksort: Average O(N log N) with small constant factors and high CPU L1/L2 cache locality, but degrades to O(N^2) on adversarial inputs."
                    ),
                    "sources": [
                        {"title": "Empirical Comparison of Modern Sorting Algorithms in Python", "url": "https://docs.python.org/3/howto/sorting.html"},
                        {"title": "Quicksort vs Mergesort vs Heapsort Benchmark", "url": "https://en.wikipedia.org/wiki/Sorting_algorithm"}
                    ],
                    "confidence": 0.96,
                    "limitations": "Python interpreter overhead affects recursive implementations compared to native built-ins."
                }
            else:
                return {
                    "thought": f"Researching core details to fulfill '{task.title}'.",
                    "search_query": f"{task.title} overview and best practices",
                    "summary": f"Analyzed authoritative guidelines and literature for {task.title}. Findings confirm feasibility and highlight optimal approaches under standard constraints.",
                    "sources": [
                        {"title": "AgentBench: Evaluating LLMs as Agents", "url": "https://arxiv.org/abs/2308.03688"},
                        {"title": "SWE-bench: Real-World GitHub Issues Benchmark", "url": "https://arxiv.org/abs/2310.06770"},
                        {"title": "WebArena: Autonomous Agents Environment", "url": "https://arxiv.org/abs/2307.13854"}
                    ],
                    "confidence": 0.92,
                    "limitations": "External benchmark distributions vary based on test set difficulty."
                }

        parsed, usage = await llm_client.generate_structured(
            schema=ResearcherOutput,
            system_instruction=system_prompt,
            prompt=prompt,
            mock_response_generator=mock_research
        )

        # Emit thought event (Concept: ReAct)
        await emit_event(
            "thought",
            {"thought": parsed.thought, "step": "formulate_query"},
            "react",
            task.id,
            usage
        )

        # 2. Tool call event (Concept: Tool Use)
        tool_args = {"query": parsed.search_query, "max_results": 5}
        await emit_event(
            "tool_call",
            {"tool": "web_search", "args": tool_args},
            "tool_use",
            task.id,
            None
        )

        # Execute web search with potential fault injection
        async def do_search():
            return await web_search(query=parsed.search_query, max_results=5)

        if fault_injector:
            results, injected = await fault_injector.maybe_inject("web_search", do_search)
            if injected:
                await emit_event(
                    "fault_injected",
                    {
                        "tool": "web_search",
                        "mode": fault_injector.config.mode,
                        "description": f"Fault injected into web_search (Mode: {fault_injector.config.mode})"
                    },
                    "guardrails",
                    task.id,
                    None
                )
        else:
            results = await do_search()

        # Emit tool result event
        await emit_event(
            "tool_result",
            {"tool": "web_search", "result": results},
            "tool_use",
            task.id,
            None
        )

        # 3. Store summary in memory (Concept: Memory)
        RunMemory.set(run_id, f"{task.id}_research", parsed.summary)
        await emit_event(
            "memory_write",
            {"key": f"{task.id}_research", "preview": parsed.summary[:100] + "..."},
            "memory",
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

researcher_agent = ResearcherAgent()

