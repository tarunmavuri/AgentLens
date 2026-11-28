import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { agentPlain, GLOSSARY, HOW_IT_WORKS } from '../lib/plain';
import { ArrowRight, BookOpen, ExternalLink, ChevronDown } from 'lucide-react';

export const LearnPage: React.FC = () => {
  const { setView, agents, concepts, setEditingAgent } = useAppStore();
  const team = ['planner', 'researcher', 'coder', 'critic'];

  return (
    <div className="max-w-5xl mx-auto px-5 py-12 space-y-16">
      {/* Editorial Header */}
      <header className="space-y-4 border-b border-cream-border dark:border-charcoal-border pb-10">
        <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-coral">
          <BookOpen className="w-3.5 h-3.5" />
          <span>Field Guide · Agentic AI Concepts</span>
        </span>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
          How multi-agent systems work in{' '}
          <span className="font-editorial italic font-normal text-coral">plain language.</span>
        </h1>
        <p className="text-sm sm:text-base text-cream-muted dark:text-charcoal-muted max-w-2xl leading-relaxed">
          Instead of a single opaque model prompt, AgentLens coordinates specialized agents that
          plan tasks, call sandboxed tools, critique each other&apos;s output, and log every step.
        </p>
      </header>

      {/* Orchestration Lifecycle — Horizontal Numbered Editorial Rail (No boxes!) */}
      <section className="space-y-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-amberAccent">
            01 · Lifecycle
          </span>
          <h2 className="text-xl font-bold mt-1">Five steps inside every execution</h2>
        </div>

        <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5 border-t border-cream-border dark:border-charcoal-border pt-6">
          {HOW_IT_WORKS.map((step) => (
            <li key={step.step} className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="font-editorial italic text-3xl text-coral leading-none">
                  0{step.step}
                </span>
                <span aria-hidden="true" className="text-base">
                  {step.emoji}
                </span>
              </div>
              <h3 className="font-bold text-sm">{step.title}</h3>
              <p className="text-xs text-cream-muted dark:text-charcoal-muted leading-relaxed">
                {step.plain}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Built-in Team — Open Hairline Roster (No boxes!) */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-amberAccent">
              02 · Specialists
            </span>
            <h2 className="text-xl font-bold mt-1">Built-in agent roles</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingAgent(null);
              setView('builder');
            }}
            className="text-xs font-semibold text-coral hover:underline inline-flex items-center gap-1"
          >
            <span>Build your own agent</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2 border-t border-cream-border dark:border-charcoal-border pt-6">
          {team.map((id) => {
            const definition = agents.find((agent) => agent.agent_id === id);
            const plain = agentPlain(id, definition?.role);
            return (
              <div
                key={id}
                className="flex items-start gap-3.5 pb-4 border-b border-cream-border/70 dark:border-charcoal-border/70"
              >
                <span
                  aria-hidden="true"
                  className="text-2xl leading-none mt-0.5 flex-shrink-0"
                >
                  {plain.emoji}
                </span>
                <div className="space-y-1">
                  <h3 className="font-bold text-sm">{plain.name}</h3>
                  <p className="text-xs text-cream-muted dark:text-charcoal-muted leading-relaxed">
                    {plain.does}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Live Engineering Patterns — Clean Two-Column Index (No boxes!) */}
      {concepts.length > 0 && (
        <section className="space-y-6">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-amberAccent">
              03 · Architecture Patterns
            </span>
            <h2 className="text-xl font-bold mt-1">Engineering concepts behind the timeline</h2>
            <p className="text-xs text-cream-muted dark:text-charcoal-muted mt-0.5">
              Every step in the live event timeline links back to one of these patterns.
            </p>
          </div>

          <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2 border-t border-cream-border dark:border-charcoal-border pt-6">
            {concepts.map((concept, idx) => (
              <article
                key={concept.id}
                className="pl-4 border-l-2 border-cream-border dark:border-charcoal-border hover:border-coral transition-colors space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-sm">{concept.title}</h3>
                  <span className="text-[10px] font-mono text-cream-muted dark:text-charcoal-muted">
                    0{idx + 1}
                  </span>
                </div>
                <p className="text-xs text-cream-muted dark:text-charcoal-muted leading-relaxed">
                  {concept.explanation}
                </p>
                <a
                  href={concept.learn_more_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-coral hover:underline pt-0.5"
                >
                  <span>Read Paper / Spec</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Student Glossary — Clean Accordion Ledger */}
      <section className="space-y-5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-amberAccent">
            04 · Vocabulary
          </span>
          <h2 className="text-xl font-bold mt-1">Student glossary</h2>
        </div>

        <div className="divide-y divide-cream-border dark:divide-charcoal-border border-y border-cream-border dark:border-charcoal-border">
          {GLOSSARY.map((item) => (
            <details key={item.term} className="group py-3.5">
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <span className="flex items-center gap-2.5 text-sm font-semibold">
                  <span aria-hidden="true">{item.emoji}</span>
                  <span className="group-open:text-coral transition-colors">{item.term}</span>
                </span>
                <ChevronDown className="w-4 h-4 text-cream-muted dark:text-charcoal-muted transition-transform group-open:rotate-180 group-open:text-coral" />
              </summary>
              <div className="pl-7 pt-2 space-y-1">
                <p className="text-xs leading-relaxed text-cream-muted dark:text-charcoal-muted">
                  {item.plain}
                </p>
                <p className="text-[11px] font-medium text-amberAccent">{item.example}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Open Editorial Footer CTA */}
      <section className="pt-4 border-t border-cream-border dark:border-charcoal-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Ready to watch a team run live?</h2>
          <p className="text-xs text-cream-muted dark:text-charcoal-muted mt-0.5">
            Explore recorded demo executions or launch a fresh experiment in the studio.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setView('dashboard')}
            className="h-10 px-5 rounded-full text-xs font-semibold bg-coral hover:bg-coral-hover text-white shadow-sm shadow-coral/20 transition-colors inline-flex items-center gap-1.5"
          >
            <span>Open Overview</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setView('workspace')}
            className="h-10 px-5 rounded-full text-xs font-semibold border border-cream-border dark:border-charcoal-border hover:border-coral transition-colors"
          >
            Open Live Runs
          </button>
        </div>
      </section>
    </div>
  );
};
