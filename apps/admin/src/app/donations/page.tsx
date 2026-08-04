'use client';

import {
  DONATION_STATUS_LABEL,
  DONATION_STATUS_TONE,
  type AdminDonationView,
  type GeoRegion,
} from '@wafina/shared';
import { Badge, Button, Card, EmptyState, Input, Photo, Select, useToast } from '@wafina/ui';
import { useEffect, useMemo, useState } from 'react';
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
  const [countries, setCountries] = useState<GeoRegion[]>([]);
  const [countryFilter, setCountryFilter] = useState('');
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { collection: string; delivery: string }>>({});

  async function load() {
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      const [list, countryList] = await Promise.all([
        apiFetch<AdminDonationView[]>('/admin/donations', { idToken }),
        apiFetch<GeoRegion[]>('/geo-regions/all-countries', { idToken }),
      ]);
      setDonations(list);
      setCountries(countryList);
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

  const filteredDonations = useMemo(() => {
    if (!donations) return null;
    if (!countryFilter) return donations;
    return donations.filter((d) => d.Country_ID === countryFilter);
  }, [donations, countryFilter]);

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
        {donations && donations.length > 0 && (
          <Select label="Filtrar por país" value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
            <option value="">Todos os países</option>
            {countries.map((c) => (
              <option key={c.Region_ID} value={c.Region_ID}>
                {c.Name}
              </option>
            ))}
          </Select>
        )}
        {!error && filteredDonations === null && (
          <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>
        )}
        {filteredDonations?.length === 0 && donations?.length === 0 && (
          <EmptyState title="Sem doações" description="Doações aparecem aqui assim que são submetidas por um doador." />
        )}
        {filteredDonations?.length === 0 && donations && donations.length > 0 && (
          <EmptyState title="Sem doações neste país" description="Experimente outro país, ou limpe o filtro." />
        )}
        {filteredDonations && filteredDonations.length > 0 && (
          <div className="stack">
            {filteredDonations.map((d) => (
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
                      <p style={{ fontSize: 14.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
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
                  {d.Status === 'Delivered' && (
                    <p style={{ fontSize: 12.5, color: 'var(--color-text-faint)' }}>
                      Doação já entregue — as datas ficam por referência e não podem ser alteradas.
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <Input
                      label="Data estimada de recolha"
                      type="date"
                      disabled={d.Status === 'Delivered'}
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
                      disabled={d.Status === 'Delivered'}
                      value={drafts[d.Donation_ID]?.delivery ?? ''}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [d.Donation_ID]: { ...prev[d.Donation_ID], delivery: e.target.value, collection: prev[d.Donation_ID]?.collection ?? '' },
                        }))
                      }
                    />
                  </div>
                  {d.Status !== 'Delivered' && (
                    <Button onClick={() => onSave(d.Donation_ID)} disabled={savingId === d.Donation_ID}>
                      {savingId === d.Donation_ID ? 'A guardar…' : 'Guardar estimativas'}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
