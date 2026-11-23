import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { 
  Play, 
  Sparkles, 
  RotateCcw, 
  Download, 
  Activity, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ExternalLink,
  Layers,
  ArrowRight
} from 'lucide-react';
import * as api from '../api/client';

interface DashboardPageProps {
  onOpenNewRun: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onOpenNewRun }) => {
  const { runs, loadRuns, selectRun, setView, agents, loadAgents } = useAppStore();
  const [downloadingTrace, setDownloadingTrace] = useState<string | null>(null);

  useEffect(() => {
    loadRuns();
    loadAgents();
  }, []);

  const totalRuns = runs.length;
  const completedRuns = runs.filter(r => r.status === 'completed').length;
  const totalTokens = runs.reduce((acc, r) => acc + (r.totals.in_tokens || 0) + (r.totals.out_tokens || 0), 0);
  const totalCost = runs.reduce((acc, r) => acc + (r.totals.cost_usd || 0), 0);

  const handleExportTrace = async (runId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setDownloadingTrace(runId);
      const trace = await api.exportTrace(runId);
      const blob = new Blob([JSON.stringify(trace, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agentlens-trace-${runId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to export trace');
    } finally {
      setDownloadingTrace(null);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b dark:border-charcoal-border border-cream-border">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-coral">
            Command Center
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
            AgentLens Operations Dashboard
          </h1>
          <p className="text-xs sm:text-sm dark:text-charcoal-muted text-cream-muted mt-1">
            Monitor real-time executions, manage custom agents, and analyze agentic reasoning.
          </p>
        </div>

        <div className="flex items-center space-x-3">
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

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        <div className="p-5 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">
              Total Runs
            </span>
            <Activity className="w-4 h-4 text-coral" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold">{totalRuns}</div>
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
            4 built-in · {Math.max(0, agents.length - 4)} custom
          </div>
        </div>

        <div className="p-5 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">
              Total Tokens
            </span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold">{totalTokens.toLocaleString()}</div>
          <div className="text-[11px] dark:text-charcoal-muted text-cream-muted">
            Tracked across all tasks
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
            Computed via model pricing
          </div>
        </div>

      </div>

      {/* Recent Executions Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Recent Multi-Agent Executions</h2>
          <span className="text-xs dark:text-charcoal-muted text-cream-muted">
            Click any run to open in Live Workspace or Replay
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
                  <th className="py-3 px-4">Critic Score</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-charcoal-border divide-cream-border">
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center dark:text-charcoal-muted text-cream-muted">
                      No executions recorded yet. Click "Launch Execution" to begin.
                    </td>
                  </tr>
                ) : (
                  runs.map((r) => {
                    const isCompleted = r.status === 'completed';
                    const isFailed = r.status === 'failed';
                    return (
                      <tr 
                        key={r.id}
                        onClick={() => {
                          selectRun(r.id);
                          setView('workspace');
                        }}
                        className="cursor-pointer transition-colors dark:hover:bg-charcoal-bg hover:bg-cream-bg group"
                      >
                        <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                          <div className="font-semibold text-xs line-clamp-1 group-hover:text-coral transition-colors">
                            {r.goal}
                          </div>
                          <div className="text-[10px] font-mono dark:text-charcoal-muted text-cream-muted mt-0.5">
                            {r.id} {r.id.includes('golden') && '⭐ (Golden Trace)'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isCompleted ? 'bg-emerald-500/10 text-emerald-500' :
                            isFailed ? 'bg-red-500/10 text-red-500' :
                            'bg-coral/10 text-coral animate-pulse'
                          }`}>
                            <span>{r.status}</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-[11px]">
                          {((r.totals.in_tokens || 0) + (r.totals.out_tokens || 0)).toLocaleString()}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-[11px]">
                          ${(r.totals.cost_usd || 0).toFixed(5)}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-[11px]">
                          {r.totals.duration_seconds ? `${r.totals.duration_seconds}s` : '—'}
                        </td>

                        <td className="py-3.5 px-4 font-bold text-xs text-coral">
                          {r.totals.average_critic_score ? `${r.totals.average_critic_score}/10` : '—'}
                        </td>

                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button
                            onClick={(e) => handleExportTrace(r.id, e)}
                            title="Download JSON Trace"
                            className="p-1.5 rounded-lg border dark:border-charcoal-border border-cream-border dark:hover:bg-charcoal-border hover:bg-cream-border transition-colors text-neutral-400 hover:text-coral"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              selectRun(r.id);
                              setView('workspace');
                            }}
                            title="Open Live Graph"
                            className="p-1.5 rounded-lg border dark:border-charcoal-border border-cream-border dark:hover:bg-charcoal-border hover:bg-cream-border transition-colors text-neutral-400 hover:text-coral"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
};

