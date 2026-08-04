import type { AuthenticatedUser } from '@wafina/shared';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { firebaseAuth } from '@/lib/firebase';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  session: AuthenticatedUser | null;
  loading: boolean;
  /** Why the last sign-in attempt didn't reach a session (e.g. suspended account, backend unavailable) — see AuthProvider. */
  sessionError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshSession: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function resolveSession(user: FirebaseUser): Promise<AuthenticatedUser> {
  const idToken = await user.getIdToken();
  // role is only honored by the API when bootstrapping a brand-new account —
  // this is the Donor app, so new sign-ups always request the Donor role.
  return apiFetch<AuthenticatedUser>('/auth/session', {
    method: 'POST',
    body: { idToken, role: 'Donor' },
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [session, setSession] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          setSession(await resolveSession(user));
          setSessionError(null);
        } catch (err) {
          // Firebase login succeeded but the backend rejected the session
          // (e.g. account suspended, or Sheets briefly unavailable). Without
          // this, RootNavigator just never swaps stacks — the sign-in button
          // silently stops spinning with no error and no navigation at all.
          setSession(null);
          setSessionError(err instanceof ApiError ? err.message : 'Não foi possível iniciar sessão. Tente novamente.');
          await signOut(firebaseAuth);
        }
      } else {
        setSession(null);
      }
      setLoading(false);
    });
  }, []);

  const value: AuthContextValue = {
    firebaseUser,
    session,
    loading,
    sessionError,
    async signIn(email, password) {
      setSessionError(null);
      const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      try {
        setSession(await resolveSession(credential.user));
      } catch (err) {
        // Rethrown so SignInScreen's own catch reacts immediately, instead of
        // relying only on the onAuthStateChanged listener above — that path
        // resolves asynchronously and left the screen looking like the button
        // just did nothing.
        await signOut(firebaseAuth);
        throw err;
      }
    },
    async signUp(email, password) {
      await createUserWithEmailAndPassword(firebaseAuth, email, password);
    },
    async signOutUser() {
      await signOut(firebaseAuth);
    },
    async refreshSession() {
      if (firebaseAuth.currentUser) {
        setSession(await resolveSession(firebaseAuth.currentUser));
      }
    },
    async resetPassword(email) {
      await sendPasswordResetEmail(firebaseAuth, email);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
