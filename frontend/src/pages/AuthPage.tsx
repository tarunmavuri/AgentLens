import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { isFirebaseConfigured } from '../lib/firebase';
import { Layers, Mail, Lock, User as UserIcon, AlertTriangle, ArrowRight } from 'lucide-react';

interface AuthPageProps {
  onSuccess?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess }) => {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, loading, error, clearError } =
    useAuthStore();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const ok =
      mode === 'signin'
        ? await signInWithEmail(email, password)
        : await signUpWithEmail(email, password, displayName);
    if (ok && onSuccess) onSuccess();
  };

  const handleGoogle = async () => {
    clearError();
    const ok = await signInWithGoogle();
    if (ok && onSuccess) onSuccess();
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border p-8 shadow-xl dark:bg-charcoal-surface dark:border-charcoal-border bg-cream-surface border-cream-border space-y-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-coral flex items-center justify-center text-white shadow-md shadow-coral/20">
            <Layers className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">
              {mode === 'signin' ? 'Sign in to AgentLens' : 'Create your AgentLens account'}
            </h1>
            <p className="text-xs dark:text-charcoal-muted text-cream-muted">
              {mode === 'signin'
                ? 'Access your private runs, custom agents, and live execution traces.'
                : 'Your runs, custom agents, and evaluation history are isolated to your account.'}
            </p>
          </div>
        </div>

        {!isFirebaseConfigured && (
          <div className="p-4 rounded-xl border border-amberAccent/40 bg-amberAccent/10 text-xs space-y-1">
            <div className="flex items-center space-x-2 font-bold text-amberAccent">
              <AlertTriangle className="w-4 h-4" />
              <span>Firebase client configuration missing</span>
            </div>
            <p className="dark:text-charcoal-muted text-cream-muted">
              Set <code>VITE_FIREBASE_API_KEY</code>, <code>VITE_FIREBASE_AUTH_DOMAIN</code>,{' '}
              <code>VITE_FIREBASE_PROJECT_ID</code>, and <code>VITE_FIREBASE_APP_ID</code> in{' '}
              <code>frontend/.env</code> to enable authentication.
            </p>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">
                Display Name
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3.5 top-3 dark:text-charcoal-muted text-cream-muted" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ada Lovelace"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-coral/40
                    dark:bg-charcoal-bg dark:border-charcoal-border dark:text-charcoal-text
                    bg-cream-bg border-cream-border text-cream-text"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">
              Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-3 dark:text-charcoal-muted text-cream-muted" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-coral/40
                  dark:bg-charcoal-bg dark:border-charcoal-border dark:text-charcoal-text
                  bg-cream-bg border-cream-border text-cream-text"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider dark:text-charcoal-muted text-cream-muted">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3 dark:text-charcoal-muted text-cream-muted" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-coral/40
                  dark:bg-charcoal-bg dark:border-charcoal-border dark:text-charcoal-text
                  bg-cream-bg border-cream-border text-cream-text"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !isFirebaseConfigured}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-coral hover:bg-coral-hover text-white shadow-md shadow-coral/20 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            <span>{loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="relative flex items-center justify-center">
          <div className="border-t w-full dark:border-charcoal-border border-cream-border" />
          <span className="px-3 text-[11px] uppercase tracking-wider font-semibold dark:bg-charcoal-surface bg-cream-surface dark:text-charcoal-muted text-cream-muted">
            or
          </span>
          <div className="border-t w-full dark:border-charcoal-border border-cream-border" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading || !isFirebaseConfigured}
          className="w-full py-2.5 px-4 rounded-xl border font-semibold text-xs flex items-center justify-center space-x-2 transition-all disabled:opacity-50
            dark:bg-charcoal-bg dark:border-charcoal-border dark:hover:bg-charcoal-border/40
            bg-cream-bg border-cream-border hover:bg-cream-border/40"
        >
          <span>Continue with Google</span>
        </button>

        <div className="text-center text-xs dark:text-charcoal-muted text-cream-muted">
          {mode === 'signin' ? (
            <>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  clearError();
                  setMode('signup');
                }}
                className="text-coral font-semibold hover:underline"
              >
                Register
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  clearError();
                  setMode('signin');
                }}
                className="text-coral font-semibold hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
