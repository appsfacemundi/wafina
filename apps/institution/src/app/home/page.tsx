'use client';

import type { Donation } from '@wafina/shared';
import { Card } from '@wafina/ui';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { useOwnInstitution } from '@/hooks/useOwnInstitution';
import { apiFetch } from '@/lib/api';

export default function HomePage() {
  const session = useRequireSession();
  const { firebaseUser } = useAuth();
  const { institution } = useOwnInstitution();
  const [donations, setDonations] = useState<Donation[] | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        setDonations(await apiFetch<Donation[]>('/donations/claimed-by-me', { idToken }));
      } catch {
        setDonations(null);
      }
    })();
  }, [firebaseUser]);

  const stats = useMemo(() => {
    if (!donations) return null;
    return {
      claimed: donations.filter((d) => d.Status === 'Claimed').length,
      delivered: donations.filter((d) => d.Status === 'Delivered').length,
    };
  }, [donations]);

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Bem-vindo(a){institution ? `, ${institution.Name}` : ''}</h1>
        <Card className="stack">
          <p style={{ color: 'var(--color-text-muted)' }}>{session.email}</p>
        </Card>

        <div className="stats-grid">
          <Card className="stack">
            <p style={{ fontSize: 28, fontWeight: 700 }}>{institution?.Total_Items_Received ?? '—'}</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Itens recebidos (total)</p>
          </Card>
          <Card className="stack">
            <p style={{ fontSize: 28, fontWeight: 700 }}>{stats ? stats.claimed : '—'}</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Aceites por entregar</p>
          </Card>
          <Card className="stack">
            <p style={{ fontSize: 28, fontWeight: 700 }}>{stats ? stats.delivered : '—'}</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Doações entregues</p>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
