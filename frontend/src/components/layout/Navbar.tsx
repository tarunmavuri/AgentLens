import React from 'react';
import { useAppStore, ViewType } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Moon, Sun, Layers, Plus, BookOpen, LogOut, LogIn } from 'lucide-react';

interface NavbarProps {
  onOpenNewRun: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenNewRun }) => {
  const { theme, toggleTheme, currentView, setView, clearUserData } = useAppStore();
  const { user, signOut } = useAuthStore();

  const userLabel = user?.name || user?.email?.split('@')[0] || user?.uid || 'Account';
  const userInitial = userLabel.charAt(0).toUpperCase();

  const handleSignOut = () => {
    signOut();
    clearUserData();
    setView('landing');
  };

  const links: { label: string; view: ViewType; matches: ViewType[] }[] = [
    { label: 'Home', view: 'landing', matches: ['landing'] },
    { label: 'How it works', view: 'learn', matches: ['learn'] },
    { label: 'My Runs', view: 'dashboard', matches: ['dashboard'] },
    { label: 'Watch Live', view: 'workspace', matches: ['workspace'] },
    { label: 'Agents', view: 'agents', matches: ['agents', 'builder'] },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b backdrop-blur-md transition-colors duration-200
      dark:bg-charcoal-bg/90 dark:border-charcoal-border dark:text-charcoal-text
      bg-cream-bg/90 border-cream-border text-cream-text">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

        {/* Brand */}
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
              Watch AI agents work, step by step
            </p>
          </div>
        </div>

        {/* Centre links — deliberately short so the first visit is not overwhelming */}
        <nav className="hidden md:flex items-center space-x-1">
          {links.map((link) => {
            const active = link.matches.includes(currentView);
            return (
              <button
                key={link.label}
                onClick={() => setView(link.view)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  active
                    ? 'dark:bg-charcoal-surface dark:text-coral bg-cream-surface text-coral shadow-sm'
                    : 'dark:text-charcoal-muted hover:dark:text-charcoal-text text-cream-muted hover:text-cream-text'
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Mobile navigation */}
        <select
          aria-label="Navigate"
          value={currentView}
          onChange={(event) => setView(event.target.value as ViewType)}
          className="md:hidden ml-auto mr-2 px-2 py-1.5 rounded-lg border text-[11px] font-semibold dark:bg-charcoal-surface dark:border-charcoal-border dark:text-charcoal-text bg-cream-surface border-cream-border text-cream-text max-w-[9rem]"
        >
          <option value="landing">Home</option>
          <option value="learn">How it works</option>
          <option value="dashboard">My Runs</option>
          <option value="workspace">Watch Live</option>
          <option value="agents">Meet the Agents</option>
          <option value="builder">Build an Agent</option>
          <option value="evals">Scores</option>
          <option value="history">Replay a Run</option>
          <option value="settings">Settings</option>
        </select>

        {/* Right controls */}
        <div className="flex items-center space-x-3">

          <button
            onClick={toggleTheme}
            aria-label="Toggle light or dark theme"
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all
              dark:bg-charcoal-surface dark:hover:bg-charcoal-border dark:text-amberAccent
              bg-cream-surface hover:bg-cream-border text-coral border dark:border-charcoal-border border-cream-border shadow-sm"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {user ? (
            <div className="flex items-center space-x-2">
              <div
                title={user.email || userLabel}
                className="hidden lg:flex items-center space-x-2 px-2.5 py-1 rounded-full border dark:border-charcoal-border border-cream-border dark:bg-charcoal-surface bg-cream-surface"
              >
                <div className="w-6 h-6 rounded-full bg-coral/20 text-coral flex items-center justify-center text-xs font-bold">
                  {userInitial}
                </div>
                <span className="text-xs font-semibold max-w-[8rem] truncate">{userLabel}</span>
              </div>
              {user.auth_provider === 'cloudflare_access' ? (
                <button
                  onClick={handleSignOut}
                  title="Sign out of Cloudflare Access"
                  aria-label="Sign out"
                  className="px-3 py-2 rounded-full border text-xs font-semibold flex items-center space-x-1.5 transition-all
                    dark:bg-charcoal-surface dark:border-charcoal-border dark:hover:bg-charcoal-border/60
                    bg-cream-surface border-cream-border hover:bg-cream-border/60"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              ) : (
                <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border dark:border-charcoal-border border-cream-border dark:text-charcoal-muted text-cream-muted">
                  Local Dev
                </span>
              )}
            </div>
          ) : (
            <button
              onClick={() => setView('auth')}
              className="px-3.5 py-2 rounded-full border text-xs font-semibold flex items-center space-x-1.5 transition-all
                dark:bg-charcoal-surface dark:border-charcoal-border dark:hover:bg-charcoal-border/60
                bg-cream-surface border-cream-border hover:bg-cream-border/60"
            >
              <LogIn className="w-3.5 h-3.5 text-coral" />
              <span>Sign in</span>
            </button>
          )}

          <button
            onClick={() => (currentView === 'landing' ? setView('learn') : onOpenNewRun())}
            className="hidden sm:flex px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider
              bg-coral hover:bg-coral-hover text-white shadow-md shadow-coral/20 transition-all hover:scale-105 items-center space-x-1.5"
          >
            {currentView === 'landing' ? (
              <>
                <BookOpen className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>See how it works</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Ask AgentLens</span>
              </>
            )}
          </button>
        </div>

      </div>
    </header>
  );
};
