import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { X, PlayCircle, AlertTriangle } from 'lucide-react';
import { InfoTooltip } from './ui/InfoTooltip';
import * as api from '../api/client';
import { FaultConfig } from '../types';

interface NewRunModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHOWCASE_GOALS = [
  {
    title: 'RAG vs Fine-Tuning',
    goal: 'Compare RAG vs fine-tuning for a customer-support bot and back it up with a small code experiment',
  },
  {
    title: 'Sorting Benchmark',
    goal: 'Benchmark three sorting algorithms on 10,000 items and explain the timings',
  },
  {
    title: 'Agent Evaluation Survey',
    goal: 'Summarise 3 recent approaches to evaluating LLM agents, with sources',
  },
];

export const NewRunModal: React.FC<NewRunModalProps> = ({ isOpen, onClose }) => {
  const { loadRuns, selectRun, setView } = useAppStore();
  const [goal, setGoal] = useState('');
  const [maxSteps, setMaxSteps] = useState(25);
  const [isBreakItEnabled, setIsBreakItEnabled] = useState(false);
  const [faultMode, setFaultMode] = useState<'empty' | 'garbage' | 'timeout' | 'wrong_answer'>('wrong_answer');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const faultConfig: FaultConfig | undefined = isBreakItEnabled
        ? { enabled: true, target_tool: 'web_search', mode: faultMode }
        : undefined;

      const res = await api.createRun(goal, { max_steps: maxSteps }, faultConfig);
      await loadRuns();
      selectRun(res.run_id);
      setView('workspace');
      onClose();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to launch execution. Check backend connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs">
      <div
        className="w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden
          bg-cream-surface border-cream-border text-cream-text
          dark:bg-charcoal-surface dark:border-charcoal-border dark:text-charcoal-text"
      >
        <div className="px-6 py-4 border-b border-cream-border dark:border-charcoal-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-coral/10 text-coral flex items-center justify-center">
              <PlayCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight">New Execution</h3>
              <p className="text-xs text-cream-muted dark:text-charcoal-muted">
                Describe a goal — the Planner breaks it into tasks for your team.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-full text-cream-muted hover:text-cream-text hover:bg-cream-subtle dark:hover:bg-charcoal-subtle transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold">
              Execution Goal
              <InfoTooltip text="Write the question or problem you want your agents to solve. Enabled agents are matched automatically." />
            </label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g., Compare two caching strategies and benchmark latency in Python."
              rows={3}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-coral/30 focus:border-coral
                bg-cream-bg border-cream-border text-cream-text
                dark:bg-charcoal-bg dark:border-charcoal-border dark:text-charcoal-text"
            />
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-cream-muted dark:text-charcoal-muted">
              Try a starter goal
            </span>
            <div className="flex flex-wrap gap-2">
              {SHOWCASE_GOALS.map((sc, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setGoal(sc.goal)}
                  className="px-3 py-1.5 rounded-full border text-xs font-medium transition-colors hover:border-coral hover:text-coral
                    bg-cream-bg border-cream-border dark:bg-charcoal-bg dark:border-charcoal-border"
                >
                  {sc.title}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 py-3 border-y border-cream-border dark:border-charcoal-border">
            <div className="text-xs">
              <span className="font-semibold">
                Step Guardrail Budget
                <InfoTooltip text="Caps the maximum number of agent actions before halting safely." />
              </span>
              <p className="text-[11px] text-cream-muted dark:text-charcoal-muted">
                Prevents runaway loops and keeps execution bounded.
              </p>
            </div>
            <input
              type="number"
              min={5}
              max={100}
              value={maxSteps}
              onChange={(e) => setMaxSteps(Math.max(5, Math.min(100, Number(e.target.value) || 25)))}
              className="w-20 px-2.5 py-1.5 rounded-lg border text-xs font-mono text-right
                bg-cream-bg border-cream-border dark:bg-charcoal-bg dark:border-charcoal-border"
            />
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amberAccent" />
                <span className="text-xs font-semibold">
                  Fault Injection (Break-it Mode)
                  <InfoTooltip text="Intentionally simulates a failing tool response so you can watch the Critic reject it and guide a retry." />
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBreakItEnabled}
                  onChange={(e) => setIsBreakItEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-cream-border dark:bg-charcoal-border rounded-full peer
                  peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                  after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-coral" />
              </label>
            </div>

            {isBreakItEnabled && (
              <div className="pt-1 flex flex-wrap gap-2">
                {(['wrong_answer', 'empty', 'garbage', 'timeout'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setFaultMode(mode)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                      faultMode === mode
                        ? 'border-coral bg-coral/10 text-coral'
                        : 'border-cream-border dark:border-charcoal-border text-cream-muted dark:text-charcoal-muted'
                    }`}
                  >
                    {mode.replace('_', ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-full text-xs font-semibold border border-cream-border dark:border-charcoal-border hover:bg-cream-subtle dark:hover:bg-charcoal-subtle transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !goal.trim()}
              className="h-9 px-5 rounded-full text-xs font-semibold bg-coral hover:bg-coral-hover text-white shadow-sm shadow-coral/25 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Starting…' : 'Start Execution'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
