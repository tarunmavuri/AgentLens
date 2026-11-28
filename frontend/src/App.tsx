import React, { useState, useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { useAuthStore } from './store/useAuthStore';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { NewRunModal } from './components/NewRunModal';
import { WhyModal } from './components/WhyModal';
import { LandingPage } from './pages/LandingPage';
import { LearnPage } from './pages/LearnPage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { LiveWorkspacePage } from './pages/LiveWorkspacePage';
import { AgentsPage } from './pages/AgentsPage';
import { CustomAgentBuilderPage } from './pages/CustomAgentBuilderPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { EvaluationsPage } from './pages/EvaluationsPage';
import { ReplayPage } from './pages/ReplayPage';
import { SettingsPage } from './pages/SettingsPage';

const PUBLIC_VIEWS = new Set(['landing', 'learn', 'auth']);

export const App: React.FC = () => {
  const {
    currentView,
    setView,
    theme,
    setTheme,
    loadRuns,
    loadConcepts,
    loadAgents,
    clearUserData,
  } = useAppStore();
  const { user, initialized, loadSession } = useAuthStore();
  const [isNewRunModalOpen, setIsNewRunModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setTheme(theme);
    loadConcepts();
    loadSession();
  }, []);

  useEffect(() => {
    if (!initialized) return;
    if (user) {
      loadRuns();
      loadAgents();
      if (currentView === 'auth') {
        setView('dashboard');
      }
    } else {
      clearUserData();
    }
  }, [user, initialized]);

  const handleOpenNewRun = () => {
    if (!user) {
      setView('auth');
      return;
    }
    setIsNewRunModalOpen(true);
  };

  const renderCurrentView = () => {
    if (currentView === 'landing') return <LandingPage />;
    if (currentView === 'learn') return <LearnPage />;
    if (currentView === 'auth') return <AuthPage onSuccess={() => setView('dashboard')} />;

    if (!initialized) {
      return (
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center text-sm text-cream-muted dark:text-charcoal-muted">
          Checking session…
        </div>
      );
    }

    if (!user) {
      return <AuthPage onSuccess={() => setView('dashboard')} />;
    }

    switch (currentView) {
      case 'dashboard':
        return <DashboardPage onOpenNewRun={handleOpenNewRun} />;
      case 'workspace':
        return <LiveWorkspacePage onOpenNewRun={handleOpenNewRun} />;
      case 'agents':
        return <AgentsPage />;
      case 'builder':
        return <CustomAgentBuilderPage />;
      case 'templates':
        return <TemplatesPage />;
      case 'evals':
        return <EvaluationsPage />;
      case 'history':
        return <ReplayPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage onOpenNewRun={handleOpenNewRun} />;
    }
  };

  const isFullPage = PUBLIC_VIEWS.has(currentView) || !user;

  return (
    <div
      className={`min-h-screen transition-colors duration-200 bg-cream-bg text-cream-text dark:bg-charcoal-bg dark:text-charcoal-text ${
        theme === 'dark' ? 'dark' : 'light'
      }`}
    >
      <Navbar
        onOpenNewRun={handleOpenNewRun}
        showMobileMenuButton={!isFullPage}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
      />

      {isFullPage ? (
        <main>{renderCurrentView()}</main>
      ) : (
        <div className="flex">
          <Sidebar
            onOpenNewRun={handleOpenNewRun}
            mobileOpen={mobileMenuOpen}
            onCloseMobile={() => setMobileMenuOpen(false)}
          />
          <main className="flex-1 min-w-0 overflow-x-hidden min-h-[calc(100vh-4rem)]">
            {renderCurrentView()}
          </main>
        </div>
      )}

      {user && (
        <NewRunModal
          isOpen={isNewRunModalOpen}
          onClose={() => setIsNewRunModalOpen(false)}
        />
      )}
      <WhyModal />
    </div>
  );
};
