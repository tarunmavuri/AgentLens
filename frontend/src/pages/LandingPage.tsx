import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { HOW_IT_WORKS } from '../lib/plain';
import { ArrowRight, BookOpen, CheckCircle2, Code2, Search } from 'lucide-react';

const CAPABILITIES = [
  {
    index: '01',
    title: 'Watch Agents Collaborate Live',
    actionLabel: 'Open Live Runs',
    view: 'workspace' as const,
    summary:
      'Every handoff between the Planner, specialists, tools, and Critic streams over SSE into an interactive dependency graph.',
    previewLines: [
      { who: 'Planner', note: 'Decomposed goal into 3 dependent tasks', status: 'Done' },
      { who: 'Researcher', note: 'Queried live search & saved key sources', status: 'Done' },
      { who: 'Coder', note: 'Running Python benchmark inside sandbox', status: 'Active' },
      { who: 'Critic', note: 'Scoring accuracy against criteria (9.2/10)', status: 'Next' },
    ],
  },
  {
    index: '02',
    title: 'Compose Custom Specialists',
    actionLabel: 'Create Agent',
    view: 'builder' as const,
    summary:
      'Write a role and instructions in plain English, pick permitted tools, and enforce structured JSON outputs — zero Python boilerplate.',
    previewLines: [
      { who: 'Identity', note: 'Security Reviewer · Code & Sandbox Auditor', status: 'Config' },
      { who: 'Model', note: 'gemini-2.5-flash · temperature 0.1', status: 'Allowlist' },
      { who: 'Tools', note: 'read_memory only (server-enforced)', status: 'Scoped' },
      { who: 'Contract', note: 'Validated Pydantic output schema', status: 'Ready' },
    ],
  },
  {
    index: '03',
    title: 'Score, Audit & Replay Everything',
    actionLabel: 'View Evaluations',
    view: 'evals' as const,
    summary:
      'Inspect real token consumption, cost estimates, wall-clock latency, and Critic retries — or replay every event byte-for-byte.',
    previewLines: [
      { who: 'Metrics', note: 'Derived solely from persisted SQLite events', status: 'Verified' },
      { who: 'Guardrails', note: 'Step, token & timeout budgets tracked live', status: 'Protected' },
      { who: 'Faults', note: 'Optional Break-it mode tests Critic recovery', status: 'Testable' },
      { who: 'Export', note: 'Download full trace JSON anytime', status: '$0 Replay' },
    ],
  },
];

export const LandingPage: React.FC = () => {
  const { setView } = useAppStore();
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [activeCapIdx, setActiveCapIdx] = useState(0);

  const activeStep = HOW_IT_WORKS[activeStepIdx];
  const activeCap = CAPABILITIES[activeCapIdx];

  return (
    <div className="min-h-screen bg-cream-bg text-cream-text dark:bg-charcoal-bg dark:text-charcoal-text transition-colors duration-200">
      {/* ================= HERO (Editorial Asymmetric + Unboxed Live Trace Thread) ================= */}
      <section className="relative overflow-hidden border-b border-cream-border dark:border-charcoal-border py-16 md:py-24">
        <div
          className="absolute -top-24 right-1/4 w-[520px] h-[320px] rounded-full bg-coral/8 blur-[120px] pointer-events-none"
          aria-hidden="true"
        />

        <div className="max-w-6xl mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-coral">
              <span className="w-2 h-2 rounded-full bg-coral animate-pulse" />
              <span>Glass-box multi-agent AI workbench</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight leading-[1.06]">
              AI agent teams that{' '}
              <span className="font-editorial italic font-normal text-coral block sm:inline">
                show every step.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-cream-muted dark:text-charcoal-muted max-w-xl leading-relaxed">
              Ask one question. AgentLens splits it into clear tasks, lets specialized agents look
              up facts or run sandboxed code, grades the result, and leaves a replayable trail.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                onClick={() => setView('dashboard')}
                className="h-11 px-6 rounded-full text-xs font-bold uppercase tracking-wider bg-coral hover:bg-coral-hover text-white shadow-md shadow-coral/25 transition-all hover:scale-[1.02] inline-flex items-center gap-2"
              >
                <span>Open Studio</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setView('learn')}
                className="h-11 px-5 rounded-full text-xs font-semibold border border-cream-border dark:border-charcoal-border hover:border-coral transition-colors inline-flex items-center gap-2"
              >
                <BookOpen className="w-3.5 h-3.5 text-coral" />
                <span>How multi-agent AI works</span>
              </button>
            </div>

            <div className="pt-6 grid grid-cols-3 gap-6 border-t border-cream-border dark:border-charcoal-border text-xs max-w-lg">
              <div>
                <div className="font-editorial italic text-xl text-coral">Visible</div>
                <div className="text-cream-muted dark:text-charcoal-muted mt-0.5">
                  Every tool call & critique
                </div>
              </div>
              <div>
                <div className="font-editorial italic text-xl text-amberAccent">Verified</div>
                <div className="text-cream-muted dark:text-charcoal-muted mt-0.5">
                  Metrics from event logs
                </div>
              </div>
              <div>
                <div className="font-editorial italic text-xl text-cream-text dark:text-charcoal-text">
                  Replayable
                </div>
                <div className="text-cream-muted dark:text-charcoal-muted mt-0.5">
                  Trace export at zero cost
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Unboxed Living Execution Thread (Not a card-in-card box!) */}
          <div className="lg:col-span-5 lg:pl-6">
            <div className="flex items-center justify-between pb-4 mb-2 border-b border-cream-border dark:border-charcoal-border">
              <span className="text-[11px] font-mono uppercase tracking-widest text-cream-muted dark:text-charcoal-muted">
                Illustrative Trace Thread
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-coral">
                <span className="w-1.5 h-1.5 rounded-full bg-coral animate-ping" />
                SSE Stream
              </span>
            </div>

            <ol className="relative pl-6 space-y-5 my-4">
              <div
                className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-coral via-amberAccent to-cream-border dark:to-charcoal-border"
                aria-hidden="true"
              />

              {[
                {
                  agent: 'Planner',
                  time: '+0.4s',
                  line: 'Split "RAG vs Fine-Tuning" into 3 ordered tasks with criteria.',
                  active: false,
                  done: true,
                },
                {
                  agent: 'Researcher',
                  time: '+2.1s',
                  line: 'Queried search sources and wrote citations to run memory.',
                  active: false,
                  done: true,
                },
                {
                  agent: 'Coder',
                  time: '+4.8s',
                  line: 'Running Python benchmark & Matplotlib chart inside sandbox…',
                  active: true,
                  done: false,
                },
                {
                  agent: 'Critic',
                  time: 'Queued',
                  line: 'Scores completed output (0–10) and requests fixes if needed.',
                  active: false,
                  done: false,
                },
              ].map((item) => (
                <li key={item.agent} className="relative">
                  <span
                    className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 ${
                      item.active
                        ? 'bg-coral border-cream-bg dark:border-charcoal-bg ring-4 ring-coral/20'
                        : item.done
                          ? 'bg-statusSuccess border-cream-bg dark:border-charcoal-bg'
                          : 'bg-cream-bg dark:bg-charcoal-bg border-cream-muted dark:border-charcoal-muted'
                    }`}
                  />
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={`text-xs font-bold tracking-wide uppercase ${
                        item.active ? 'text-coral' : ''
                      }`}
                    >
                      {item.agent}
                    </span>
                    <span className="text-[10px] font-mono text-cream-muted dark:text-charcoal-muted">
                      {item.time}
                    </span>
                  </div>
                  <p className="text-xs text-cream-muted dark:text-charcoal-muted mt-0.5 leading-relaxed">
                    {item.line}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ================= HOW IT WORKS (Interactive Rail + Typography, ZERO 5-Box Grid) ================= */}
      <section className="py-16 md:py-24 max-w-6xl mx-auto px-5 sm:px-8 space-y-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2 max-w-xl">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-coral">
              Interactive Walkthrough
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              What happens after you{' '}
              <span className="font-editorial italic font-normal text-coral">press Start</span>
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-cream-muted dark:text-charcoal-muted max-w-sm">
            Click any stage along the track to follow a single request from decomposition to verified
            answer.
          </p>
        </div>

        {/* Continuous Horizontal Step Track */}
        <div className="relative">
          <div
            className="hidden md:block absolute top-5 left-0 right-0 h-px bg-cream-border dark:bg-charcoal-border"
            aria-hidden="true"
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 relative z-10">
            {HOW_IT_WORKS.map((step, index) => {
              const active = index === activeStepIdx;
              return (
                <button
                  key={step.step}
                  type="button"
                  onClick={() => setActiveStepIdx(index)}
                  className="text-left group focus:outline-none space-y-3"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-editorial italic text-xl transition-all border ${
                        active
                          ? 'bg-coral text-white border-coral shadow-md shadow-coral/25 scale-105'
                          : 'bg-cream-bg dark:bg-charcoal-bg border-cream-border dark:border-charcoal-border text-cream-muted dark:text-charcoal-muted group-hover:border-coral group-hover:text-coral'
                      }`}
                    >
                      0{step.step}
                    </span>
                  </div>
                  <div className="space-y-1 pr-2">
                    <div
                      className={`text-sm font-bold transition-colors ${
                        active
                          ? 'text-coral'
                          : 'text-cream-text dark:text-charcoal-text group-hover:text-coral'
                      }`}
                    >
                      {step.title}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Open Editorial Spotlight for Selected Step (No outer card border!) */}
        <div className="pt-8 border-t border-cream-border dark:border-charcoal-border grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-2 flex items-baseline gap-2">
            <span className="font-editorial italic text-6xl text-coral leading-none">
              0{activeStep.step}
            </span>
            <span className="text-xs font-mono text-cream-muted dark:text-charcoal-muted">
              / 05
            </span>
          </div>

          <div className="md:col-span-7 space-y-2">
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight">{activeStep.title}</h3>
            <p className="text-sm sm:text-base text-cream-muted dark:text-charcoal-muted leading-relaxed">
              {activeStep.plain}
            </p>
          </div>

          <div className="md:col-span-3 flex md:justify-end gap-2">
            <button
              type="button"
              onClick={() =>
                setActiveStepIdx((i) => (i - 1 + HOW_IT_WORKS.length) % HOW_IT_WORKS.length)
              }
              className="h-9 px-3.5 rounded-full border border-cream-border dark:border-charcoal-border text-xs font-semibold hover:border-coral transition-colors"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setActiveStepIdx((i) => (i + 1) % HOW_IT_WORKS.length)}
              className="h-9 px-3.5 rounded-full border border-cream-border dark:border-charcoal-border text-xs font-semibold hover:border-coral text-coral transition-colors"
            >
              Next stage →
            </button>
          </div>
        </div>
      </section>

      {/* ================= CAPABILITIES SPLIT INDEX (Replaces 3 Boxed Cards!) ================= */}
      <section className="py-16 md:py-20 border-t border-cream-border dark:border-charcoal-border bg-cream-surface/40 dark:bg-charcoal-surface/35">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Index List */}
          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-amberAccent">
                Inside the Platform
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Three ways to learn and build
              </h2>
            </div>

            <div className="divide-y divide-cream-border dark:divide-charcoal-border border-y border-cream-border dark:border-charcoal-border">
              {CAPABILITIES.map((cap, idx) => {
                const active = idx === activeCapIdx;
                return (
                  <button
                    key={cap.index}
                    type="button"
                    onClick={() => setActiveCapIdx(idx)}
                    onMouseEnter={() => setActiveCapIdx(idx)}
                    className={`w-full py-5 pl-4 pr-2 text-left transition-all flex items-start gap-4 relative ${
                      active ? '' : 'opacity-65 hover:opacity-100'
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-4 bottom-4 w-1 rounded-full bg-coral" />
                    )}
                    <span className="font-editorial italic text-2xl text-coral leading-none pt-0.5">
                      {cap.index}
                    </span>
                    <div className="flex-1 space-y-1">
                      <div className="font-bold text-base tracking-tight">{cap.title}</div>
                      <p className="text-xs text-cream-muted dark:text-charcoal-muted leading-relaxed">
                        {cap.summary}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Live Chapter Preview Canvas (Unboxed open sheet with left Coral accent) */}
          <div className="lg:col-span-6 lg:pl-6 lg:pt-14">
            <div className="pl-6 border-l-2 border-coral/60 space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-widest text-amberAccent">
                  Chapter {activeCap.index}
                </span>
                <button
                  type="button"
                  onClick={() => setView(activeCap.view)}
                  className="text-xs font-bold text-coral hover:underline inline-flex items-center gap-1"
                >
                  <span>{activeCap.actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <h3 className="text-2xl font-bold tracking-tight">{activeCap.title}</h3>

              <div className="divide-y divide-cream-border dark:divide-charcoal-border">
                {activeCap.previewLines.map((row) => (
                  <div
                    key={row.who}
                    className="py-3 flex items-center justify-between gap-4 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-cream-text dark:text-charcoal-text">
                        {row.who}
                      </span>
                      <p className="text-cream-muted dark:text-charcoal-muted mt-0.5 truncate">
                        {row.note}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-coral/10 text-coral flex-shrink-0">
                      {row.status}
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setView(activeCap.view)}
                className="h-10 px-5 rounded-full text-xs font-semibold bg-coral hover:bg-coral-hover text-white shadow-sm shadow-coral/20 transition-colors inline-flex items-center gap-2"
              >
                <span>{activeCap.actionLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ================= ENGINEERING GUARANTEES (Minimal Typographic Footnotes) ================= */}
      <section className="py-12 border-t border-cream-border dark:border-charcoal-border">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 grid gap-8 sm:grid-cols-3 text-xs">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-statusSuccess flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Complete Transparency</span>
              <span className="text-cream-muted dark:text-charcoal-muted leading-relaxed">
                Every event is persisted before streaming, enabling deterministic replay and JSON
                export.
              </span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Code2 className="w-4 h-4 text-coral flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Sandboxed Python</span>
              <span className="text-cream-muted dark:text-charcoal-muted leading-relaxed">
                Generated scripts run in a throwaway workspace with CPython audit hooks and timeout
                guards.
              </span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Search className="w-4 h-4 text-amberAccent flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Honest Telemetry</span>
              <span className="text-cream-muted dark:text-charcoal-muted leading-relaxed">
                All scores, tokens, and costs are derived directly from saved execution events.
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
