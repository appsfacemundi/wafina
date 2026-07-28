'use client';

import type { Donation } from '@wafina/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { DONATION_STATUS_LABEL, DONATION_STATUS_TONE } from '@/lib/status';

export default function DonationsPage() {
  const session = useRequireSession();
  const { firebaseUser } = useAuth();
  const router = useRouter();
  const [donations, setDonations] = useState<Donation[] | null>(null);
  const [error, setError] = useState('');

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
