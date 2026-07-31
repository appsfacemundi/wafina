'use client';

import type { AdminDashboardStats } from '@wafina/shared';
import { Card } from '@wafina/ui';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireAdminSession } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';

export default function AdminHomePage() {
  const session = useRequireAdminSession();
  const { firebaseUser } = useAuth();
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        setStats(await apiFetch<AdminDashboardStats>('/admin/stats', { idToken }));
      } catch {
        setError('Não foi possível carregar as estatísticas.');
      }
    })();
  }, [firebaseUser]);

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Bem-vindo(a)</h1>
        <Card className="stack">
          <p style={{ color: 'var(--color-text-muted)' }}>{session.email}</p>
        </Card>

        {error && <div className="banner banner-error">{error}</div>}

        <div className="stats-grid">
          <Card className="stack">
            <p style={{ fontSize: 28, fontWeight: 700 }}>{stats?.pendingInstitutions ?? '—'}</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Instituições pendentes</p>
          </Card>
          <Card className="stack">
            <p style={{ fontSize: 28, fontWeight: 700 }}>{stats?.verifiedInstitutions ?? '—'}</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Instituições verificadas</p>
          </Card>
          <Card className="stack">
            <p style={{ fontSize: 28, fontWeight: 700 }}>{stats?.inFlightDonations ?? '—'}</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Doações em curso</p>
          </Card>
          <Card className="stack">
            <p style={{ fontSize: 28, fontWeight: 700 }}>{stats?.pendingSuccessStories ?? '—'}</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Histórias por rever</p>
          </Card>
          <Card className="stack">
            <p style={{ fontSize: 28, fontWeight: 700 }}>{stats?.pendingChangeRequests ?? '—'}</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Pedidos de alteração por rever</p>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
