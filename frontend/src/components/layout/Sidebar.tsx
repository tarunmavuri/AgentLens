import React from 'react';
import { useAppStore, ViewType } from '../../store/useAppStore';
import { 
  LayoutDashboard, 
  Workflow, 
  Users, 
  PlusCircle, 
  BarChart3, 
  RotateCcw, 
  Settings, 
  Sparkles,
  HelpCircle
} from 'lucide-react';

interface SidebarProps {
  onOpenNewRun: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenNewRun }) => {
  const { currentView, setView } = useAppStore();

  const navItems: { label: string; view: ViewType; icon: React.ReactNode }[] = [
    { label: 'Overview', view: 'dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { label: 'Live Graph', view: 'workspace', icon: <Workflow className="w-4 h-4" /> },
    { label: 'Agent Workspace', view: 'agents', icon: <Users className="w-4 h-4" /> },
    { label: 'Agent Builder', view: 'builder', icon: <PlusCircle className="w-4 h-4" /> },
    { label: 'Evaluations', view: 'evals', icon: <BarChart3 className="w-4 h-4" /> },
    { label: 'Replay & Trace', view: 'history', icon: <RotateCcw className="w-4 h-4" /> },
    { label: 'Settings', view: 'settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <aside className="w-64 flex-shrink-0 border-r transition-colors duration-200 flex flex-col justify-between 
      dark:bg-charcoal-surface dark:border-charcoal-border dark:text-charcoal-text 
      bg-cream-surface border-cream-border text-cream-text min-h-[calc(100vh-4rem)]">
      
      <div className="p-4 space-y-4">
        {/* New Execution Action Pill */}
        <button
          onClick={onOpenNewRun}
          className="w-full py-2.5 px-4 rounded-xl font-medium text-xs tracking-wider uppercase 
            bg-coral hover:bg-coral-hover text-white shadow-md shadow-coral/20 flex items-center justify-center space-x-2 transition-all hover:scale-[1.02]"
        >
          <Sparkles className="w-4 h-4" />
          <span>New Execution</span>
        </button>

        {/* Navigation Section */}
        <div className="space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase dark:text-charcoal-muted text-cream-muted">
            Platform
          </div>
          {navItems.map((item) => {
            const active = currentView === item.view;
            return (
              <button
                key={item.label}
                onClick={() => setView(item.view)}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                  active
                    ? 'dark:bg-charcoal-bg dark:text-coral bg-cream-bg text-coral shadow-sm font-bold'
                    : 'dark:text-charcoal-muted hover:dark:text-charcoal-text hover:dark:bg-charcoal-bg/50 text-cream-muted hover:text-cream-text hover:bg-cream-bg/50'
                }`}
              >
                <span className={active ? 'text-coral' : ''}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Info Pill */}
      <div className="p-4 border-t dark:border-charcoal-border border-cream-border">
        <div className="p-3 rounded-xl dark:bg-charcoal-bg bg-cream-bg border dark:border-charcoal-border border-cream-border">
          <div className="flex items-center space-x-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[11px] font-bold uppercase tracking-wider">Engine Status</span>
          </div>
          <p className="text-[11px] dark:text-charcoal-muted text-cream-muted leading-relaxed">
            FastAPI · Event-Sourced · Gemini 2.5 Flash
          </p>
        </div>
      </div>

    </aside>
  );
};

