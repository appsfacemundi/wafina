import type { Institution } from '@wafina/shared';
import { useCallback, useEffect, useState } from 'react';
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

  const fetchInstitution = useCallback(async () => {
    if (!firebaseUser) {
      setInstitution(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const idToken = await firebaseUser.getIdToken();
      setInstitution(await apiFetch<Institution | null>('/institutions/me', { idToken }));
    } catch {
      setInstitution(null);
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    // Wait for Firebase auth itself to settle first — on first mount firebaseUser
    // is transiently null before onAuthStateChanged fires, and treating that as
    // "signed out" here would cause a premature setLoading(false) that routing
    // logic could read before the real institution fetch below has resolved.
    if (authLoading) return;
    fetchInstitution();
  }, [authLoading, fetchInstitution]);

  return { institution, loading, refetch: fetchInstitution };
}
