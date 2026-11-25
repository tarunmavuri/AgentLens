import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import * as api from '../api/client';
import { PublicConfig } from '../types';
import {
  Cpu,
  Database,
  Palette,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Coins,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { theme, setTheme } = useAppStore();
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .fetchConfig()
      .then(setConfig)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load configuration'),
      );
  }, []);

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-4xl mx-auto">
      <div className="pb-6 border-b dark:border-charcoal-border border-cream-border">
        <span className="text-[11px] font-bold uppercase tracking-widest text-coral">
          Preferences
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
          Settings
        </h1>
        <p className="text-xs sm:text-sm dark:text-charcoal-muted text-cream-muted mt-1">
          Choose light or dark, and see which backend this browser is connected to.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/5 text-red-500 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="p-6 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-4">
        <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-coral">
          <Palette className="w-4 h-4" />
          <span>Visual Theme</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setTheme('dark')}
            className={`p-4 rounded-xl border cursor-pointer transition-all text-left ${
              theme === 'dark' ? 'border-coral ring-2 ring-coral/20' : 'border-neutral-700'
            } bg-[#151217] text-[#F6F0EB]`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm">Deep Charcoal (Dark)</span>
              {theme === 'dark' && <CheckCircle2 className="w-4 h-4 text-coral" />}
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              #151217 surfaces with coral and warm amber accents.
            </p>
          </button>

          <button
            onClick={() => setTheme('light')}
            className={`p-4 rounded-xl border cursor-pointer transition-all text-left ${
              theme === 'light' ? 'border-coral ring-2 ring-coral/20' : 'border-neutral-300'
            } bg-[#F5F0EA] text-[#1D1919]`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm">Warm Cream (Light)</span>
              {theme === 'light' && <CheckCircle2 className="w-4 h-4 text-coral" />}
            </div>
            <p className="text-xs text-neutral-600 mt-1">
              #F5F0EA editorial surfaces with the same coral accents.
            </p>
          </button>
        </div>
      </div>

      <div className="p-6 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-4">
        <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-coral">
          <Cpu className="w-4 h-4" />
          <span>Engine & LLM Configuration</span>
        </div>

        {!config ? (
          <p className="text-xs dark:text-charcoal-muted text-cream-muted">
            {error ? 'Configuration unavailable.' : 'Loading configuration…'}
          </p>
        ) : (
          <>
            {config.llm_mode === 'offline_simulation' && (
              <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amberAccent text-[11px] leading-relaxed">
                No API key is configured. Runs execute a deterministic offline simulation
                and every trace is labelled <code>llm_mode=offline_simulation</code>. Set
                <code> GEMINI_API_KEY</code> on the backend to use real Gemini calls.
              </div>
            )}
            {config.llm_mode === 'disabled' && (
              <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 text-[11px]">
                No provider configured and offline simulation disabled: runs will fail.
              </div>
            )}

            <div className="space-y-3 text-xs">
              {[
                ['Version', config.version],
                ['Environment', config.environment],
                ['LLM mode', config.llm_mode],
                ['Default model', config.default_model],
                ['Search provider', config.search_provider],
                ['Sandbox timeout', `${config.sandbox_timeout_seconds}s`],
                ['Rate limit', `${config.rate_limit.requests} requests / ${config.rate_limit.window_seconds}s`],
                ['Model allowlist', config.allowed_models.join(', ')],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex flex-wrap justify-between gap-2 py-2 border-b dark:border-charcoal-border border-cream-border"
                >
                  <span className="font-medium">{label}</span>
                  <span className="font-mono text-right">{value}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="p-6 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-4">
        <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-coral">
          <ShieldCheck className="w-4 h-4" />
          <span>Guardrails</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {config &&
            [
              ['Max steps', config.limits.max_steps],
              ['Max tokens', config.limits.max_tokens.toLocaleString()],
              ['Max seconds', config.limits.max_seconds],
              ['Max retries', config.limits.max_retries],
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
      </div>

      <div className="p-6 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-4">
        <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-coral">
          <Coins className="w-4 h-4" />
          <span>Model Pricing ($ per million tokens)</span>
        </div>
        {config ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">
                  <th className="py-2 pr-4">Model</th>
                  <th className="py-2 pr-4">Input</th>
                  <th className="py-2">Output</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-charcoal-border divide-cream-border">
                {Object.entries(config.pricing_per_million_tokens).map(([model, price]) => (
                  <tr key={model}>
                    <td className="py-2 pr-4 font-mono">{model}</td>
                    <td className="py-2 pr-4 font-mono">
                      ${price.input_cost_per_million.toFixed(3)}
                    </td>
                    <td className="py-2 font-mono">
                      ${price.output_cost_per_million.toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs dark:text-charcoal-muted text-cream-muted">
            Pricing unavailable.
          </p>
        )}
        <p className="text-[10px] dark:text-charcoal-muted text-cream-muted">
          Override any model's rate with <code>MODEL_PRICING_JSON</code>. Verify with your
          provider before using costs for billing.
        </p>
      </div>

      <div className="p-6 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-3">
        <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-coral">
          <Database className="w-4 h-4" />
          <span>Storage & Security</span>
        </div>
        <ul className="text-xs dark:text-charcoal-muted text-cream-muted space-y-1.5 list-disc pl-4">
          <li>SQLite in WAL mode; every event is persisted before it is streamed.</li>
          <li>API keys live only in backend environment variables, never in traces.</li>
          <li>
            Python runs in a child process with audit-hook guards, stripped environment and
            resource limits — see the README's sandbox security section for the remaining
            limitations.
          </li>
          <li>
            Hosted deployments need a persistent disk for SQLite or a PostgreSQL migration;
            see README "Deployment".
          </li>
        </ul>
      </div>
    </div>
  );
};
