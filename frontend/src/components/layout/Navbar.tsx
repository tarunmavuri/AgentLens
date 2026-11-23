import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Moon, Sun, Layers, Plus, Activity, BookOpen, User } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { theme, toggleTheme, currentView, setView, activeRun } = useAppStore();

  return (
    <header className="sticky top-0 z-40 w-full border-b backdrop-blur-md transition-colors duration-200 
      dark:bg-charcoal-bg/90 dark:border-charcoal-border dark:text-charcoal-text 
      bg-cream-bg/90 border-cream-border text-cream-text">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div 
          onClick={() => setView('landing')} 
          className="flex items-center space-x-3 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-coral flex items-center justify-center text-white shadow-md shadow-coral/20 group-hover:scale-105 transition-transform">
            <Layers className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-lg tracking-tight">AgentLens</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full 
                dark:bg-coral/10 dark:text-coral bg-coral/10 text-coral border border-coral/30">
                v1.0
              </span>
            </div>
            <p className="text-[11px] tracking-wide font-medium dark:text-charcoal-muted text-cream-muted hidden sm:block">
              Glass-Box Multi-Agent Orchestration
            </p>
          </div>
        </div>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center space-x-1">
          <button
            onClick={() => setView('landing')}
            className={`px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all ${
              currentView === 'landing'
                ? 'dark:bg-charcoal-surface dark:text-coral bg-cream-surface text-coral shadow-sm'
                : 'dark:text-charcoal-muted hover:dark:text-charcoal-text text-cream-muted hover:text-cream-text'
            }`}
          >
            Product
          </button>
          <button
            onClick={() => setView('dashboard')}
            className={`px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all ${
              currentView === 'dashboard'
                ? 'dark:bg-charcoal-surface dark:text-coral bg-cream-surface text-coral shadow-sm'
                : 'dark:text-charcoal-muted hover:dark:text-charcoal-text text-cream-muted hover:text-cream-text'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setView('workspace')}
            className={`px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all ${
              currentView === 'workspace'
                ? 'dark:bg-charcoal-surface dark:text-coral bg-cream-surface text-coral shadow-sm'
                : 'dark:text-charcoal-muted hover:dark:text-charcoal-text text-cream-muted hover:text-cream-text'
            }`}
          >
            Live Graph
          </button>
          <button
            onClick={() => setView('agents')}
            className={`px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all ${
              currentView === 'agents' || currentView === 'builder'
                ? 'dark:bg-charcoal-surface dark:text-coral bg-cream-surface text-coral shadow-sm'
                : 'dark:text-charcoal-muted hover:dark:text-charcoal-text text-cream-muted hover:text-cream-text'
            }`}
          >
            Custom Agents
          </button>
          <button
            onClick={() => setView('evals')}
            className={`px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all ${
              currentView === 'evals'
                ? 'dark:bg-charcoal-surface dark:text-coral bg-cream-surface text-coral shadow-sm'
                : 'dark:text-charcoal-muted hover:dark:text-charcoal-text text-cream-muted hover:text-cream-text'
            }`}
          >
            Evaluations
          </button>
          <button
            onClick={() => setView('history')}
            className={`px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all ${
              currentView === 'history'
                ? 'dark:bg-charcoal-surface dark:text-coral bg-cream-surface text-coral shadow-sm'
                : 'dark:text-charcoal-muted hover:dark:text-charcoal-text text-cream-muted hover:text-cream-text'
            }`}
          >
            History & Replay
          </button>
        </nav>

        {/* Right Controls */}
        <div className="flex items-center space-x-3">
          
          {/* Theme Switcher Toggle matching Screenshot */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all 
              dark:bg-charcoal-surface dark:hover:bg-charcoal-border dark:text-amberAccent
              bg-cream-surface hover:bg-cream-border text-coral border dark:border-charcoal-border border-cream-border shadow-sm"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* User profile avatar pill */}
          <div className="flex items-center space-x-2 px-2.5 py-1 rounded-full border dark:border-charcoal-border border-cream-border dark:bg-charcoal-surface bg-cream-surface">
            <div className="w-6 h-6 rounded-full bg-coral/20 text-coral flex items-center justify-center text-xs font-bold">
              M
            </div>
            <span className="text-xs font-semibold tracking-wider uppercase hidden sm:inline">
              MAVURI
            </span>
          </div>

          {/* Explore / New Execution CTA */}
          <button
            onClick={() => {
              if (currentView === 'landing') setView('dashboard');
              else setView('workspace');
            }}
            className="px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider 
              bg-coral hover:bg-coral-hover text-white shadow-md shadow-coral/20 transition-all hover:scale-102 flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Launch Run</span>
          </button>
        </div>

      </div>
    </header>
  );
};

