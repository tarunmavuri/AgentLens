import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import * as api from '../api/client';
import { PublicConfig, RunMetrics } from '../types';
import {
  Award,
  Coins,
  Clock,
  RefreshCw,
  Wrench,
  AlertTriangle,
  Users,
} from 'lucide-react';

export const EvaluationsPage: React.FC = () => {
  const { runs, activeRun, selectedRunId, selectRun, loadRuns, events } = useAppStore();
  const [metrics, setMetrics] = useState<RunMetrics | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRuns();
    api.fetchConfig().then(setConfig).catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    if (!selectedRunId) {
      setMetrics(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .fetchRunMetrics(selectedRunId)
      .then((data) => {
        if (!cancelled) setMetrics(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load metrics');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRunId]);

  // Live runs: recompute from the in-memory event stream until the stored
  // metrics endpoint catches up.
  const computed = metrics?.computed;
  const liveTokens = events.reduce(
    (total, event) => total + (event.usage?.in_tokens || 0) + (event.usage?.out_tokens || 0),
    0,
  );
  const liveCost = events.reduce((total, event) => total + (event.usage?.cost_usd || 0), 0);

  const limits = config?.limits ?? {
    max_steps: 25,
    max_tokens: 60000,
    max_seconds: 120,
    max_retries: 2,
    max_tasks_per_plan: 5,
  };

  const inTokens = computed?.in_tokens ?? 0;
  const outTokens = computed?.out_tokens ?? 0;
  const totalTokens = metrics ? inTokens + outTokens : liveTokens;
  const cost = metrics ? computed?.cost_usd ?? 0 : liveCost;
  const duration =
    computed?.wall_clock_seconds ?? activeRun?.totals?.duration_seconds ?? 0;
  const steps = computed?.steps ?? 0;
  const retries = computed?.retries ?? 0;
  const avgScore = computed?.average_critic_score ?? null;
  const recordedTokens =
    (metrics?.recorded?.in_tokens ?? 0) + (metrics?.recorded?.out_tokens ?? 0);
  const totalsMatch = !metrics || recordedTokens === totalTokens;

  const critiques = events.filter((event) => event.type === 'critique');
  const percent = (value: number, max: number) =>
    max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b dark:border-charcoal-border border-cream-border">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-coral">
            Scores & effort
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
            How well did these runs go?
          </h1>
          <p className="text-xs sm:text-sm dark:text-charcoal-muted text-cream-muted mt-1">
            The Critic's score out of 10, plus how many steps and tokens each run used. Every
            number comes from the saved steps, so you can check it against the run itself.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold dark:text-charcoal-muted text-cream-muted">
            Run:
          </span>
          <select
            value={selectedRunId || ''}
            onChange={(event) => selectRun(event.target.value)}
            className="px-3 py-2 rounded-xl border text-xs font-semibold dark:bg-charcoal-surface bg-cream-surface dark:border-charcoal-border border-cream-border max-w-xs truncate"
          >
            {runs.length === 0 && <option value="">No runs yet</option>}
            {runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.id.includes('golden') ? `Demo · ${run.goal}` : run.goal}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/5 text-red-500 text-xs flex items-start space-x-2">
          <AlertTriangle className="w-4 h-4 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!totalsMatch && (
        <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 text-amberAccent text-xs">
          Recorded run totals ({recordedTokens.toLocaleString()} tokens) differ from the
          event log ({totalTokens.toLocaleString()} tokens). The event log is authoritative;
          this can happen while a run is still writing.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="p-5 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">
              Critic Score
            </span>
            <Award className="w-4 h-4 text-coral" />
          </div>
          <div className="text-3xl font-extrabold text-coral">
            {avgScore != null ? `${avgScore}/10` : '—'}
          </div>
          <div className="text-[11px] dark:text-charcoal-muted text-cream-muted">
            {computed?.critic_scores?.length
              ? `${computed.critic_scores.length} evaluation(s)`
              : 'No evaluations recorded yet'}
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
            {totalTokens.toLocaleString()} tokens ({inTokens.toLocaleString()} in /{' '}
            {outTokens.toLocaleString()} out)
          </div>
        </div>

        <div className="p-5 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">
              Wall Clock
            </span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-3xl font-extrabold">{duration}s</div>
          <div className="text-[11px] dark:text-charcoal-muted text-cream-muted">
            First to last persisted event
          </div>
        </div>

        <div className="p-5 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">
              Retries
            </span>
            <RefreshCw className="w-4 h-4 text-amberAccent" />
          </div>
          <div className="text-3xl font-extrabold">{retries}</div>
          <div className="text-[11px] text-amberAccent font-medium">
            {computed?.faults_injected ?? 0} injected fault(s)
          </div>
        </div>
      </div>

      <div className="p-6 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-6">
        <div>
          <h2 className="text-base font-bold tracking-tight">
            Guardrail Budget Utilisation
          </h2>
          <p className="text-xs dark:text-charcoal-muted text-cream-muted">
            Caps come from the running backend configuration; warnings emit at 80%.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              label: 'Step budget',
              value: steps,
              max: limits.max_steps,
              display: `${steps} / ${limits.max_steps}`,
            },
            {
              label: 'Token budget',
              value: totalTokens,
              max: limits.max_tokens,
              display: `${totalTokens.toLocaleString()} / ${limits.max_tokens.toLocaleString()}`,
            },
            {
              label: 'Time budget',
              value: duration,
              max: limits.max_seconds,
              display: `${duration}s / ${limits.max_seconds}s`,
            },
          ].map((meter) => {
            const pct = percent(meter.value, meter.max);
            return (
              <div key={meter.label} className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span>{meter.label}:</span>
                  <span className="font-mono">
                    {meter.display} ({pct}%)
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      pct > 80 ? 'bg-amberAccent' : 'bg-coral'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-4">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-coral" />
            <h2 className="text-base font-bold tracking-tight">Agent performance</h2>
          </div>
          {!computed?.agents?.length ? (
            <p className="text-xs dark:text-charcoal-muted text-cream-muted">
              {loading ? 'Loading agent metrics…' : 'No agent activity recorded for this run.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">
                    <th className="py-2 pr-3">Agent</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Thoughts</th>
                    <th className="py-2 pr-3">Tools</th>
                    <th className="py-2 pr-3">Tokens</th>
                    <th className="py-2">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-charcoal-border divide-cream-border">
                  {computed.agents.map((agent) => (
                    <tr key={agent.agent_id}>
                      <td className="py-2 pr-3 font-semibold">{agent.agent_id}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            agent.agent_category === 'custom'
                              ? 'bg-purple-500/10 text-purple-500'
                              : 'dark:bg-charcoal-bg bg-cream-bg text-neutral-400'
                          }`}
                        >
                          {agent.agent_category}
                        </span>
                      </td>
                      <td className="py-2 pr-3 font-mono">{agent.thoughts}</td>
                      <td className="py-2 pr-3 font-mono">{agent.tool_calls}</td>
                      <td className="py-2 pr-3 font-mono">
                        {(agent.in_tokens + agent.out_tokens).toLocaleString()}
                      </td>
                      <td className="py-2 font-mono">${agent.cost_usd.toFixed(5)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-6 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-4">
          <div className="flex items-center space-x-2">
            <Wrench className="w-4 h-4 text-coral" />
            <h2 className="text-base font-bold tracking-tight">Run breakdown</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              ['Events', computed?.events ?? events.length],
              ['Tool calls', computed?.tool_calls ?? 0],
              ['Tasks started', computed?.tasks_started ?? 0],
              ['Tasks completed', computed?.tasks_completed ?? 0],
              ['Tasks failed', computed?.tasks_failed ?? 0],
              ['LLM latency', `${computed?.llm_latency_ms ?? 0} ms`],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="p-3 rounded-xl border dark:border-charcoal-border border-cream-border dark:bg-charcoal-bg bg-cream-bg"
              >
                <span className="text-[10px] uppercase tracking-wider dark:text-charcoal-muted text-cream-muted block">
                  {label}
                </span>
                <span className="font-bold text-sm">{value}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] dark:text-charcoal-muted text-cream-muted">
            Model: {config?.default_model ?? '—'} · LLM mode: {config?.llm_mode ?? '—'}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-base font-bold tracking-tight">
          Critic Evaluations & Reflection Logs
        </h2>

        <div className="rounded-2xl border overflow-hidden dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b dark:border-charcoal-border border-cream-border dark:bg-charcoal-bg/60 bg-cream-bg/60 text-[10px] uppercase font-bold tracking-wider dark:text-charcoal-muted text-cream-muted">
                  <th className="py-3 px-4">Task</th>
                  <th className="py-3 px-4">Verdict</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4">Feedback</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-charcoal-border divide-cream-border">
                {critiques.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-6 text-center dark:text-charcoal-muted text-cream-muted"
                    >
                      No critiques recorded in this execution.
                    </td>
                  </tr>
                ) : (
                  critiques.map((critique) => (
                    <tr
                      key={critique.id}
                      className="dark:hover:bg-charcoal-bg hover:bg-cream-bg transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-coral">
                        {critique.task_id || 'run-level'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            critique.payload?.verdict === 'accept'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-amber-500/10 text-amberAccent'
                          }`}
                        >
                          {critique.payload?.verdict}
                        </span>
                        {critique.payload?.enforced_by &&
                          critique.payload.enforced_by !== 'model' && (
                            <span className="ml-1 text-[9px] text-neutral-400">
                              (enforced)
                            </span>
                          )}
                      </td>
                      <td className="py-3 px-4 font-bold text-coral">
                        {critique.payload?.score}/10
                      </td>
                      <td className="py-3 px-4 leading-relaxed">
                        {critique.payload?.feedback}
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
