import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import * as api from '../api/client';
import { Play, Copy, Workflow, Bot, AlertTriangle } from 'lucide-react';
import { FaultConfig } from '../types';

const GOAL_TEMPLATES: {
  num: string;
  title: string;
  category: string;
  description: string;
  goal: string;
  faultInjection?: FaultConfig;
}[] = [
  {
    num: '01',
    title: 'RAG vs Fine-Tuning Architecture',
    category: 'Research + Code Experiment',
    description:
      'Planner coordinates Researcher and Coder to compare retrieval vs fine-tuning with a Python benchmark.',
    goal: 'Compare RAG vs fine-tuning for a customer-support bot and back it up with a small code experiment',
  },
  {
    num: '02',
    title: 'Algorithm Benchmark with Visualization',
    category: 'Sandbox Execution',
    description:
      'Coder benchmarks sorting algorithms on 10,000 items and renders comparison plots.',
    goal: 'Benchmark three sorting algorithms on 10,000 items and explain the timings',
  },
  {
    num: '03',
    title: 'Agent Evaluation Methods Survey',
    category: 'Multi-Source Research',
    description:
      'Researcher gathers and summarizes recent techniques for evaluating multi-agent LLM systems.',
    goal: 'Summarise 3 recent approaches to evaluating LLM agents, with sources',
  },
  {
    num: '04',
    title: 'Critic Recovery Drill (Fault Injection)',
    category: 'Reliability Experiment',
    description:
      'Intentionally injects a faulty search response so you can watch the Critic reject it and guide a retry.',
    goal: 'Research best practices for prompt injection defense in tool-using agents',
    faultInjection: { enabled: true, target_tool: 'web_search', mode: 'wrong_answer' },
  },
];

export const TemplatesPage: React.FC = () => {
  const { agents, runs, loadRuns, selectRun, loadAgents, setEditingAgent, setView } = useAppStore();
  const [launchingTitle, setLaunchingTitle] = useState<string | null>(null);
  const [cloningId, setCloningId] = useState<string | null>(null);

  const templateAgents = agents.filter(
    (a) => a.agent_type === 'custom' && a.user_id === 'system',
  );
  const demoRuns = runs.filter((r) => r.id.includes('golden'));

  const handleLaunchTemplate = async (item: (typeof GOAL_TEMPLATES)[number]) => {
    if (launchingTitle) return;
    setLaunchingTitle(item.title);
    try {
      const res = await api.createRun(item.goal, { max_steps: 25 }, item.faultInjection);
      await loadRuns();
      selectRun(res.run_id);
      setView('workspace');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to start template execution');
    } finally {
      setLaunchingTitle(null);
    }
  };

  const handleCloneAgentTemplate = async (agentId: string) => {
    if (cloningId) return;
    setCloningId(agentId);
    try {
      const cloned = await api.duplicateAgent(agentId);
      await loadAgents();
      setEditingAgent(cloned);
      setView('builder');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to duplicate template agent');
    } finally {
      setCloningId(null);
    }
  };

  return (
    <div className="p-5 sm:p-8 space-y-12 max-w-5xl mx-auto">
      <div className="pb-6 border-b border-cream-border dark:border-charcoal-border">
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-coral">
          Experiment · Templates
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
          Starter Experiments & Templates
        </h1>
        <p className="text-xs sm:text-sm text-cream-muted dark:text-charcoal-muted mt-1">
          Launch verified multi-agent experiments in one click, or clone specialist templates into
          your workspace.
        </p>
      </div>

      {/* 1. Numbered Starter Index (Zero box grid!) */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-bold">Execution Starters</h2>
          <p className="text-xs text-cream-muted dark:text-charcoal-muted">
            Select an experiment to run it live in the Execution Workspace.
          </p>
        </div>

        <div className="divide-y divide-cream-border dark:divide-charcoal-border border-y border-cream-border dark:border-charcoal-border">
          {GOAL_TEMPLATES.map((tpl) => (
            <div
              key={tpl.title}
              className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-4 max-w-2xl">
                <span className="font-editorial italic text-3xl text-coral leading-none pt-0.5">
                  {tpl.num}
                </span>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amberAccent">
                      {tpl.category}
                    </span>
                    {tpl.faultInjection && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-statusWarning">
                        <AlertTriangle className="w-3 h-3" /> Fault Injection
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-sm">{tpl.title}</h3>
                  <p className="text-xs text-cream-muted dark:text-charcoal-muted leading-relaxed">
                    {tpl.description}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleLaunchTemplate(tpl)}
                disabled={launchingTitle === tpl.title}
                className="h-9 px-4 rounded-full text-xs font-semibold bg-coral hover:bg-coral-hover text-white transition-colors inline-flex items-center justify-center gap-1.5 self-start sm:self-auto flex-shrink-0 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{launchingTitle === tpl.title ? 'Launching…' : 'Launch'}</span>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Agent Templates Roster */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-bold">Agent Templates</h2>
          <p className="text-xs text-cream-muted dark:text-charcoal-muted">
            Clone a system template to customize instructions, model selection, or tool permissions.
          </p>
        </div>

        <div className="divide-y divide-cream-border dark:divide-charcoal-border border-y border-cream-border dark:border-charcoal-border">
          {templateAgents.length === 0 ? (
            <p className="py-4 text-xs text-cream-muted dark:text-charcoal-muted">
              No system agent templates found.
            </p>
          ) : (
            templateAgents.map((agent) => (
              <div
                key={agent.agent_id}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3 max-w-2xl">
                  <div className="w-9 h-9 rounded-full bg-amberAccent/15 text-amberAccent flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="font-bold text-sm">{agent.name}</h3>
                    <p className="text-[11px] font-medium text-coral">{agent.role}</p>
                    <p className="text-xs text-cream-muted dark:text-charcoal-muted leading-relaxed">
                      {agent.description}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleCloneAgentTemplate(agent.agent_id)}
                  disabled={cloningId === agent.agent_id}
                  className="h-9 px-4 rounded-full text-xs font-semibold border border-cream-border dark:border-charcoal-border hover:border-coral hover:text-coral transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto flex-shrink-0 disabled:opacity-50"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{cloningId === agent.agent_id ? 'Cloning…' : 'Clone & Customize'}</span>
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 3. Recorded Demo Traces */}
      {demoRuns.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-bold">Recorded Demo Traces ($0 Replay)</h2>
            <p className="text-xs text-cream-muted dark:text-charcoal-muted">
              Inspect complete recorded executions without calling any external model.
            </p>
          </div>

          <div className="divide-y divide-cream-border dark:divide-charcoal-border border-y border-cream-border dark:border-charcoal-border">
            {demoRuns.map((run) => (
              <div
                key={run.id}
                className="py-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0 space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-coral">
                    Recorded Demo · {run.id}
                  </span>
                  <p className="font-semibold text-xs sm:text-sm truncate">{run.goal}</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    selectRun(run.id);
                    setView('workspace');
                  }}
                  className="h-8 px-3.5 rounded-full text-xs font-semibold border border-cream-border dark:border-charcoal-border hover:border-coral hover:text-coral transition-colors inline-flex items-center gap-1.5 flex-shrink-0"
                >
                  <Workflow className="w-3.5 h-3.5 text-coral" />
                  <span>Inspect</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
