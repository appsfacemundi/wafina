'use client';

import { DONATION_STATUS_LABEL, DONATION_STATUS_TONE, type Donation } from '@wafina/shared';
import { Badge, Button, Card, EmptyState } from '@wafina/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';

export default function DonationsPage() {
  const session = useRequireSession();
  const { firebaseUser } = useAuth();
  const router = useRouter();
  const [donations, setDonations] = useState<Donation[] | null>(null);
  const [error, setError] = useState('');

  const stats = useMemo(() => {
    if (!donations) return null;
    return {
      total: donations.length,
      quantity: donations.reduce((sum, d) => sum + d.Quantity, 0),
      pending: donations.filter((d) => d.Status === 'Pending').length,
      claimed: donations.filter((d) => d.Status === 'Claimed').length,
      delivered: donations.filter((d) => d.Status === 'Delivered').length,
    };
  }, [donations]);

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        setDonations(await apiFetch<Donation[]>('/donations/mine', { idToken }));
      } catch {
        setError('Não foi possível carregar as suas doações.');
      }
    })();
  }, [firebaseUser]);

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Minhas Doações</h1>
        {session.corporateAccountId && stats && (
          <div className="stats-grid">
            <Card className="stack">
              <p style={{ fontSize: 28, fontWeight: 700 }}>{stats.total}</p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Doações da empresa</p>
            </Card>
            <Card className="stack">
              <p style={{ fontSize: 28, fontWeight: 700 }}>{stats.quantity}</p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Itens doados (total)</p>
            </Card>
            <Card className="stack">
              <p style={{ fontSize: 28, fontWeight: 700 }}>{stats.pending}</p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Pendentes</p>
            </Card>
            <Card className="stack">
              <p style={{ fontSize: 28, fontWeight: 700 }}>{stats.claimed}</p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Reclamadas</p>
            </Card>
            <Card className="stack">
              <p style={{ fontSize: 28, fontWeight: 700 }}>{stats.delivered}</p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Entregues</p>
            </Card>
          </div>
        )}
        {error && <div className="banner banner-error">{error}</div>}
        {!error && donations === null && (
          <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>
        )}
        {donations?.length === 0 && (
          <EmptyState
            title="Ainda sem doações"
            description="Quando submeter uma doação, o estado dela aparece aqui."
            action={
              <Button onClick={() => router.push('/donations/new')}>Fazer a primeira doação</Button>
            }
          />
        )}
        {donations && donations.length > 0 && (
          <div className="stack">
            {donations.map((d) => (
              <Card key={d.Donation_ID} className="donation-row">
                <div>
                  <p style={{ fontWeight: 600 }}>{d.Item_Type}</p>
                  <p className="mono" style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
                    {d.Donation_ID} · Qtd {d.Quantity}
                  </p>
                </div>
                <Badge tone={DONATION_STATUS_TONE[d.Status]}>
                  {DONATION_STATUS_LABEL[d.Status]}
                </Badge>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
