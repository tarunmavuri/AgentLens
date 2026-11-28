import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  Download,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  ArrowRight,
  PlusCircle,
  PlayCircle,
  Bot,
} from 'lucide-react';
import * as api from '../api/client';
import { RunStatus } from '../types';
import { statusLabel } from '../lib/plain';
import { InfoTooltip } from '../components/ui/InfoTooltip';

interface DashboardPageProps {
  onOpenNewRun: () => void;
}

const statusClasses: Record<RunStatus, string> = {
  queued: 'bg-amberAccent/15 text-amberAccent',
  running: 'bg-coral/15 text-coral',
  completed: 'bg-statusSuccess/10 text-statusSuccess',
  completed_with_errors: 'bg-amberAccent/15 text-amberAccent',
  failed: 'bg-statusError/10 text-statusError',
};

export const DashboardPage: React.FC<DashboardPageProps> = ({ onOpenNewRun }) => {
  const {
    runs,
    runsLoading,
    runsError,
    loadRuns,
    selectRun,
    setView,
    agents,
    loadAgents,
    setEditingAgent,
  } = useAppStore();
  const [downloadingTrace, setDownloadingTrace] = useState<string | null>(null);

  useEffect(() => {
    loadRuns();
    loadAgents();
  }, []);

  const totalRuns = runs.length;
  const completedRuns = runs.filter((run) => run.status === 'completed').length;
  const totalTokens = runs.reduce(
    (acc, run) => acc + (run.totals.in_tokens || 0) + (run.totals.out_tokens || 0),
    0,
  );
  const totalCost = runs.reduce((acc, run) => acc + (run.totals.cost_usd || 0), 0);
  const builtInCount = agents.filter((agent) => agent.agent_type === 'built_in').length;
  const enabledAgents = agents.filter((agent) => agent.enabled);

  const handleExportTrace = async (runId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      setDownloadingTrace(runId);
      const trace = await api.exportTrace(runId);
      const blob = new Blob([JSON.stringify(trace, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `agentlens-trace-${runId}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Could not download trace');
    } finally {
      setDownloadingTrace(null);
    }
  };

  return (
    <div className="p-5 sm:p-8 space-y-10 max-w-7xl mx-auto">
      {/* 1. Welcome & Primary Actions */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 pb-6 border-b border-cream-border dark:border-charcoal-border">
        <div className="space-y-1.5 max-w-2xl">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-coral">
            Overview
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Your multi-agent{' '}
            <span className="font-editorial italic font-normal text-coral">execution studio.</span>
          </h1>
          <p className="text-xs sm:text-sm text-cream-muted dark:text-charcoal-muted leading-relaxed">
            Ask a question, follow how specialist agents collaborate, and inspect every tool call,
            Critic score, and replayable event.
          </p>
        </div>

        {/* 2. Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              loadRuns();
              loadAgents();
            }}
            title="Refresh runs and agents"
            aria-label="Refresh overview"
            className="h-9 w-9 rounded-full border border-cream-border dark:border-charcoal-border bg-cream-surface dark:bg-charcoal-surface hover:border-coral transition-colors flex items-center justify-center"
          >
            <RefreshCw className={`w-4 h-4 ${runsLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingAgent(null);
              setView('builder');
            }}
            className="h-9 px-4 rounded-full text-xs font-semibold border border-cream-border dark:border-charcoal-border bg-cream-surface dark:bg-charcoal-surface hover:border-coral transition-colors inline-flex items-center gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5 text-amberAccent" />
            <span>Create Custom Agent</span>
          </button>

          <button
            type="button"
            onClick={onOpenNewRun}
            className="h-9 px-5 rounded-full text-xs font-semibold bg-coral hover:bg-coral-hover text-white shadow-sm shadow-coral/25 transition-colors inline-flex items-center gap-1.5"
          >
            <PlayCircle className="w-4 h-4" />
            <span>Create New Execution</span>
          </button>
        </div>
      </section>

      {/* Beginner Guidance Note (Open left-border callout, not a box!) */}
      <div className="pl-4 border-l-2 border-coral flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs sm:text-sm text-cream-muted dark:text-charcoal-muted leading-relaxed">
          <span className="font-semibold text-cream-text dark:text-charcoal-text">
            New to Agentic AI?
          </span>{' '}
          Pick a pre-built experiment in Templates or inspect a recorded demo trace below to watch
          how the Planner, Researcher, Coder, and Critic collaborate.
        </p>
        <div className="flex items-center gap-4 flex-shrink-0">
          <button
            type="button"
            onClick={() => setView('templates')}
            className="text-xs font-semibold text-amberAccent hover:underline whitespace-nowrap"
          >
            Try Templates
          </button>
          <button
            type="button"
            onClick={() => setView('learn')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-coral hover:underline whitespace-nowrap"
          >
            <span>Learn Concepts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {runsError && (
        <div className="pl-4 border-l-2 border-statusError text-statusError text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Could not load executions</p>
            <p className="mt-0.5 opacity-90">{runsError}</p>
          </div>
        </div>
      )}

      {/* 3. Existing Agents — Open Editorial Roster (No boxed card soup!) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold tracking-tight">Existing Agents</h2>
            <p className="text-xs text-cream-muted dark:text-charcoal-muted">
              {enabledAgents.length} active helpers ready for orchestration ({builtInCount}{' '}
              built-in, {Math.max(0, agents.length - builtInCount)} custom).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setView('agents')}
            className="text-xs font-semibold text-coral hover:underline inline-flex items-center gap-1"
          >
            <span>Agent Workspace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 border-t border-cream-border dark:border-charcoal-border pt-4">
          {agents.slice(0, 6).map((agent) => (
            <button
              key={agent.agent_id}
              type="button"
              onClick={() => setView('agents')}
              className="py-2.5 border-b border-cream-border/70 dark:border-charcoal-border/70 text-left group flex items-start justify-between gap-3 hover:border-coral transition-colors"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <span
                  className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                    agent.enabled
                      ? agent.agent_type === 'custom'
                        ? 'bg-amberAccent'
                        : 'bg-coral'
                      : 'bg-cream-muted/40 dark:bg-charcoal-muted/40'
                  }`}
                />
                <div className="min-w-0">
                  <div className="font-semibold text-xs group-hover:text-coral transition-colors truncate flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5 text-cream-muted dark:text-charcoal-muted flex-shrink-0" />
                    <span className="truncate">{agent.name}</span>
                  </div>
                  <p className="text-[11px] text-cream-muted dark:text-charcoal-muted line-clamp-1 mt-0.5">
                    {agent.role}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-cream-muted dark:text-charcoal-muted flex-shrink-0 pt-0.5">
                {agent.allowed_tools?.length || 0} tools
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 4. Recent Executions — Unboxed Ledger Table */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold tracking-tight">Recent Executions</h2>
            <p className="text-xs text-cream-muted dark:text-charcoal-muted">
              Click any row to open the live graph or replay its persisted event timeline.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setView('history')}
            className="text-xs font-semibold text-coral hover:underline"
          >
            Execution History
          </button>
        </div>

        <div className="border-y border-cream-border dark:border-charcoal-border overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-cream-border dark:border-charcoal-border text-[10px] uppercase font-bold tracking-wider text-cream-muted dark:text-charcoal-muted">
                <th className="py-3 pr-4">Goal</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Tokens</th>
                <th className="py-3 px-3">Est. Cost</th>
                <th className="py-3 px-3">Duration</th>
                <th className="py-3 px-3">Critic Score</th>
                <th className="py-3 pl-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-border/70 dark:divide-charcoal-border/70">
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center space-y-2">
                    <p className="text-sm font-semibold">
                      {runsLoading ? 'Loading executions…' : 'No executions yet'}
                    </p>
                    {!runsLoading && (
                      <p className="text-xs text-cream-muted dark:text-charcoal-muted max-w-md mx-auto">
                        Press <span className="font-semibold text-coral">Create New Execution</span>{' '}
                        above or pick an experiment in Templates to get started.
                      </p>
                    )}
                  </td>
                </tr>
              ) : (
                runs.slice(0, 10).map((run) => (
                  <tr
                    key={run.id}
                    onClick={() => {
                      selectRun(run.id);
                      setView('workspace');
                    }}
                    className="cursor-pointer transition-colors hover:bg-cream-surface/70 dark:hover:bg-charcoal-surface/70 group"
                  >
                    <td className="py-3.5 pr-4 max-w-xs sm:max-w-md">
                      <div className="font-semibold text-xs line-clamp-1 group-hover:text-coral transition-colors">
                        {run.goal}
                      </div>
                      <div className="text-[10px] font-mono text-cream-muted dark:text-charcoal-muted mt-0.5">
                        {run.id} {run.id.includes('golden') && '· recorded demo'}
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          statusClasses[run.status] ?? statusClasses.queued
                        }`}
                      >
                        {statusLabel(run.status)}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 font-mono text-[11px]">
                      {((run.totals.in_tokens || 0) + (run.totals.out_tokens || 0)).toLocaleString()}
                    </td>

                    <td className="py-3.5 px-3 font-mono text-[11px]">
                      ${(run.totals.cost_usd || 0).toFixed(5)}
                    </td>

                    <td className="py-3.5 px-3 font-mono text-[11px]">
                      {run.totals.duration_seconds ? `${run.totals.duration_seconds}s` : '—'}
                    </td>

                    <td className="py-3.5 px-3 font-semibold text-xs text-coral">
                      {run.totals.average_critic_score != null
                        ? `${run.totals.average_critic_score}/10`
                        : '—'}
                    </td>

                    <td className="py-3.5 pl-3 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(event) => handleExportTrace(run.id, event)}
                        title="Export trace JSON"
                        disabled={downloadingTrace === run.id}
                        className="p-1.5 rounded-full border border-cream-border dark:border-charcoal-border hover:border-coral hover:text-coral transition-colors disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          selectRun(run.id);
                          setView('history');
                        }}
                        title="Replay step by step"
                        className="p-1.5 rounded-full border border-cream-border dark:border-charcoal-border hover:border-coral hover:text-coral transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. Usage & Performance Summary — Clean Hairline Stat Strip (No 4-Box Grid!) */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold tracking-tight">Usage & Performance Summary</h2>
          <p className="text-xs text-cream-muted dark:text-charcoal-muted">
            Totals derived from persisted executions in your workspace.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 border-y border-cream-border dark:border-charcoal-border divide-y sm:divide-y-0 lg:divide-x divide-cream-border dark:divide-charcoal-border">
          <div className="py-4 lg:pr-6 space-y-1">
            <span className="text-[11px] font-semibold text-cream-muted dark:text-charcoal-muted block">
              Executions
            </span>
            <div className="text-2xl sm:text-3xl font-bold">
              {runsLoading && runs.length === 0 ? '—' : totalRuns}
            </div>
            <div className="text-[11px] text-statusSuccess font-medium">
              {completedRuns} completed cleanly
            </div>
          </div>

          <div className="py-4 lg:px-6 space-y-1">
            <span className="text-[11px] font-semibold text-cream-muted dark:text-charcoal-muted block">
              Registered Agents
            </span>
            <div className="text-2xl sm:text-3xl font-bold">{agents.length}</div>
            <div className="text-[11px] text-cream-muted dark:text-charcoal-muted">
              {builtInCount} built-in · {Math.max(0, agents.length - builtInCount)} custom
            </div>
          </div>

          <div className="py-4 lg:px-6 space-y-1">
            <span className="text-[11px] font-semibold text-cream-muted dark:text-charcoal-muted block">
              Tokens Consumed
              <InfoTooltip text="Total input and output tokens processed by Gemini across all runs." />
            </span>
            <div className="text-2xl sm:text-3xl font-bold">{totalTokens.toLocaleString()}</div>
            <div className="text-[11px] text-cream-muted dark:text-charcoal-muted">
              Persisted event telemetry
            </div>
          </div>

          <div className="py-4 lg:pl-6 space-y-1">
            <span className="text-[11px] font-semibold text-cream-muted dark:text-charcoal-muted block">
              Estimated Cost
              <InfoTooltip text="Estimated USD cost derived from model token rates." />
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-coral">
              ${totalCost.toFixed(5)}
            </div>
            <div className="text-[11px] text-cream-muted dark:text-charcoal-muted">
              Offline simulation costs $0.00
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
