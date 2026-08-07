'use client';

import type { AdminDisputeView } from '@wafina/shared';
import { Button, Card, EmptyState, Input, Photo, useToast } from '@wafina/ui';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireAdminSession } from '@/context/AuthContext';
import { ApiError, apiFetch } from '@/lib/api';

export default function AdminDisputesPage() {
  const session = useRequireAdminSession();
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();

  const [disputes, setDisputes] = useState<AdminDisputeView[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  async function load() {
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      setDisputes(await apiFetch<AdminDisputeView[]>('/admin/disputes/pending', { idToken }));
    } catch {
      setError('Não foi possível carregar as ocorrências.');
    }
  }

  useEffect(() => {
    load();
  }, [firebaseUser]);

  async function onResolve(disputeId: string) {
    if (!notes.trim()) {
      setError('Descreva como a ocorrência foi resolvida.');
      return;
    }
    setError('');
    setBusyId(disputeId);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/admin/disputes/${disputeId}/resolve`, {
        method: 'POST',
        idToken,
        body: { resolutionNotes: notes },
      });
      setResolvingId(null);
      setNotes('');
      await load();
      showToast('Ocorrência resolvida.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível resolver a ocorrência.');
    } finally {
      setBusyId(null);
    }
  }

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Ocorrências Abertas</h1>
        {error && <div className="banner banner-error">{error}</div>}
        {disputes === null && !error && <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>}
        {disputes?.length === 0 && (
          <EmptyState title="Sem ocorrências abertas" description="Ocorrências levantadas por instituições aparecem aqui." icon="alert-circle" />
        )}
        {disputes && disputes.length > 0 && (
          <div className="stack">
            {disputes.map((d) => (
              <Card key={d.Dispute_ID} className="stack" style={{ gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Photo
                    src={d.Institution_Logo}
                    placeholderIcon="🏢"
                    style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }}
                  />
                  <p style={{ fontWeight: 700, fontSize: 15 }}>{d.Institution_Name ?? 'Instituição'}</p>
                </div>
                {d.Donation_Public_Code && (
                  <p className="mono" style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
                    {d.Donation_Item_Type} · {d.Donation_Public_Code}
                  </p>
                )}
                <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>{d.Issue_Description}</p>

                {resolvingId === d.Dispute_ID ? (
                  <div className="stack">
                    <Input label="Como foi resolvida" value={notes} onChange={(e) => setNotes(e.target.value)} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button onClick={() => onResolve(d.Dispute_ID)} disabled={busyId === d.Dispute_ID}>
                        {busyId === d.Dispute_ID ? 'A resolver…' : 'Confirmar resolução'}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setResolvingId(null);
                          setNotes('');
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: 4 }}>
                    <Button onClick={() => setResolvingId(d.Dispute_ID)} disabled={busyId === d.Dispute_ID}>
                      Resolver
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
