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
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ROLE_LABEL: Record<string, string> = {
  Donor: 'Doador',
  Institution: 'Instituição',
  Admin: 'Admin',
  Animal_Shelter: 'Abrigo de Animais',
};

/**
 * RC1 RECEBER — signUp() only calls Firebase's createUserWithEmailAndPassword,
 * which carries no role field. The actual /auth/session bootstrap call happens
 * later and asynchronously, inside the onAuthStateChanged listener below, once
 * Firebase itself reports the new user. This module-level box is how the role
 * chosen on SignUpScreen survives that gap — set immediately before the
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
  const authenticatedUser = await apiFetch<AuthenticatedUser>('/auth/session', {
    method: 'POST',
    body: { idToken, role: requestedRole },
  });

  // Real-device finding, 2026-08-04: role is fixed on an account's first-ever
  // sign-up across ANY Wafina app and never changes automatically (see
  // requireRole's own comment in the API). Without this check, someone signing
  // into the Institution app with an email already tied to a Donor account got
  // in fine here, then only discovered the mismatch after filling out the
  // entire registration form and hitting submit — with RegisterScreen having
  // no way to back out. Failing fast, right after sign-in, with a message that
  // says exactly what to do, closes both problems at once.
  if (authenticatedUser.role !== 'Institution' && authenticatedUser.role !== 'Animal_Shelter') {
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

  // Real-device finding, 2026-08-08 — Donor and Institution share one Firebase
  // project, and Expo Go doesn't isolate AsyncStorage per project the way two
  // standalone installs would. A session persisted from testing the Donor app
  // on the same phone was auto-restored here on cold launch, tripped the
  // role-mismatch guard in resolveSession, and threw the loud error banner
  // above onto an empty, untouched sign-in screen — before the user had done
  // anything. The guard itself is correct; only the very first auth-state
  // check (the silent cold-launch restore, as opposed to something the user
  // just actively did) should stay quiet and just land on a clean form.
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
      // email field makes Firebase treat it as a different address entirely,
      // failing with the same generic "wrong credentials" error as a real
      // typo — for a real account, indistinguishable from "this account
      // doesn't exist" even though it does. Trimming once here (rather than
      // at every screen's call site) guarantees every caller gets it.
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
    async signUp(email, password, role) {
      pendingSignUpRole = role;
      await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
    },
    async signOutUser() {
      await signOut(firebaseAuth);
    },
    async resetPassword(email) {
      await sendPasswordResetEmail(firebaseAuth, email.trim());
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
