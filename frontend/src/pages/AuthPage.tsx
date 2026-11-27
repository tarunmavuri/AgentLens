import React from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { Layers, ShieldCheck, AlertTriangle, RefreshCw } from 'lucide-react';

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
      <div className="w-full max-w-md rounded-2xl border p-8 shadow-xl dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-coral flex items-center justify-center text-white shadow-md shadow-coral/20">
            <Layers className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Cloudflare Access Required</h1>
            <p className="text-xs dark:text-charcoal-muted text-cream-muted">
              Authentication is managed by Cloudflare Zero Trust.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl border dark:border-charcoal-border border-cream-border dark:bg-charcoal-bg/60 bg-cream-bg/60 text-xs space-y-2">
          <div className="flex items-center space-x-2 font-bold text-coral">
            <ShieldCheck className="w-4 h-4" />
            <span>Protected Workspace</span>
          </div>
          <p className="dark:text-charcoal-muted text-cream-muted leading-relaxed">
            Your AgentLens runs, custom agents, and execution traces are isolated to your
            Cloudflare Access identity (<code>Cf-Access-Jwt-Assertion</code> /{' '}
            <code>CF_Authorization</code>).
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleRetry}
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-coral hover:bg-coral-hover text-white shadow-md shadow-coral/20 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Checking Cloudflare session…' : user ? 'Continue to Dashboard' : 'Verify Cloudflare Session'}</span>
        </button>
      </div>
    </div>
  );
};
