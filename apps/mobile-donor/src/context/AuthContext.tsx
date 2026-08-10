import type { AuthenticatedUser } from '@wafina/shared';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
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

  // Real-device finding, 2026-08-08 (mirrors the same fix in the Institution
  // app) — a cold-launch auto-restore of a persisted Firebase session can
  // fail for reasons that have nothing to do with anything the user just did
  // (e.g. a brief Sheets hiccup, or — under Expo Go, where storage isn't
  // isolated per project — a session left over from testing another Wafina
  // app on the same phone). Only the very first auth-state check is that
  // silent cold-launch restore; anything after it reflects something the
  // user actively just did, so only that later case should show the banner.
  const isInitialCheck = useRef(true);

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, async (user) => {
      const isInitial = isInitialCheck.current;
      isInitialCheck.current = false;
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
          if (!isInitial) {
            setSessionError(err instanceof ApiError ? err.message : 'Não foi possível iniciar sessão. Tente novamente.');
          }
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
      // RC1 audit fix, 2026-08-10 — a stray leading/trailing space in the
      // email field (easy to pick up from autocomplete/autocorrect on a phone
      // keyboard) makes Firebase treat it as a different address entirely,
      // failing with the same generic "wrong credentials" error as a real
      // typo — for a real account, indistinguishable from "this account
      // doesn't exist" even though it does. resetPassword below already
      // trimmed; signIn/signUp never did — inconsistent within this same
      // file. Trimming once here (rather than at every screen's call site)
      // guarantees every caller gets it, not just the ones that remember.
      const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
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
      await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
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
      await sendPasswordResetEmail(firebaseAuth, email.trim());
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
