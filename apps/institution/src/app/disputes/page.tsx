'use client';

import type { Dispute, InstitutionDonationView } from '@wafina/shared';
import { Badge, Card, EmptyState } from '@wafina/ui';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';

export default function MyDisputesPage() {
  const session = useRequireSession();
  const { firebaseUser } = useAuth();
  const [disputes, setDisputes] = useState<Dispute[] | null>(null);
  const [codeByDonationId, setCodeByDonationId] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState('');

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        const [disputeList, donations] = await Promise.all([
          apiFetch<Dispute[]>('/disputes/mine', { idToken }),
          apiFetch<InstitutionDonationView[]>('/donations/claimed-by-me', { idToken }),
        ]);
        setDisputes(disputeList);
        setCodeByDonationId(new Map(donations.map((d) => [d.Donation_ID, d.Public_Donation_Code])));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as ocorrências.');
      }
    })();
  }, [firebaseUser]);

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>As Minhas Ocorrências</h1>
        {error && <div className="banner banner-error">{error}</div>}
        {!error && disputes === null && (
          <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>
        )}
        {disputes?.length === 0 && (
          <EmptyState
            title="Sem ocorrências"
            description="As ocorrências que comunicar sobre doações aparecem aqui."
          />
        )}
        {disputes && disputes.length > 0 && (
          <div className="stack">
            {disputes.map((d) => (
              <Card key={d.Dispute_ID} className="stack">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <p className="mono" style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
                    Doação {codeByDonationId.get(d.Donation_ID) ?? ''}
                  </p>
                  <Badge tone={d.Status === 'Open' ? 'warning' : 'success'}>
                    {d.Status === 'Open' ? 'Aberta' : 'Resolvida'}
                  </Badge>
                </div>
                <p>{d.Issue_Description}</p>
                {d.Resolution_Notes && (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                    Resposta: {d.Resolution_Notes}
                  </p>
                )}
                <p className="time">{new Date(d.Date_Raised).toLocaleString()}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
