'use client';

import type { Donation } from '@wafina/shared';
import { Button, Card, EmptyState, Input } from '@wafina/ui';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';

export default function AvailableDonationsPage() {
  const session = useRequireSession();
  const { firebaseUser } = useAuth();
  const [donations, setDonations] = useState<Donation[] | null>(null);
  const [error, setError] = useState('');
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!donations) return donations;
    const q = query.trim().toLowerCase();
    if (!q) return donations;
    return donations.filter(
      (d) => d.Item_Type.toLowerCase().includes(q) || d.Condition.toLowerCase().includes(q),
    );
  }, [donations, query]);

  async function load() {
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      setDonations(await apiFetch<Donation[]>('/donations/available', { idToken }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as doações.');
    }
  }

  useEffect(() => {
    load();
  }, [firebaseUser]);

  async function onClaim(donationId: string) {
    setClaimingId(donationId);
    setError('');
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/donations/${donationId}/claim`, { method: 'POST', idToken });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível reclamar a doação.');
    } finally {
      setClaimingId(null);
    }
  }

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Doações Disponíveis</h1>
        {donations && donations.length > 0 && (
          <Input
            label="Filtrar"
            placeholder="Tipo ou estado…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
        {error && <div className="banner banner-error">{error}</div>}
        {!error && donations === null && (
          <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>
        )}
        {donations?.length === 0 && (
          <EmptyState
            title="Sem doações disponíveis"
            description="Quando houver doações pendentes, aparecem aqui."
          />
        )}
        {donations && donations.length > 0 && filtered?.length === 0 && (
          <EmptyState
            title="Sem resultados"
            description="Nenhuma doação corresponde ao filtro."
          />
        )}
        {filtered && filtered.length > 0 && (
          <div className="stack">
            {filtered.map((d) => (
              <Card key={d.Donation_ID} className="donation-row">
                <div>
                  <p style={{ fontWeight: 600 }}>{d.Item_Type}</p>
                  <p className="mono" style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
                    {d.Donation_ID} · Qtd {d.Quantity} · {d.Condition}
                  </p>
                </div>
                <Button onClick={() => onClaim(d.Donation_ID)} disabled={claimingId === d.Donation_ID}>
                  {claimingId === d.Donation_ID ? 'A reclamar…' : 'Reclamar'}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
