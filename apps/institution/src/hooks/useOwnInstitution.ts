'use client';

import type { Institution } from '@wafina/shared';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';

/** Backs registration/verification-status routing — null means no profile submitted yet. */
export function useOwnInstitution(): {
  institution: Institution | null;
  loading: boolean;
  refetch: () => Promise<void>;
} {
  const { firebaseUser, loading: authLoading } = useAuth();
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchInstitution() {
    if (!firebaseUser) return;
    const idToken = await firebaseUser.getIdToken();
    setInstitution(await apiFetch<Institution | null>('/institutions/me', { idToken }));
  }

  useEffect(() => {
    // Wait for Firebase auth itself to settle first — on first mount firebaseUser
    // is transiently null before onAuthStateChanged fires, and treating that as
    // "signed out" here caused a premature setLoading(false) that page.tsx's
    // redirect effect read before the real institution fetch below had resolved.
    if (authLoading) return;
    if (!firebaseUser) {
      setInstitution(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        await fetchInstitution();
      } catch {
        setInstitution(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [firebaseUser, authLoading]);

  return { institution, loading, refetch: fetchInstitution };
}
