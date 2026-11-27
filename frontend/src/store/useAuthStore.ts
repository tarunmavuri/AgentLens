import { create } from 'zustand';
import { AuthUser, ApiError, fetchAuthMe } from '../api/client';

interface AuthState {
  user: AuthUser | null;
  initialized: boolean;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  loadSession: () => Promise<void>;
  signOut: () => void;
}

const LOGOUT_URL =
  ((import.meta as any).env?.VITE_CLOUDFLARE_LOGOUT_URL as string | undefined) ||
  '/cdn-cgi/access/logout';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  initialized: false,
  loading: false,
  error: null,

  clearError: () => set({ error: null }),

  loadSession: async () => {
    set({ loading: true, error: null });
    try {
      const user = await fetchAuthMe();
      set({ user, initialized: true, loading: false });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        set({ user: null, initialized: true, loading: false, error: null });
      } else {
        set({
          user: null,
          initialized: true,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to verify Cloudflare Access session.',
        });
      }
    }
  },

  signOut: () => {
    const provider = get().user?.auth_provider;
    set({ user: null, error: null });
    if (provider === 'cloudflare_access') {
      window.location.assign(LOGOUT_URL);
    }
  },
}));
