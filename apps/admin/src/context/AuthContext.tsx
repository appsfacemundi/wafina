'use client';

import type { AuthenticatedUser } from '@wafina/shared';
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
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
  signOutUser: () => Promise<void>;
  refreshSession: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * No `role` is ever sent here, unlike the Donor/Institution apps — Admin
 * accounts are always provisioned directly (spec 3.1) and can never be
 * self-registered, so there is no bootstrap case to support. If no matching
 * Users row exists yet, /auth/session correctly 400s rather than creating one.
 */
async function resolveSession(user: FirebaseUser): Promise<AuthenticatedUser> {
  const idToken = await user.getIdToken();
  return apiFetch<AuthenticatedUser>('/auth/session', { method: 'POST', body: { idToken } });
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
          // (e.g. account suspended, no matching Admin row, or Sheets briefly
          // unavailable) — without this, the user was silently bounced back
          // to Sign In with no explanation at all. Signing out here avoids
          // leaving them in a half-authenticated state that would just repeat
          // the same failure.
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
      // RC1 audit fix, 2026-08-10 — a stray leading/trailing space in the
      // email field makes Firebase treat it as a different address entirely,
      // failing with the same generic "wrong credentials" error as a real
      // typo — for a real account, indistinguishable from "this account
      // doesn't exist" even though it does.
      const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      try {
        setSession(await resolveSession(credential.user));
      } catch (err) {
        // Rethrown (not just recorded via sessionError) so the Sign In form's
        // own catch block reacts before it ever navigates away — relying only
        // on the onAuthStateChanged listener below lost this race: it resolves
        // asynchronously, after the form had already redirected on the
        // Firebase-login success alone, landing the user with no explanation.
        await signOut(firebaseAuth);
        throw err;
      }
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

/** Redirects to Sign In if not authenticated, or if authenticated as a non-Admin role. */
export function useRequireAdminSession(): AuthenticatedUser | null {
  const { session, loading, signOutUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/sign-in');
    } else if (session.role !== 'Admin') {
      signOutUser();
      router.replace('/sign-in?error=not-admin');
    }
  }, [loading, session, router, signOutUser]);

  return loading || session?.role !== 'Admin' ? null : session;
}
