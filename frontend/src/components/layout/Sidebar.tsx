import React, { useState } from 'react';
import { useAppStore, SettingsTab, ViewType } from '../../store/useAppStore';
import {
  LayoutDashboard,
  PlusCircle,
  Users,
  PlayCircle,
  LayoutTemplate,
  Workflow,
  History,
  BookOpen,
  BarChart3,
  UserCheck,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';

interface SidebarProps {
  onOpenNewRun: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  isActive: (view: ViewType, settingsTab: SettingsTab) => boolean;
  onSelect: () => void;
}

interface NavGroup {
  key: string;
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  onOpenNewRun,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const { currentView, setView, settingsTab, setSettingsTab, setEditingAgent } = useAppStore();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleGroup = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const navigate = (fn: () => void) => {
    fn();
    if (onCloseMobile) onCloseMobile();
  };

  const groups: NavGroup[] = [
    {
      key: 'HOME',
      title: 'HOME',
      items: [
        {
          id: 'overview',
          label: 'Overview',
          hint: 'Dashboard & recent runs',
          icon: <LayoutDashboard className="w-4 h-4" />,
          isActive: (v) => v === 'dashboard',
          onSelect: () => setView('dashboard'),
        },
      ],
    },
    {
      key: 'BUILD',
      title: 'BUILD',
      items: [
        {
          id: 'create-agent',
          label: 'Create Agent',
          hint: 'Configure role, tools & limits',
          icon: <PlusCircle className="w-4 h-4" />,
          isActive: (v) => v === 'builder',
          onSelect: () => {
            setEditingAgent(null);
            setView('builder');
          },
        },
        {
          id: 'agent-workspace',
          label: 'Agent Workspace',
          hint: 'Inspect, test & manage team',
          icon: <Users className="w-4 h-4" />,
          isActive: (v) => v === 'agents',
          onSelect: () => setView('agents'),
        },
      ],
    },
    {
      key: 'EXPERIMENT',
      title: 'EXPERIMENT',
      items: [
        {
          id: 'new-execution',
          label: 'New Execution',
          hint: 'Launch a multi-agent run',
          icon: <PlayCircle className="w-4 h-4" />,
          isActive: () => false,
          onSelect: () => onOpenNewRun(),
        },
        {
          id: 'templates',
          label: 'Templates',
          hint: 'Starter goals, agents & demos',
          icon: <LayoutTemplate className="w-4 h-4" />,
          isActive: (v) => v === 'templates',
          onSelect: () => setView('templates'),
        },
      ],
    },
    {
      key: 'MONITOR',
      title: 'MONITOR',
      items: [
        {
          id: 'live-runs',
          label: 'Live Runs',
          hint: 'Agent graph & real-time events',
          icon: <Workflow className="w-4 h-4" />,
          isActive: (v) => v === 'workspace',
          onSelect: () => setView('workspace'),
        },
        {
          id: 'execution-history',
          label: 'Execution History',
          hint: 'Step-by-step trace replay',
          icon: <History className="w-4 h-4" />,
          isActive: (v) => v === 'history',
          onSelect: () => setView('history'),
        },
      ],
    },
    {
      key: 'LEARN',
      title: 'LEARN',
      items: [
        {
          id: 'concepts',
          label: 'Concepts',
          hint: 'Agentic AI architecture guide',
          icon: <BookOpen className="w-4 h-4" />,
          isActive: (v) => v === 'learn',
          onSelect: () => setView('learn'),
        },
        {
          id: 'evaluations',
          label: 'Evaluations',
          hint: 'Critic scores, tokens & budgets',
          icon: <BarChart3 className="w-4 h-4" />,
          isActive: (v) => v === 'evals',
          onSelect: () => setView('evals'),
        },
      ],
    },
    {
      key: 'SETTINGS',
      title: 'SETTINGS',
      items: [
        {
          id: 'account',
          label: 'Account',
          hint: 'Identity & session details',
          icon: <UserCheck className="w-4 h-4" />,
          isActive: (v, tab) => v === 'settings' && tab === 'account',
          onSelect: () => {
            setSettingsTab('account');
            setView('settings');
          },
        },
        {
          id: 'preferences',
          label: 'Preferences',
          hint: 'Theme, models & guardrails',
          icon: <SlidersHorizontal className="w-4 h-4" />,
          isActive: (v, tab) => v === 'settings' && tab === 'preferences',
          onSelect: () => {
            setSettingsTab('preferences');
            setView('settings');
          },
        },
      ],
    },
  ];

  const content = (
    <div className="flex flex-col h-full justify-between p-3.5 overflow-y-auto">
      <div className="space-y-3.5">
        {groups.map((group) => {
          const isCollapsed = !!collapsed[group.key];
          return (
            <div key={group.key} className="space-y-0.5">
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                aria-expanded={!isCollapsed}
                className="w-full flex items-center justify-between px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase
                  text-cream-muted dark:text-charcoal-muted hover:text-cream-text dark:hover:text-charcoal-text transition-colors"
              >
                <span>{group.title}</span>
                {isCollapsed ? (
                  <ChevronRight className="w-3 h-3 opacity-70" />
                ) : (
                  <ChevronDown className="w-3 h-3 opacity-70" />
                )}
              </button>

              {!isCollapsed && (
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = item.isActive(currentView, settingsTab);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigate(item.onSelect)}
                        title={item.hint}
                        aria-current={active ? 'page' : undefined}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors relative ${
                          active
                            ? 'bg-coral/10 text-coral font-semibold'
                            : 'text-cream-muted dark:text-charcoal-muted hover:bg-cream-subtle/70 dark:hover:bg-charcoal-subtle hover:text-cream-text dark:hover:text-charcoal-text font-medium'
                        }`}
                      >
                        {active && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-coral" />
                        )}
                        <span className={active ? 'text-coral' : ''}>{item.icon}</span>
                        <span className="text-xs truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Editorial footer note without extra box border */}
      <div className="mt-4 pt-3.5 px-2.5 border-t border-cream-border dark:border-charcoal-border space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-statusSuccess animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-cream-text dark:text-charcoal-text">
            Event-Sourced Engine
          </span>
        </div>
        <p className="text-[11px] text-cream-muted dark:text-charcoal-muted leading-snug">
          Steps persist in SQLite before streaming live.
        </p>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className="hidden md:flex w-60 flex-shrink-0 border-r transition-colors duration-200 flex-col
          bg-cream-surface border-cream-border text-cream-text
          dark:bg-charcoal-surface dark:border-charcoal-border dark:text-charcoal-text
          min-h-[calc(100vh-4rem)]"
      >
        {content}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside
            className="relative w-64 max-w-[80vw] h-full border-r flex flex-col z-10
              bg-cream-surface border-cream-border text-cream-text
              dark:bg-charcoal-surface dark:border-charcoal-border dark:text-charcoal-text"
          >
            <div className="h-14 px-4 border-b border-cream-border dark:border-charcoal-border flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-cream-muted dark:text-charcoal-muted">
                Navigation
              </span>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close navigation menu"
                className="p-1.5 rounded-lg hover:bg-cream-subtle dark:hover:bg-charcoal-subtle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0">{content}</div>
          </aside>
        </div>
      )}
    </>
  );
};
