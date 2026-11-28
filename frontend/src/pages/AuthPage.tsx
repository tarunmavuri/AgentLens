import React from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { AgentLensLogo } from '../components/brand/AgentLensLogo';
import { ShieldCheck, AlertTriangle, RefreshCw } from 'lucide-react';

interface AuthPageProps {
  onSuccess?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess }) => {
  const { loadSession, loading, error, user } = useAuthStore();

  const handleRetry = async () => {
    await loadSession();
    if (useAuthStore.getState().user && onSuccess) {
      onSuccess();
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div
        className="w-full max-w-md rounded-2xl border p-8 shadow-sm
          bg-cream-surface border-cream-border text-cream-text
          dark:bg-charcoal-surface dark:border-charcoal-border dark:text-charcoal-text space-y-6"
      >
        <div className="space-y-3">
          <AgentLensLogo size={38} />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Cloudflare Access Required</h1>
            <p className="text-xs text-cream-muted dark:text-charcoal-muted mt-1">
              Workspace access is protected by Cloudflare Zero Trust authentication.
            </p>
          </div>
        </div>

        <div className="py-3 border-y border-cream-border dark:border-charcoal-border text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-semibold text-amberAccent">
            <ShieldCheck className="w-4 h-4" />
            <span>Isolated User Workspace</span>
          </div>
          <p className="text-cream-muted dark:text-charcoal-muted leading-relaxed">
            Your executions, custom agents, and event traces belong exclusively to your verified
            session (<code className="font-mono">Cf-Access-Jwt-Assertion</code> /{' '}
            <code className="font-mono">CF_Authorization</code>).
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl border border-statusError/30 bg-statusError/10 text-statusError text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleRetry}
          disabled={loading}
          className="w-full h-10 px-4 rounded-full font-semibold text-xs bg-coral hover:bg-coral-hover text-white shadow-sm shadow-coral/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>
            {loading
              ? 'Checking session…'
              : user
                ? 'Continue to Overview'
                : 'Verify Cloudflare Session'}
          </span>
        </button>
      </div>
    </div>
  );
};
