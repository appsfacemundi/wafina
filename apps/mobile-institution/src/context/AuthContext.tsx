import type { AuthenticatedUser } from '@wafina/shared';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
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
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ROLE_LABEL: Record<string, string> = { Donor: 'Doador', Institution: 'Instituição', Admin: 'Admin' };

async function resolveSession(user: FirebaseUser): Promise<AuthenticatedUser> {
  const idToken = await user.getIdToken();
  // role is only honored by the API when bootstrapping a brand-new account —
  // this is the Institution app, so new sign-ups always request the
  // Institution role (spec 13.3: starts Verified=FALSE, full app block).
  const authenticatedUser = await apiFetch<AuthenticatedUser>('/auth/session', {
    method: 'POST',
    body: { idToken, role: 'Institution' },
  });

  // Real-device finding, 2026-08-04: role is fixed on an account's first-ever
  // sign-up across ANY Wafina app and never changes automatically (see
  // requireRole's own comment in the API). Without this check, someone signing
  // into the Institution app with an email already tied to a Donor account got
  // in fine here, then only discovered the mismatch after filling out the
  // entire registration form and hitting submit — with RegisterScreen having
  // no way to back out. Failing fast, right after sign-in, with a message that
  // says exactly what to do, closes both problems at once.
  if (authenticatedUser.role !== 'Institution') {
    throw new ApiError(
      `Este e-mail já está associado a uma conta de ${ROLE_LABEL[authenticatedUser.role] ?? authenticatedUser.role}. Não pode ser utilizado para uma conta de Instituição — utilize outro e-mail.`,
      403,
    );
  }

  return authenticatedUser;
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
