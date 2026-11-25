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
  BookOpen,
} from 'lucide-react';

interface SidebarProps {
  onOpenNewRun: () => void;
}

interface NavItem {
  label: string;
  hint: string;
  view: ViewType;
  icon: React.ReactNode;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenNewRun }) => {
  const { currentView, setView } = useAppStore();

  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: 'Start here',
      items: [
        {
          label: 'How it works',
          hint: 'Plain-English guide',
          view: 'learn',
          icon: <BookOpen className="w-4 h-4" />,
        },
        {
          label: 'My Runs',
          hint: 'Everything you have asked',
          view: 'dashboard',
          icon: <LayoutDashboard className="w-4 h-4" />,
        },
      ],
    },
    {
      title: 'Watch & understand',
      items: [
        {
          label: 'Watch Live',
          hint: 'See agents working now',
          view: 'workspace',
          icon: <Workflow className="w-4 h-4" />,
        },
        {
          label: 'Replay a Run',
          hint: 'Go back through the steps',
          view: 'history',
          icon: <RotateCcw className="w-4 h-4" />,
        },
        {
          label: 'Scores',
          hint: 'How good the answers were',
          view: 'evals',
          icon: <BarChart3 className="w-4 h-4" />,
        },
      ],
    },
    {
      title: 'Your team',
      items: [
        {
          label: 'Meet the Agents',
          hint: 'Who does what',
          view: 'agents',
          icon: <Users className="w-4 h-4" />,
        },
        {
          label: 'Build an Agent',
          hint: 'Make your own helper',
          view: 'builder',
          icon: <PlusCircle className="w-4 h-4" />,
        },
      ],
    },
  ];

  return (
    <aside className="w-64 flex-shrink-0 border-r transition-colors duration-200 flex flex-col justify-between
      dark:bg-charcoal-surface dark:border-charcoal-border dark:text-charcoal-text
      bg-cream-surface border-cream-border text-cream-text min-h-[calc(100vh-4rem)]">

      <div className="p-4 space-y-5">
        {/* Ask AgentLens */}
        <button
          onClick={onOpenNewRun}
          className="w-full py-3 px-4 rounded-xl font-bold text-xs tracking-wider uppercase
            bg-coral hover:bg-coral-hover text-white shadow-md shadow-coral/20 flex items-center justify-center space-x-2 transition-transform hover:scale-[1.02]"
        >
          <Sparkles className="w-4 h-4" />
          <span>Ask AgentLens</span>
        </button>

        {groups.map((group) => (
          <div key={group.title} className="space-y-1">
            <div className="px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase dark:text-charcoal-muted text-cream-muted">
              {group.title}
            </div>
            {group.items.map((item) => {
              const active = currentView === item.view;
              return (
                <button
                  key={item.label}
                  onClick={() => setView(item.view)}
                  title={item.hint}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                    active
                      ? 'dark:bg-charcoal-bg dark:text-coral bg-cream-bg text-coral shadow-sm'
                      : 'dark:text-charcoal-muted hover:dark:text-charcoal-text hover:dark:bg-charcoal-bg/50 text-cream-muted hover:text-cream-text hover:bg-cream-bg/50'
                  }`}
                >
                  <span className="flex items-center space-x-2.5">
                    <span className={active ? 'text-coral' : ''}>{item.icon}</span>
                    <span className="text-xs font-bold tracking-wide">{item.label}</span>
                  </span>
                  <span className="block pl-[26px] text-[10px] font-medium opacity-70 leading-snug">
                    {item.hint}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom Info Pill */}
      <div className="p-4 border-t dark:border-charcoal-border border-cream-border space-y-2">
        <button
          onClick={() => setView('settings')}
          className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
            currentView === 'settings'
              ? 'bg-coral/10 text-coral'
              : 'dark:text-charcoal-muted hover:dark:text-charcoal-text text-cream-muted hover:text-cream-text'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>

        <div className="p-3 rounded-xl dark:bg-charcoal-bg bg-cream-bg border dark:border-charcoal-border border-cream-border">
          <div className="flex items-center space-x-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[11px] font-bold uppercase tracking-wider">Engine status</span>
          </div>
          <p className="text-[11px] dark:text-charcoal-muted text-cream-muted leading-relaxed">
            Ready. Every step is saved as it happens.
          </p>
        </div>
      </div>

    </aside>
  );
};
