import { create } from 'zustand';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../lib/firebase';

interface AuthState {
  user: User | null;
  initialized: boolean;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  initAuthListener: () => () => void;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
}

function formatAuthError(err: unknown): string {
  const code = (err as any)?.code as string | undefined;
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before completing.';
    case 'auth/network-request-failed':
      return 'Network error while contacting Firebase Authentication.';
    default:
      return err instanceof Error ? err.message : 'Authentication failed.';
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  initialized: !isFirebaseConfigured,
  loading: false,
  error: null,

  clearError: () => set({ error: null }),

  initAuthListener: () => {
    if (!auth) {
      set({ user: null, initialized: true });
      return () => {};
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      set({ user, initialized: true });
    });
    return unsubscribe;
  },

  signInWithEmail: async (email, password) => {
    if (!auth) {
      set({ error: 'Firebase Authentication is not configured.' });
      return false;
    }
    set({ loading: true, error: null });
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      set({ loading: false });
      return true;
    } catch (err) {
      set({ loading: false, error: formatAuthError(err) });
      return false;
    }
  },

  signUpWithEmail: async (email, password, displayName) => {
    if (!auth) {
      set({ error: 'Firebase Authentication is not configured.' });
      return false;
    }
    set({ loading: true, error: null });
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (displayName?.trim()) {
        await updateProfile(cred.user, { displayName: displayName.trim() });
        set({ user: { ...cred.user, displayName: displayName.trim() } as User });
      }
      set({ loading: false });
      return true;
    } catch (err) {
      set({ loading: false, error: formatAuthError(err) });
      return false;
    }
  },

  signInWithGoogle: async () => {
    if (!auth || !googleProvider) {
      set({ error: 'Firebase Google Sign-In is not configured.' });
      return false;
    }
    set({ loading: true, error: null });
    try {
      await signInWithPopup(auth, googleProvider);
      set({ loading: false });
      return true;
    } catch (err) {
      set({ loading: false, error: formatAuthError(err) });
      return false;
    }
  },

  signOut: async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
    set({ user: null, error: null });
  },

  getIdToken: async (forceRefresh = false) => {
    const currentUser = auth?.currentUser ?? get().user;
    if (!currentUser) return null;
    try {
      return await currentUser.getIdToken(forceRefresh);
    } catch {
      return null;
    }
  },
}));
