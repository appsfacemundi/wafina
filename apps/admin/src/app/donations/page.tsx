'use client';

import {
  DELIVERY_METHOD_LABEL,
  DELIVERY_METHODS,
  daysAgoLabel,
  DONATION_STATUS_LABEL,
  DONATION_STATUS_TONE,
  RECIPIENT_CATEGORY_LABEL,
  type AdminDonationView,
  type DeliveryMethod,
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
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryMethod | ''>('');
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
    let result = donations;
    if (countryFilter) result = result.filter((d) => d.Country_ID === countryFilter);
    if (deliveryFilter) result = result.filter((d) => d.Delivery_Method === deliveryFilter);
    // Real-device finding, 2026-08-07 — the API already returns this list
    // newest-submitted-first (listAllDonationsForAdmin sorts server-side),
    // but this page never re-sorted after filtering, so it relied entirely
    // on that order surviving the filters above untouched. Sorting
    // defensively here keeps the newest-on-top guarantee explicit.
    const parse = (v: string) => {
      if (!v) return 0;
      const t = Date.parse(v);
      return Number.isNaN(t) ? 0 : t;
    };
    return [...result].sort((a, b) => parse(b.Date_Submitted) - parse(a.Date_Submitted));
  }, [donations, countryFilter, deliveryFilter]);

  async function onSave(donationId: string) {
    const draft = drafts[donationId];
    if (!draft) return;
    // Real-device finding, 2026-08-07 — the PATCH below sends `undefined` for
    // an empty field, which the API treats as "leave this field alone" (see
    // setExpectedDates's `dates.X !== undefined` checks in services/donations.ts)
    // — never as "clear it". So saving with both dates empty was always a
    // silent no-op that still showed a success toast, misleading whoever
    // clicked it into thinking something changed.
    if (!draft.collection && !draft.delivery) {
      setError('Introduza pelo menos uma data antes de guardar.');
      return;
    }
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
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Select label="Filtrar por país" value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
              <option value="">Todos os países</option>
              {countries.map((c) => (
                <option key={c.Region_ID} value={c.Region_ID}>
                  {c.Name}
                </option>
              ))}
            </Select>
            <Select
              label="Filtrar por método de entrega"
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value as DeliveryMethod | '')}
            >
              <option value="">Todos os métodos</option>
              {DELIVERY_METHODS.map((m) => (
                <option key={m} value={m}>
                  {DELIVERY_METHOD_LABEL[m]}
                </option>
              ))}
            </Select>
          </div>
        )}
        {!error && filteredDonations === null && (
          <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>
        )}
        {filteredDonations?.length === 0 && donations?.length === 0 && (
          <EmptyState title="Sem doações" description="Doações aparecem aqui assim que são submetidas por um doador." icon="package" />
        )}
        {filteredDonations?.length === 0 && donations && donations.length > 0 && (
          <EmptyState title="Sem doações neste país" description="Experimente outro país, ou limpe o filtro." icon="package" />
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
                      {' '}
                      <a
                        href={`https://www.google.com/maps?q=${d.Location.lat},${d.Location.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--color-accent)', fontWeight: 600 }}
                      >
                        Ver no mapa
                      </a>
                    </p>
                    <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>
                      {d.Recipient_Category ? RECIPIENT_CATEGORY_LABEL[d.Recipient_Category] : '—'}
                      {' · '}
                      {d.Delivery_Method ? DELIVERY_METHOD_LABEL[d.Delivery_Method] : '—'}
                    </p>
                    {/* RC1 pickup-location fix, 2026-08-07 — Admin needs the same pickup context as Institution to help resolve logistics issues. */}
                    {d.Address && (
                      <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>🏠 {d.Address}</p>
                    )}
                    {d.Donor_Phone && (
                      <p style={{ fontSize: 13.5 }}>
                        <a href={`tel:${d.Donor_Phone}`} style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
                          📞 {d.Donor_Phone}
                        </a>
                      </p>
                    )}
                    <p style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
                      📅 {daysAgoLabel(d.Date_Submitted)}
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
                    <Button
                      onClick={() => onSave(d.Donation_ID)}
                      disabled={
                        savingId === d.Donation_ID ||
                        (!drafts[d.Donation_ID]?.collection && !drafts[d.Donation_ID]?.delivery)
                      }
                    >
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
