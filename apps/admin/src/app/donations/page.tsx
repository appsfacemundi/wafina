'use client';

import {
  DONATION_STATUS_LABEL,
  DONATION_STATUS_TONE,
  type AdminDonationView,
} from '@wafina/shared';
import { Badge, Button, Card, EmptyState, Input, Photo, useToast } from '@wafina/ui';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireAdminSession } from '@/context/AuthContext';
import { ApiError, apiFetch } from '@/lib/api';

/** ISO datetime -> yyyy-mm-dd for a native date input; empty when unset. */
function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export default function AdminDonationsPage() {
  const session = useRequireAdminSession();
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();

  const [donations, setDonations] = useState<AdminDonationView[] | null>(null);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { collection: string; delivery: string }>>({});

  async function load() {
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      const list = await apiFetch<AdminDonationView[]>('/admin/donations', { idToken });
      setDonations(list);
      setDrafts(
        Object.fromEntries(
          list.map((d) => [
            d.Donation_ID,
            {
              collection: toDateInputValue(d.Expected_Collection_Date),
              delivery: toDateInputValue(d.Expected_Delivery_Date),
            },
          ]),
        ),
      );
    } catch {
      setError('Não foi possível carregar as doações.');
    }
  }

  useEffect(() => {
    load();
  }, [firebaseUser]);

  async function onSave(donationId: string) {
    const draft = drafts[donationId];
    if (!draft) return;
    setError('');
    setSavingId(donationId);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/donations/${donationId}/expected-dates`, {
        method: 'PATCH',
        idToken,
        body: {
          Expected_Collection_Date: draft.collection || undefined,
          Expected_Delivery_Date: draft.delivery || undefined,
        },
      });
      await load();
      showToast('Estimativas guardadas com sucesso.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível guardar as datas estimadas.');
    } finally {
      setSavingId(null);
    }
  }

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Doações</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
          Defina a data estimada de recolha e de entrega para cada doação. O doador e a instituição são
          notificados quando uma estimativa já definida é alterada.
        </p>
        {error && <div className="banner banner-error">{error}</div>}
        {!error && donations === null && (
          <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>
        )}
        {donations?.length === 0 && (
          <EmptyState title="Sem doações" description="Doações aparecem aqui assim que são submetidas por um doador." />
        )}
        {donations && donations.length > 0 && (
          <div className="stack">
            {donations.map((d) => (
              <Card key={d.Donation_ID} className="stack" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', gap: 12, padding: 'var(--space-4)' }}>
                  <Photo
                    src={d.Photo}
                    style={{ width: 96, height: 96, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                  />
                  <div className="stack" style={{ gap: 4, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <p style={{ fontWeight: 700, fontSize: 16 }}>{d.Item_Type}</p>
                      <Badge tone={DONATION_STATUS_TONE[d.Status]}>{DONATION_STATUS_LABEL[d.Status]}</Badge>
                    </div>
                    <p className="mono" style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
                      {d.Public_Donation_Code}
                    </p>
                    <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>
                      Qtd: {d.Quantity} · Estado: {d.Condition}
                      {d.City ? ` · ${d.City}` : ''}
                    </p>
                    {d.Claimed_By_Institution_Name && (
                      <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Photo
                          src={d.Claimed_By_Institution_Logo}
                          placeholderIcon="🏢"
                          style={{ width: 18, height: 18, borderRadius: 4, objectFit: 'cover' }}
                        />
                        {d.Claimed_By_Institution_Name}
                      </p>
                    )}
                  </div>
                </div>
                <div
                  className="stack"
                  style={{
                    padding: 'var(--space-4)',
                    borderTop: '1px solid var(--color-border)',
                    background: 'var(--color-surface-muted, transparent)',
                  }}
                >
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <Input
                      label="Data estimada de recolha"
                      type="date"
                      value={drafts[d.Donation_ID]?.collection ?? ''}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [d.Donation_ID]: { ...prev[d.Donation_ID], collection: e.target.value, delivery: prev[d.Donation_ID]?.delivery ?? '' },
                        }))
                      }
                    />
                    <Input
                      label="Data estimada de entrega"
                      type="date"
                      value={drafts[d.Donation_ID]?.delivery ?? ''}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [d.Donation_ID]: { ...prev[d.Donation_ID], delivery: e.target.value, collection: prev[d.Donation_ID]?.collection ?? '' },
                        }))
                      }
                    />
                  </div>
                  <Button onClick={() => onSave(d.Donation_ID)} disabled={savingId === d.Donation_ID}>
                    {savingId === d.Donation_ID ? 'A guardar…' : 'Guardar estimativas'}
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
