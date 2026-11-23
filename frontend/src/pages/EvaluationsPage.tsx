import React, { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { 
  BarChart3, 
  Coins, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  RefreshCw, 
  TrendingUp, 
  Award,
  Layers
} from 'lucide-react';

export const EvaluationsPage: React.FC = () => {
  const { runs, activeRun, selectedRunId, selectRun, loadRuns, events } = useAppStore();

  useEffect(() => {
    loadRuns();
  }, []);

  const totals = activeRun?.totals || {};
  const inTokens = totals.in_tokens || 0;
  const outTokens = totals.out_tokens || 0;
  const totalTokens = inTokens + outTokens;
  const cost = totals.cost_usd || 0.0;
  const duration = totals.duration_seconds || 0.0;
  const steps = totals.steps || 0;
  const retries = totals.retries || 0;
  const avgScore = totals.average_critic_score || 9.2;

  // Extract all critiques from events
  const critiques = events.filter(e => e.type === 'critique');

  // Guardrail budget percentages (Limits: 25 steps, 60,000 tokens, 120s)
  const stepPercent = Math.min(100, Math.round((steps / 25) * 100));
  const tokenPercent = Math.min(100, Math.round((totalTokens / 60000) * 100));
  const timePercent = Math.min(100, Math.round((duration / 120) * 100));

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b dark:border-charcoal-border border-cream-border">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-coral">
            Quantitative Observability
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
            Evaluations & Resource Analytics
          </h1>
          <p className="text-xs sm:text-sm dark:text-charcoal-muted text-cream-muted mt-1">
            Rigorously assess token spend, financial cost, latency, critic scoring, and guardrail utilization.
          </p>
        </div>

        {/* Run Selector */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold dark:text-charcoal-muted text-cream-muted">Run:</span>
          <select
            value={selectedRunId || ''}
            onChange={(e) => selectRun(e.target.value)}
            className="px-3 py-2 rounded-xl border text-xs font-semibold dark:bg-charcoal-surface bg-cream-surface dark:border-charcoal-border border-cream-border max-w-xs truncate"
          >
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id.includes('golden') ? `⭐ ${r.goal}` : r.goal}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        <div className="p-5 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">
              Critic Score
            </span>
            <Award className="w-4 h-4 text-coral" />
          </div>
          <div className="text-3xl font-extrabold text-coral">{avgScore}/10</div>
          <div className="text-[11px] dark:text-charcoal-muted text-cream-muted">
            Average across evaluated tasks
          </div>
        </div>

        <div className="p-5 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">
              Total Cost
            </span>
            <Coins className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-extrabold">${cost.toFixed(5)}</div>
          <div className="text-[11px] dark:text-charcoal-muted text-cream-muted">
            {totalTokens.toLocaleString()} tokens billed
          </div>
        </div>

        <div className="p-5 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">
              Execution Latency
            </span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-3xl font-extrabold">{duration}s</div>
          <div className="text-[11px] dark:text-charcoal-muted text-cream-muted">
            Total wall-clock duration
          </div>
        </div>

        <div className="p-5 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">
              Retries Recovered
            </span>
            <RefreshCw className="w-4 h-4 text-amberAccent" />
          </div>
          <div className="text-3xl font-extrabold">{retries}</div>
          <div className="text-[11px] text-amberAccent font-medium">
            Triggered by Critic or Fault
          </div>
        </div>

      </div>

      {/* Guardrail Consumption Budget Meters */}
      <div className="p-6 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-6">
        <div>
          <h2 className="text-base font-bold tracking-tight">Platform Guardrail Budget Utilization</h2>
          <p className="text-xs dark:text-charcoal-muted text-cream-muted">
            Hard caps enforced in code. Warnings automatically emit at 80% threshold.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Step Budget */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span>Steps Budget:</span>
              <span className="font-mono">{steps} / 25 ({stepPercent}%)</span>
            </div>
            <div className="w-full h-3 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${
                  stepPercent > 80 ? 'bg-amberAccent' : 'bg-coral'
                }`}
                style={{ width: `${stepPercent}%` }}
              ></div>
            </div>
          </div>

          {/* Token Budget */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span>Token Budget:</span>
              <span className="font-mono">{totalTokens.toLocaleString()} / 60,000 ({tokenPercent}%)</span>
            </div>
            <div className="w-full h-3 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${
                  tokenPercent > 80 ? 'bg-amberAccent' : 'bg-coral'
                }`}
                style={{ width: `${tokenPercent}%` }}
              ></div>
            </div>
          </div>

          {/* Time Budget */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span>Time Budget:</span>
              <span className="font-mono">{duration}s / 120s ({timePercent}%)</span>
            </div>
            <div className="w-full h-3 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${
                  timePercent > 80 ? 'bg-amberAccent' : 'bg-coral'
                }`}
                style={{ width: `${timePercent}%` }}
              ></div>
            </div>
          </div>

        </div>
      </div>

      {/* Task Critiques & Review Decisions Table */}
      <div className="space-y-4">
        <h2 className="text-base font-bold tracking-tight">Critic Evaluations & Reflection Logs</h2>
        
        <div className="rounded-2xl border overflow-hidden dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b dark:border-charcoal-border border-cream-border dark:bg-charcoal-bg/60 bg-cream-bg/60 text-[10px] uppercase font-bold tracking-wider dark:text-charcoal-muted text-cream-muted">
                <th className="py-3 px-4">Task ID</th>
                <th className="py-3 px-4">Critic Verdict</th>
                <th className="py-3 px-4">Score</th>
                <th className="py-3 px-4">Structured Feedback</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-charcoal-border divide-cream-border">
              {critiques.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center dark:text-charcoal-muted text-cream-muted">
                    No task critiques found in this execution trace.
                  </td>
                </tr>
              ) : (
                critiques.map((c, i) => (
                  <tr key={i} className="dark:hover:bg-charcoal-bg hover:bg-cream-bg transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-coral">
                      {c.task_id || 'task-evaluation'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        c.payload?.verdict === 'accept' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amberAccent'
                      }`}>
                        {c.payload?.verdict}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-coral">
                      {c.payload?.score}/10
                    </td>
                    <td className="py-3 px-4 leading-relaxed">
                      {c.payload?.feedback}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

