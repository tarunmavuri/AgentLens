import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  Play,
  Sparkles,
  Download,
  Activity,
  Users,
  Clock,
  AlertCircle,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import * as api from '../api/client';
import { RunStatus } from '../types';

interface DashboardPageProps {
  onOpenNewRun: () => void;
}

const statusClasses: Record<RunStatus, string> = {
  queued: 'bg-coral/10 text-coral animate-pulse',
  running: 'bg-coral/10 text-coral animate-pulse',
  completed: 'bg-emerald-500/10 text-emerald-500',
  completed_with_errors: 'bg-amber-500/10 text-amberAccent',
  failed: 'bg-red-500/10 text-red-500',
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
      alert(error instanceof Error ? error.message : 'Failed to export trace');
    } finally {
      setDownloadingTrace(null);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b dark:border-charcoal-border border-cream-border">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-coral">
            Command Center
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
            AgentLens Operations Dashboard
          </h1>
          <p className="text-xs sm:text-sm dark:text-charcoal-muted text-cream-muted mt-1">
            Monitor executions, manage custom agents and audit every persisted event.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              loadRuns();
              loadAgents();
            }}
            title="Refresh"
            className="p-2.5 rounded-xl border dark:border-charcoal-border border-cream-border dark:hover:bg-charcoal-border hover:bg-cream-border transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${runsLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setView('builder')}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider 
              border dark:border-charcoal-border border-cream-border dark:hover:bg-charcoal-border hover:bg-cream-border transition-colors flex items-center space-x-1.5"
          >
            <Users className="w-3.5 h-3.5" />
            <span>New Custom Agent</span>
          </button>

          <button
            onClick={onOpenNewRun}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider 
              bg-coral hover:bg-coral-hover text-white shadow-md shadow-coral/20 transition-all hover:scale-[1.02] flex items-center space-x-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Launch Execution</span>
          </button>
        </div>
      </div>

      {runsError && (
        <div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/5 text-red-500 text-xs flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Could not load runs</p>
            <p className="mt-0.5 dark:text-red-400/80">{runsError}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="p-5 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">
              Total Runs
            </span>
            <Activity className="w-4 h-4 text-coral" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold">
            {runsLoading && runs.length === 0 ? '—' : totalRuns}
          </div>
          <div className="text-[11px] text-emerald-500 font-medium">
            {completedRuns} completed successfully
          </div>
        </div>

        <div className="p-5 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">
              Registered Agents
            </span>
            <Users className="w-4 h-4 text-amberAccent" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold">{agents.length}</div>
          <div className="text-[11px] dark:text-charcoal-muted text-cream-muted">
            {builtInCount} built-in · {Math.max(0, agents.length - builtInCount)} custom
          </div>
        </div>

        <div className="p-5 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">
              Total Tokens
            </span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold">
            {totalTokens.toLocaleString()}
          </div>
          <div className="text-[11px] dark:text-charcoal-muted text-cream-muted">
            Sum of recorded run totals
          </div>
        </div>

        <div className="p-5 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">
              Estimated Cost
            </span>
            <span className="text-xs font-bold text-coral">$ USD</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold">${totalCost.toFixed(5)}</div>
          <div className="text-[11px] text-emerald-500 font-medium">
            From configurable per-model pricing
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Recent Multi-Agent Executions</h2>
          <span className="text-xs dark:text-charcoal-muted text-cream-muted">
            Open in the live graph or scrub the stored trace
          </span>
        </div>

        <div className="rounded-2xl border overflow-hidden dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b dark:border-charcoal-border border-cream-border dark:bg-charcoal-bg/60 bg-cream-bg/60 text-[10px] uppercase font-bold tracking-wider dark:text-charcoal-muted text-cream-muted">
                  <th className="py-3 px-4">Run ID & Goal</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Tokens</th>
                  <th className="py-3 px-4">Cost</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Critic</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-charcoal-border divide-cream-border">
                {runs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-10 text-center dark:text-charcoal-muted text-cream-muted"
                    >
                      {runsLoading
                        ? 'Loading executions…'
                        : 'No executions recorded yet. Launch one to populate the dashboard.'}
                    </td>
                  </tr>
                ) : (
                  runs.map((run) => (
                    <tr
                      key={run.id}
                      onClick={() => {
                        selectRun(run.id);
                        setView('workspace');
                      }}
                      className="cursor-pointer transition-colors dark:hover:bg-charcoal-bg hover:bg-cream-bg group"
                    >
                      <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                        <div className="font-semibold text-xs line-clamp-1 group-hover:text-coral transition-colors">
                          {run.goal}
                        </div>
                        <div className="text-[10px] font-mono dark:text-charcoal-muted text-cream-muted mt-0.5">
                          {run.id} {run.id.includes('golden') && '· recorded demo trace'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            statusClasses[run.status] ?? statusClasses.queued
                          }`}
                        >
                          {run.status.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        {(
                          (run.totals.in_tokens || 0) + (run.totals.out_tokens || 0)
                        ).toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        ${(run.totals.cost_usd || 0).toFixed(5)}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        {run.totals.duration_seconds ? `${run.totals.duration_seconds}s` : '—'}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-xs text-coral">
                        {run.totals.average_critic_score != null
                          ? `${run.totals.average_critic_score}/10`
                          : '—'}
                      </td>

                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          onClick={(event) => handleExportTrace(run.id, event)}
                          title="Download JSON trace"
                          disabled={downloadingTrace === run.id}
                          className="p-1.5 rounded-lg border dark:border-charcoal-border border-cream-border dark:hover:bg-charcoal-border hover:bg-cream-border transition-colors text-neutral-400 hover:text-coral disabled:opacity-50"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            selectRun(run.id);
                            setView('workspace');
                          }}
                          title="Open live graph"
                          className="p-1.5 rounded-lg border dark:border-charcoal-border border-cream-border dark:hover:bg-charcoal-border hover:bg-cream-border transition-colors text-neutral-400 hover:text-coral"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            selectRun(run.id);
                            setView('history');
                          }}
                          title="Replay stored events"
                          className="p-1.5 rounded-lg border dark:border-charcoal-border border-cream-border dark:hover:bg-charcoal-border hover:bg-cream-border transition-colors text-neutral-400 hover:text-coral"
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
        </div>
      </div>
    </div>
  );
};
