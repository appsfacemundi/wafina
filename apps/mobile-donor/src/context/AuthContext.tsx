import type { AuthenticatedUser } from '@wafina/shared';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiFetch } from '@/lib/api';
import { firebaseAuth } from '@/lib/firebase';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  session: AuthenticatedUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshSession: () => Promise<void>;
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

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          setSession(await resolveSession(user));
        } catch {
          setSession(null);
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
    async signIn(email, password) {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
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
