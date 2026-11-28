import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import * as api from '../api/client';
import { PublicConfig, RunMetrics } from '../types';
import { Award, Coins, Clock, RefreshCw, AlertTriangle } from 'lucide-react';
import { InfoTooltip } from '../components/ui/InfoTooltip';

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
  const duration = computed?.wall_clock_seconds ?? activeRun?.totals?.duration_seconds ?? 0;
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
    <div className="p-5 sm:p-8 space-y-10 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-cream-border dark:border-charcoal-border">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-coral">
            Learn · Evaluations
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
            Execution Metrics & Critic Scores
          </h1>
          <p className="text-xs sm:text-sm text-cream-muted dark:text-charcoal-muted mt-1">
            Computed directly from persisted events — hover any help icon to learn what each metric
            measures.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-cream-muted dark:text-charcoal-muted">
            Execution:
          </span>
          <select
            value={selectedRunId || ''}
            onChange={(event) => selectRun(event.target.value)}
            className="h-9 px-3 rounded-full border text-xs font-semibold bg-cream-surface dark:bg-charcoal-surface border-cream-border dark:border-charcoal-border max-w-xs truncate"
          >
            {runs.length === 0 && <option value="">No executions yet</option>}
            {runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.id.includes('golden') ? `Demo · ${run.goal}` : run.goal}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="pl-4 border-l-2 border-statusError text-statusError text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!totalsMatch && (
        <div className="pl-4 border-l-2 border-amberAccent text-amberAccent text-xs">
          Recorded totals ({recordedTokens.toLocaleString()} tokens) differ from the event log (
          {totalTokens.toLocaleString()} tokens). Event logs are authoritative while a run finishes.
        </div>
      )}

      {/* Open Hairline-Divided Metric Strip (Replaces 4 boxed KPI cards!) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 border-y border-cream-border dark:border-charcoal-border divide-y sm:divide-y-0 lg:divide-x divide-cream-border dark:divide-charcoal-border">
        <div className="py-5 lg:pr-6 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-cream-muted dark:text-charcoal-muted">
            <Award className="w-3.5 h-3.5 text-coral" />
            <span>Critic Score</span>
            <InfoTooltip text="Average 0–10 evaluation score given by the Critic against task criteria." />
          </div>
          <div className="text-3xl font-bold text-coral">
            {avgScore != null ? `${avgScore}/10` : '—'}
          </div>
          <div className="text-[11px] text-cream-muted dark:text-charcoal-muted">
            {computed?.critic_scores?.length
              ? `${computed.critic_scores.length} evaluation(s)`
              : 'No evaluations yet'}
          </div>
        </div>

        <div className="py-5 lg:px-6 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-cream-muted dark:text-charcoal-muted">
            <Coins className="w-3.5 h-3.5 text-statusSuccess" />
            <span>Estimated Cost</span>
            <InfoTooltip text="Token consumption multiplied by model rates (~750 words ≈ 1,000 tokens)." />
          </div>
          <div className="text-3xl font-bold">${cost.toFixed(5)}</div>
          <div className="text-[11px] text-cream-muted dark:text-charcoal-muted">
            {totalTokens.toLocaleString()} tokens ({inTokens.toLocaleString()} in /{' '}
            {outTokens.toLocaleString()} out)
          </div>
        </div>

        <div className="py-5 lg:px-6 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-cream-muted dark:text-charcoal-muted">
            <Clock className="w-3.5 h-3.5 text-amberAccent" />
            <span>Wall Clock</span>
            <InfoTooltip text="Total elapsed time from run start until the final persisted event." />
          </div>
          <div className="text-3xl font-bold">{duration}s</div>
          <div className="text-[11px] text-cream-muted dark:text-charcoal-muted">
            LLM latency: {computed?.llm_latency_ms ?? 0} ms
          </div>
        </div>

        <div className="py-5 lg:pl-6 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-cream-muted dark:text-charcoal-muted">
            <RefreshCw className="w-3.5 h-3.5 text-amberAccent" />
            <span>Retries</span>
            <InfoTooltip text="How many times the Critic rejected output and demanded a revised attempt." />
          </div>
          <div className="text-3xl font-bold">{retries}</div>
          <div className="text-[11px] text-amberAccent font-medium">
            {computed?.faults_injected ?? 0} injected fault(s)
          </div>
        </div>
      </section>

      {/* Guardrail Budget Bars (Open typographic band) */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-bold">Guardrail Budget Utilisation</h2>
          <p className="text-xs text-cream-muted dark:text-charcoal-muted mt-0.5">
            Enforced limits from backend configuration; warnings trigger at 80% utilization.
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
                  <span>{meter.label}</span>
                  <span className="font-mono text-cream-muted dark:text-charcoal-muted">
                    {meter.display} ({pct}%)
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-cream-subtle dark:bg-charcoal-subtle overflow-hidden">
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
      </section>

      {/* Per-Agent Breakdown + Counters (Open Split Ledger) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 border-t border-cream-border dark:border-charcoal-border pt-8">
        <div className="lg:col-span-7 space-y-3">
          <h2 className="text-base font-bold">Per-Agent Breakdown</h2>
          {!computed?.agents?.length ? (
            <p className="text-xs text-cream-muted dark:text-charcoal-muted">
              {loading ? 'Loading agent metrics…' : 'No agent activity recorded for this execution.'}
            </p>
          ) : (
            <div className="overflow-x-auto border-y border-cream-border dark:border-charcoal-border">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-cream-muted dark:text-charcoal-muted border-b border-cream-border dark:border-charcoal-border">
                    <th className="py-2.5 pr-3">Agent</th>
                    <th className="py-2.5 px-2">Type</th>
                    <th className="py-2.5 px-2">Thoughts</th>
                    <th className="py-2.5 px-2">Tools</th>
                    <th className="py-2.5 px-2">Tokens</th>
                    <th className="py-2.5 pl-2 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-border/70 dark:divide-charcoal-border/70">
                  {computed.agents.map((agent) => (
                    <tr key={agent.agent_id}>
                      <td className="py-2.5 pr-3 font-semibold">{agent.agent_id}</td>
                      <td className="py-2.5 px-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            agent.agent_category === 'custom'
                              ? 'bg-amberAccent/15 text-amberAccent'
                              : 'bg-cream-subtle dark:bg-charcoal-subtle text-cream-muted dark:text-charcoal-muted'
                          }`}
                        >
                          {agent.agent_category}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 font-mono">{agent.thoughts}</td>
                      <td className="py-2.5 px-2 font-mono">{agent.tool_calls}</td>
                      <td className="py-2.5 px-2 font-mono">
                        {(agent.in_tokens + agent.out_tokens).toLocaleString()}
                      </td>
                      <td className="py-2.5 pl-2 font-mono text-right">${agent.cost_usd.toFixed(5)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 space-y-3">
          <h2 className="text-base font-bold">Execution Counters</h2>
          <div className="divide-y divide-cream-border dark:divide-charcoal-border border-y border-cream-border dark:border-charcoal-border text-xs">
            {[
              ['Total Events', computed?.events ?? events.length],
              ['Tool Calls', computed?.tool_calls ?? 0],
              ['Tasks Started', computed?.tasks_started ?? 0],
              ['Tasks Completed', computed?.tasks_completed ?? 0],
              ['Tasks Failed', computed?.tasks_failed ?? 0],
              ['LLM Latency', `${computed?.llm_latency_ms ?? 0} ms`],
            ].map(([label, value]) => (
              <div key={String(label)} className="py-2.5 flex justify-between items-center">
                <span className="text-cream-muted dark:text-charcoal-muted">{label}</span>
                <span className="font-mono font-bold">{value}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-cream-muted dark:text-charcoal-muted">
            Model: <span className="font-mono">{config?.default_model ?? '—'}</span> · Mode:{' '}
            <span className="font-mono">{config?.llm_mode ?? '—'}</span>
          </p>
        </div>
      </section>

      {/* Critic Evaluations Table */}
      <section className="space-y-3">
        <h2 className="text-base font-bold">Critic Evaluations & Feedback</h2>

        <div className="border-y border-cream-border dark:border-charcoal-border overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-cream-border dark:border-charcoal-border text-[10px] uppercase font-bold tracking-wider text-cream-muted dark:text-charcoal-muted">
                <th className="py-3 pr-4">Task</th>
                <th className="py-3 px-3">Verdict</th>
                <th className="py-3 px-3">Score</th>
                <th className="py-3 pl-3">Feedback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-border/70 dark:divide-charcoal-border/70">
              {critiques.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-8 text-center text-cream-muted dark:text-charcoal-muted"
                  >
                    No critiques recorded in this execution.
                  </td>
                </tr>
              ) : (
                critiques.map((critique) => (
                  <tr key={critique.id}>
                    <td className="py-3 pr-4 font-mono font-semibold text-coral">
                      {critique.task_id || 'run-level'}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          critique.payload?.verdict === 'accept'
                            ? 'bg-statusSuccess/10 text-statusSuccess'
                            : 'bg-amberAccent/15 text-amberAccent'
                        }`}
                      >
                        {critique.payload?.verdict}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-coral">
                      {critique.payload?.score}/10
                    </td>
                    <td className="py-3 pl-3 leading-relaxed">{critique.payload?.feedback}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
