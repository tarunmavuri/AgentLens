import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { Settings, Shield, Cpu, Database, Palette, CheckCircle2 } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { theme, setTheme } = useAppStore();

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="pb-6 border-b dark:border-charcoal-border border-cream-border">
        <span className="text-[11px] font-bold uppercase tracking-widest text-coral">
          System Preferences
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
          Settings & Environment
        </h1>
        <p className="text-xs sm:text-sm dark:text-charcoal-muted text-cream-muted mt-1">
          Configure visual themes, LLM provider settings, and sandbox parameters.
        </p>
      </div>

      {/* Visual Identity / Theme */}
      <div className="p-6 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-4">
        <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-coral">
          <Palette className="w-4 h-4" />
          <span>Visual Theme Preferences</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            onClick={() => setTheme('dark')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              theme === 'dark' ? 'border-coral ring-2 ring-coral/20' : 'border-neutral-700'
            } bg-[#151217] text-[#F6F0EB]`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm">Deep Charcoal & Plum (Dark)</span>
              {theme === 'dark' && <CheckCircle2 className="w-4 h-4 text-coral" />}
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Deep rich background (#151217) with coral and warm amber highlights.
            </p>
          </div>

          <div
            onClick={() => setTheme('light')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              theme === 'light' ? 'border-coral ring-2 ring-coral/20' : 'border-neutral-300'
            } bg-[#F5F0EA] text-[#1D1919]`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm">Warm Cream & Espresso (Light)</span>
              {theme === 'light' && <CheckCircle2 className="w-4 h-4 text-coral" />}
            </div>
            <p className="text-xs text-neutral-600 mt-1">
              Warm editorial background (#F5F0EA) with coral accents and refined borders.
            </p>
          </div>
        </div>
      </div>

      {/* Backend & Model Settings */}
      <div className="p-6 rounded-2xl border dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-4">
        <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-coral">
          <Cpu className="w-4 h-4" />
          <span>LLM Provider & Orchestration Engine</span>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex justify-between py-2 border-b dark:border-charcoal-border border-cream-border">
            <span className="font-medium">Active Provider:</span>
            <span className="font-mono font-bold">Google Gemini (REST API)</span>
          </div>

          <div className="flex justify-between py-2 border-b dark:border-charcoal-border border-cream-border">
            <span className="font-medium">Default Model:</span>
            <span className="font-mono">gemini-2.5-flash</span>
          </div>

          <div className="flex justify-between py-2 border-b dark:border-charcoal-border border-cream-border">
            <span className="font-medium">Orchestration Framework:</span>
            <span className="font-mono font-bold text-coral">Hand-Rolled State Machine (No LangGraph)</span>
          </div>

          <div className="flex justify-between py-2 border-b dark:border-charcoal-border border-cream-border">
            <span className="font-medium">Database Storage:</span>
            <span className="font-mono">SQLite (agentlens.db)</span>
          </div>

          <div className="flex justify-between py-2">
            <span className="font-medium">Python Sandbox Timeout:</span>
            <span className="font-mono">10 seconds (Isolated Subprocess)</span>
          </div>
        </div>
      </div>

    </div>
  );
};

