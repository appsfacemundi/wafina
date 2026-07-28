'use client';

import { DONATION_STATUS_LABEL, DONATION_STATUS_TONE, type Donation } from '@wafina/shared';
import { Badge, Button, Card, EmptyState } from '@wafina/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';

export default function ClaimedDonationsPage() {
  const session = useRequireSession();
  const { firebaseUser } = useAuth();
  const router = useRouter();
  const [donations, setDonations] = useState<Donation[] | null>(null);
  const [error, setError] = useState('');
  const [deliveringId, setDeliveringId] = useState<string | null>(null);

  async function load() {
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      setDonations(await apiFetch<Donation[]>('/donations/claimed-by-me', { idToken }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as doações.');
    }
  }

  useEffect(() => {
    load();
  }, [firebaseUser]);

  async function onDeliver(donationId: string) {
    setDeliveringId(donationId);
    setError('');
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/donations/${donationId}/deliver`, { method: 'POST', idToken });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível confirmar a entrega.');
    } finally {
      setDeliveringId(null);
    }
  }

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Reclamadas por Mim</h1>
        {error && <div className="banner banner-error">{error}</div>}
        {!error && donations === null && (
          <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>
        )}
        {donations?.length === 0 && (
          <EmptyState
            title="Ainda sem doações reclamadas"
            description="As doações que reclamar aparecem aqui."
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Badge tone={DONATION_STATUS_TONE[d.Status]}>{DONATION_STATUS_LABEL[d.Status]}</Badge>
                  {d.Status === 'Claimed' && (
                    <Button
                      variant="secondary"
                      onClick={() => onDeliver(d.Donation_ID)}
                      disabled={deliveringId === d.Donation_ID}
                    >
                      {deliveringId === d.Donation_ID ? 'A confirmar…' : 'Confirmar entrega'}
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => router.push(`/disputes/new?donationId=${d.Donation_ID}`)}>
                    Reportar problema
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
