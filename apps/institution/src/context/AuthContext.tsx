'use client';

import type { AuthenticatedUser } from '@wafina/shared';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { firebaseAuth } from '@/lib/firebase';

/** This app now hosts two registrable roles (RC1 RECEBER: Instituição vs Abrigo de Animais). */
type InstitutionAppRole = 'Institution' | 'Animal_Shelter';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  session: AuthenticatedUser | null;
  loading: boolean;
  /** Why the last sign-in attempt didn't reach a session (e.g. suspended account, backend unavailable) — see AuthProvider. */
  sessionError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, role: InstitutionAppRole) => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * RC1 RECEBER — signUp() only calls Firebase's createUserWithEmailAndPassword,
 * which carries no role field. The actual /auth/session bootstrap call happens
 * later and asynchronously, inside the onAuthStateChanged listener below, once
 * Firebase itself reports the new user. This module-level box is how the role
 * chosen on the sign-up form survives that gap — set immediately before the
 * Firebase call, read (and cleared) the first time resolveSession runs.
 */
let pendingSignUpRole: InstitutionAppRole | null = null;

async function resolveSession(user: FirebaseUser): Promise<AuthenticatedUser> {
  const idToken = await user.getIdToken();
  // role is only honored by the API when bootstrapping a brand-new account.
  // Defaults to Institution for sign-in / session-refresh calls, where no
  // pending choice exists and the field is ignored by the API anyway.
  const requestedRole = pendingSignUpRole ?? 'Institution';
  pendingSignUpRole = null;
  return apiFetch<AuthenticatedUser>('/auth/session', {
    method: 'POST',
    body: { idToken, role: requestedRole },
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
          // (e.g. account suspended, or Sheets briefly unavailable) — without
          // this, the user was silently bounced back to Sign In with no
          // explanation at all. Signing out here avoids leaving them in a
          // half-authenticated state that would just repeat the same failure.
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
        // Firebase-login success alone, landing the user on the logged-out
        // Welcome screen with no explanation.
        await signOut(firebaseAuth);
        throw err;
      }
    },
    async signUp(email, password, role) {
      pendingSignUpRole = role;
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

/** Redirects to Sign In if not authenticated. Returns null while that's in flight. */
export function useRequireSession(): AuthenticatedUser | null {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) router.replace('/sign-in');
  }, [loading, session, router]);

  return loading ? null : session;
}
