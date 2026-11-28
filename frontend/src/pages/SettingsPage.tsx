import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import * as api from '../api/client';
import { PublicConfig } from '../types';
import {
  CheckCircle2,
  AlertTriangle,
  LogOut,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { theme, setTheme, settingsTab, setSettingsTab, clearUserData, setView } = useAppStore();
  const { user, signOut } = useAuthStore();
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

  const handleSignOut = () => {
    signOut();
    clearUserData();
    setView('landing');
  };

  return (
    <div className="p-5 sm:p-8 space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-cream-border dark:border-charcoal-border">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-coral">
            Settings
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
            {settingsTab === 'account' ? 'Account & Session' : 'Preferences & System Config'}
          </h1>
          <p className="text-xs sm:text-sm text-cream-muted dark:text-charcoal-muted mt-1">
            {settingsTab === 'account'
              ? 'Manage your authenticated Cloudflare Access session and workspace isolation.'
              : 'Choose visual theme and inspect active guardrails and model pricing.'}
          </p>
        </div>

        <div className="inline-flex rounded-full border border-cream-border dark:border-charcoal-border bg-cream-surface dark:bg-charcoal-surface p-1">
          <button
            type="button"
            onClick={() => setSettingsTab('account')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              settingsTab === 'account'
                ? 'bg-coral text-white'
                : 'text-cream-muted dark:text-charcoal-muted hover:text-cream-text dark:hover:text-charcoal-text'
            }`}
          >
            Account
          </button>
          <button
            type="button"
            onClick={() => setSettingsTab('preferences')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              settingsTab === 'preferences'
                ? 'bg-coral text-white'
                : 'text-cream-muted dark:text-charcoal-muted hover:text-cream-text dark:hover:text-charcoal-text'
            }`}
          >
            Preferences
          </button>
        </div>
      </div>

      {error && (
        <div className="pl-3.5 border-l-2 border-statusError text-statusError text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {settingsTab === 'account' ? (
        <div className="space-y-8 divide-y divide-cream-border dark:divide-charcoal-border">
          <section className="space-y-4">
            <h2 className="text-sm font-bold">Authenticated Identity</h2>
            <div className="divide-y divide-cream-border/70 dark:divide-charcoal-border/70 border-y border-cream-border dark:border-charcoal-border text-xs">
              {[
                ['User ID', user?.uid ?? '—'],
                ['Display Name', user?.name ?? '—'],
                ['Email', user?.email ?? '—'],
                [
                  'Authentication Provider',
                  user?.auth_provider === 'cloudflare_access'
                    ? 'Cloudflare Access (Zero Trust)'
                    : 'Local Development Mode',
                ],
              ].map(([label, value]) => (
                <div key={label} className="py-3 flex flex-wrap justify-between gap-2">
                  <span className="text-cream-muted dark:text-charcoal-muted font-medium">
                    {label}
                  </span>
                  <span className="font-mono font-medium">{value}</span>
                </div>
              ))}
            </div>

            {user?.auth_provider === 'cloudflare_access' && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="h-9 px-4 rounded-full border border-statusError/30 text-statusError hover:bg-statusError/10 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out of Cloudflare Access</span>
                </button>
              </div>
            )}
          </section>

          <section className="pt-6 space-y-2">
            <h2 className="text-sm font-bold">User Data Isolation</h2>
            <p className="text-xs text-cream-muted dark:text-charcoal-muted leading-relaxed max-w-2xl">
              Every execution, SSE event stream, metric calculation, trace export, and custom agent
              created while signed in is isolated strictly to{' '}
              <code className="font-mono text-coral">{user?.uid}</code>.
            </p>
          </section>
        </div>
      ) : (
        <div className="space-y-10 divide-y divide-cream-border dark:divide-charcoal-border">
          {/* Visual Theme Swatches */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold">Visual Theme</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`p-5 rounded-2xl border cursor-pointer transition-all text-left bg-[#F6F1EA] text-[#1C1817] ${
                  theme === 'light'
                    ? 'border-[#FF513C] ring-2 ring-[#FF513C]/20'
                    : 'border-[#E5DACD]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">Warm Cream (Light)</span>
                  {theme === 'light' && <CheckCircle2 className="w-4 h-4 text-[#FF513C]" />}
                </div>
                <p className="text-xs text-[#746A61] mt-1">
                  #F6F1EA paper surfaces with Coral (#FF513C) & Amber (#F47742) accents.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`p-5 rounded-2xl border cursor-pointer transition-all text-left bg-[#151217] text-[#F6F0EB] ${
                  theme === 'dark'
                    ? 'border-[#FF513C] ring-2 ring-[#FF513C]/20'
                    : 'border-[#332B36]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">Deep Charcoal (Dark)</span>
                  {theme === 'dark' && <CheckCircle2 className="w-4 h-4 text-[#FF513C]" />}
                </div>
                <p className="text-xs text-[#A499AA] mt-1">
                  #151217 charcoal surfaces with warm Coral & Amber highlights.
                </p>
              </button>
            </div>
          </section>

          {/* Engine Configuration */}
          <section className="pt-8 space-y-4">
            <h2 className="text-sm font-bold">Engine & LLM Configuration</h2>
            {!config ? (
              <p className="text-xs text-cream-muted dark:text-charcoal-muted">
                {error ? 'Configuration unavailable.' : 'Loading configuration…'}
              </p>
            ) : (
              <>
                {config.llm_mode === 'offline_simulation' && (
                  <div className="pl-3.5 border-l-2 border-amberAccent text-amberAccent text-xs leading-relaxed">
                    No Gemini API key configured. Runs use deterministic{' '}
                    <code className="font-mono">offline_simulation</code> mode. Set{' '}
                    <code className="font-mono">GEMINI_API_KEY</code> on the backend for live Gemini
                    calls.
                  </div>
                )}

                <div className="divide-y divide-cream-border/70 dark:divide-charcoal-border/70 border-y border-cream-border dark:border-charcoal-border text-xs">
                  {[
                    ['Version', config.version],
                    ['Environment', config.environment],
                    ['LLM mode', config.llm_mode],
                    ['Default model', config.default_model],
                    ['Search provider', config.search_provider],
                    ['Sandbox timeout', `${config.sandbox_timeout_seconds}s`],
                    [
                      'Rate limit',
                      `${config.rate_limit.requests} requests / ${config.rate_limit.window_seconds}s`,
                    ],
                    ['Model allowlist', config.allowed_models.join(', ')],
                  ].map(([label, value]) => (
                    <div key={label} className="py-2.5 flex flex-wrap justify-between gap-2">
                      <span className="font-medium text-cream-muted dark:text-charcoal-muted">
                        {label}
                      </span>
                      <span className="font-mono text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Guardrails */}
          <section className="pt-8 space-y-4">
            <h2 className="text-sm font-bold">Default Execution Guardrails</h2>
            {config && (
              <div className="grid grid-cols-2 sm:grid-cols-4 border-y border-cream-border dark:border-charcoal-border divide-y sm:divide-y-0 sm:divide-x divide-cream-border dark:divide-charcoal-border text-xs">
                {[
                  ['Max Steps', config.limits.max_steps],
                  ['Max Tokens', config.limits.max_tokens.toLocaleString()],
                  ['Max Seconds', config.limits.max_seconds],
                  ['Max Retries', config.limits.max_retries],
                ].map(([label, value]) => (
                  <div key={String(label)} className="py-3 sm:px-4 first:sm:pl-0 last:sm:pr-0">
                    <span className="text-[10px] uppercase tracking-wider text-cream-muted dark:text-charcoal-muted block">
                      {label}
                    </span>
                    <span className="font-bold text-base">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Model Pricing */}
          <section className="pt-8 space-y-4">
            <h2 className="text-sm font-bold">Model Pricing ($ per million tokens)</h2>
            {config ? (
              <div className="overflow-x-auto border-y border-cream-border dark:border-charcoal-border">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-cream-muted dark:text-charcoal-muted border-b border-cream-border dark:border-charcoal-border">
                      <th className="py-2.5 pr-4">Model</th>
                      <th className="py-2.5 pr-4">Input</th>
                      <th className="py-2.5">Output</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-border/70 dark:divide-charcoal-border/70">
                    {Object.entries(config.pricing_per_million_tokens).map(([model, price]) => (
                      <tr key={model}>
                        <td className="py-2.5 pr-4 font-mono">{model}</td>
                        <td className="py-2.5 pr-4 font-mono">
                          ${price.input_cost_per_million.toFixed(3)}
                        </td>
                        <td className="py-2.5 font-mono">
                          ${price.output_cost_per_million.toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-cream-muted dark:text-charcoal-muted">
                Pricing unavailable.
              </p>
            )}
          </section>

          {/* Storage & Security */}
          <section className="pt-8 space-y-3">
            <h2 className="text-sm font-bold">Storage & Sandbox Security</h2>
            <ul className="text-xs text-cream-muted dark:text-charcoal-muted space-y-1.5 list-disc pl-4">
              <li>SQLite in WAL mode; every event is persisted before streaming.</li>
              <li>API keys remain strictly on the backend and never enter traces or bundles.</li>
              <li>
                Python executes inside an isolated child directory with CPython audit hooks and
                wall-clock timeout guards.
              </li>
            </ul>
          </section>
        </div>
      )}
    </div>
  );
};
