import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { X, Sparkles, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';
import * as api from '../api/client';
import { FaultConfig } from '../types';

interface NewRunModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHOWCASE_GOALS = [
  {
    title: "RAG vs Fine-Tuning Customer Support",
    goal: "Compare RAG vs fine-tuning for a customer-support bot and back it up with a small code experiment"
  },
  {
    title: "10,000 Item Sorting Benchmark",
    goal: "Benchmark three sorting algorithms on 10,000 items and explain the timings"
  },
  {
    title: "LLM Agent Evaluation Survey",
    goal: "Summarise 3 recent approaches to evaluating LLM agents, with sources"
  }
];

export const NewRunModal: React.FC<NewRunModalProps> = ({ isOpen, onClose }) => {
  const { loadRuns, selectRun, setView } = useAppStore();
  const [goal, setGoal] = useState('');
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

      const res = await api.createRun(goal, { max_steps: 25 }, faultConfig);
      await loadRuns();
      selectRun(res.run_id);
      setView('workspace');
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to launch execution. Please check your backend connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border dark:text-charcoal-text bg-cream-surface border-cream-border text-cream-text shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b dark:border-charcoal-border border-cream-border flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-coral/10 text-coral flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight">What should the team work on?</h3>
              <p className="text-xs dark:text-charcoal-muted text-cream-muted">
                Describe it in one sentence — the Planner splits it into jobs for you.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Goal Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider dark:text-charcoal-text text-cream-text">
              Your question
            </label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="For example: compare two ways to build a support chatbot, and run a small test to see which is cheaper."
              rows={3}
              required
              className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-coral/40
                dark:bg-charcoal-bg dark:border-charcoal-border dark:text-charcoal-text 
                bg-cream-bg border-cream-border text-cream-text"
            />
          </div>

          {/* Quick Showcase Templates */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold tracking-wider uppercase dark:text-charcoal-muted text-cream-muted">
              Or try an example:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SHOWCASE_GOALS.map((sc, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setGoal(sc.goal)}
                  className="p-2.5 rounded-lg border text-left text-xs font-medium transition-all hover:border-coral 
                    dark:bg-charcoal-bg dark:border-charcoal-border dark:hover:bg-charcoal-border/50
                    bg-cream-bg border-cream-border hover:bg-cream-border/50"
                >
                  <p className="font-semibold line-clamp-1">{sc.title}</p>
                  <p className="text-[10px] dark:text-charcoal-muted text-cream-muted line-clamp-2 mt-0.5">
                    {sc.goal}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Break-It Fault Injection Section */}
          <div className="p-4 rounded-xl border dark:border-amber-500/30 border-amber-500/20 dark:bg-amber-500/5 bg-amber-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amberAccent" />
                <span className="text-xs font-bold uppercase tracking-wider text-amberAccent">
                  Break-it mode (optional)
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBreakItEnabled}
                  onChange={(e) => setIsBreakItEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-neutral-300 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 
                  peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] 
                  after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 
                  after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-coral"></div>
              </label>
            </div>

            {isBreakItEnabled && (
              <div className="pt-2 border-t dark:border-amber-500/20 border-amber-500/10 space-y-2">
                <p className="text-[11px] dark:text-charcoal-muted text-cream-muted">
                  Fake a problem on purpose and watch the Critic catch it and send the work back.
                  Leave this off for a normal run.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['wrong_answer', 'empty', 'garbage', 'timeout'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setFaultMode(mode)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold capitalize border transition-all ${
                        faultMode === mode
                          ? 'border-coral bg-coral/10 text-coral font-bold'
                          : 'dark:border-charcoal-border border-cream-border dark:text-charcoal-muted text-cream-muted'
                      }`}
                    >
                      {mode === 'wrong_answer' ? 'a wrong answer' : mode}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider 
                dark:hover:bg-charcoal-bg hover:bg-cream-bg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !goal.trim()}
              className="px-6 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider 
                bg-coral hover:bg-coral-hover text-white shadow-md shadow-coral/20 transition-all hover:scale-102 disabled:opacity-50"
            >
              {isSubmitting ? 'Starting…' : 'Ask the team'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

