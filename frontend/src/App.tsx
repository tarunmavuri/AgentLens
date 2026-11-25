import React, { useState, useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { NewRunModal } from './components/NewRunModal';
import { WhyModal } from './components/WhyModal';
import { LandingPage } from './pages/LandingPage';
import { LearnPage } from './pages/LearnPage';
import { DashboardPage } from './pages/DashboardPage';
import { LiveWorkspacePage } from './pages/LiveWorkspacePage';
import { AgentsPage } from './pages/AgentsPage';
import { CustomAgentBuilderPage } from './pages/CustomAgentBuilderPage';
import { EvaluationsPage } from './pages/EvaluationsPage';
import { ReplayPage } from './pages/ReplayPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  const { currentView, theme, setTheme, loadRuns, loadConcepts, loadAgents } = useAppStore();
  const [isNewRunModalOpen, setIsNewRunModalOpen] = useState(false);

  useEffect(() => {
    // Sync theme class
    setTheme(theme);
    loadRuns();
    loadConcepts();
    loadAgents();
  }, []);

  const renderCurrentView = () => {
    switch (currentView) {
      case 'landing':
        return <LandingPage />;
      case 'learn':
        return <LearnPage />;
      case 'dashboard':
        return <DashboardPage onOpenNewRun={() => setIsNewRunModalOpen(true)} />;
      case 'workspace':
        return <LiveWorkspacePage />;
      case 'agents':
        return <AgentsPage />;
      case 'builder':
        return <CustomAgentBuilderPage />;
      case 'evals':
        return <EvaluationsPage />;
      case 'history':
        return <ReplayPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage onOpenNewRun={() => setIsNewRunModalOpen(true)} />;
    }
  };

  const isFullPage = currentView === 'landing' || currentView === 'learn';

  return (
    <div className={`min-h-screen transition-colors duration-200 ${theme === 'dark' ? 'dark bg-charcoal-bg text-charcoal-text' : 'light bg-cream-bg text-cream-text'}`}>
      
      {/* Top Navbar */}
      <Navbar onOpenNewRun={() => setIsNewRunModalOpen(true)} />

      {/* Main Container */}
      {isFullPage ? (
        <main>{renderCurrentView()}</main>
      ) : (
        <div className="flex">
          <Sidebar onOpenNewRun={() => setIsNewRunModalOpen(true)} />
          <main className="flex-1 overflow-x-hidden min-h-[calc(100vh-4rem)]">
            {renderCurrentView()}
          </main>
        </div>
      )}

      {/* Shared Modals */}
      <NewRunModal 
        isOpen={isNewRunModalOpen} 
        onClose={() => setIsNewRunModalOpen(false)} 
      />
      <WhyModal />

    </div>
  );
};

