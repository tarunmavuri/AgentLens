import React from 'react';
import { useAppStore, ViewType } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { AgentLensLogo } from '../brand/AgentLensLogo';
import { Moon, Sun, Plus, BookOpen, LogOut, LogIn, Menu } from 'lucide-react';

interface NavbarProps {
  onOpenNewRun: () => void;
  onOpenMobileMenu?: () => void;
  showMobileMenuButton?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenNewRun,
  onOpenMobileMenu,
  showMobileMenuButton = false,
}) => {
  const { theme, toggleTheme, currentView, setView, setSettingsTab, clearUserData } = useAppStore();
  const { user, signOut } = useAuthStore();

  const userLabel = user?.name || user?.email?.split('@')[0] || user?.uid || 'Account';
  const userInitial = userLabel.charAt(0).toUpperCase();

  const handleSignOut = () => {
    signOut();
    clearUserData();
    setView('landing');
  };

  const links: { label: string; view: ViewType; matches: ViewType[] }[] = [
    { label: 'Overview', view: 'dashboard', matches: ['dashboard'] },
    { label: 'Live Runs', view: 'workspace', matches: ['workspace'] },
    { label: 'Agents', view: 'agents', matches: ['agents', 'builder'] },
    { label: 'Templates', view: 'templates', matches: ['templates'] },
    { label: 'Concepts', view: 'learn', matches: ['learn'] },
  ];

  return (
    <header
      className="sticky top-0 z-40 w-full border-b transition-colors duration-200
        bg-cream-bg/92 border-cream-border text-cream-text backdrop-blur-md
        dark:bg-charcoal-bg/92 dark:border-charcoal-border dark:text-charcoal-text"
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {showMobileMenuButton && onOpenMobileMenu && (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              aria-label="Open navigation menu"
              className="md:hidden h-9 w-9 rounded-full border flex items-center justify-center transition-colors
                border-cream-border bg-cream-surface hover:bg-cream-subtle
                dark:border-charcoal-border dark:bg-charcoal-surface dark:hover:bg-charcoal-subtle"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setView('landing')}
            className="text-left focus:outline-none rounded-lg"
          >
            <AgentLensLogo size={34} subtitle="Watch AI agents think in the open" />
          </button>
        </div>

        {/* Clean underline nav links */}
        <nav className="hidden lg:flex items-center space-x-1" aria-label="Primary navigation">
          {links.map((link) => {
            const active = link.matches.includes(currentView);
            return (
              <button
                key={link.label}
                type="button"
                onClick={() => setView(link.view)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                  active
                    ? 'text-coral bg-coral/10'
                    : 'text-cream-muted dark:text-charcoal-muted hover:text-cream-text dark:hover:text-charcoal-text'
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle light or dark theme"
            title={theme === 'dark' ? 'Switch to warm cream theme' : 'Switch to charcoal dark theme'}
            className="w-9 h-9 rounded-full flex items-center justify-center border transition-colors
              bg-cream-surface border-cream-border text-coral hover:bg-cream-subtle
              dark:bg-charcoal-surface dark:border-charcoal-border dark:text-amberAccent dark:hover:bg-charcoal-subtle"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSettingsTab('account');
                  setView('settings');
                }}
                title={user.email || userLabel}
                className="hidden sm:flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full border transition-colors
                  bg-cream-surface border-cream-border hover:bg-cream-subtle
                  dark:bg-charcoal-surface dark:border-charcoal-border dark:hover:bg-charcoal-subtle"
              >
                <div className="w-6 h-6 rounded-full bg-coral/15 text-coral flex items-center justify-center text-[11px] font-bold">
                  {userInitial}
                </div>
                <span className="text-xs font-semibold max-w-[7.5rem] truncate">{userLabel}</span>
              </button>

              {user.auth_provider === 'cloudflare_access' && (
                <button
                  type="button"
                  onClick={handleSignOut}
                  title="Sign out of Cloudflare Access"
                  aria-label="Sign out"
                  className="h-9 px-3 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-colors
                    bg-cream-surface border-cream-border hover:bg-cream-subtle
                    dark:bg-charcoal-surface dark:border-charcoal-border dark:hover:bg-charcoal-subtle"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setView('auth')}
              className="h-9 px-3.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-colors
                bg-cream-surface border-cream-border hover:bg-cream-subtle
                dark:bg-charcoal-surface dark:border-charcoal-border dark:hover:bg-charcoal-subtle"
            >
              <LogIn className="w-3.5 h-3.5 text-coral" />
              <span>Sign in</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => (currentView === 'landing' ? setView('learn') : onOpenNewRun())}
            className="h-9 px-4 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors
              bg-coral hover:bg-coral-hover text-white shadow-sm shadow-coral/25"
          >
            {currentView === 'landing' ? (
              <>
                <BookOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Concepts</span>
                <span className="sm:hidden">Learn</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Execution</span>
                <span className="sm:hidden">Run</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
