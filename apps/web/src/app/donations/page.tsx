'use client';

import {
  DELIVERY_METHOD_LABEL,
  daysAgoLabel,
  DONATION_STATUS_LABEL,
  DONATION_STATUS_TONE,
  formatDateLabel,
  RECIPIENT_CATEGORY_LABEL,
  type CorporateAccount,
  type Donation,
  type SuccessStory,
} from '@wafina/shared';
import { Badge, Button, Card, DonationTimeline, EmptyState, Photo } from '@wafina/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';

type StatusFilter = 'all' | 'pending' | 'accepted' | 'delivered';

export default function DonationsPage() {
  const session = useRequireSession();
  const { firebaseUser } = useAuth();
  const router = useRouter();
  const [donations, setDonations] = useState<Donation[] | null>(null);
  const [storiesByDonation, setStoriesByDonation] = useState<Map<string, SuccessStory>>(new Map());
  const [corporateAccount, setCorporateAccount] = useState<CorporateAccount | null>(null);
  const [error, setError] = useState('');
  // RC1 UX polish, 2026-08-10 — single-select filter row replacing the
  // fold/expand groups, matching the mobile-donor equivalent.
  const [filter, setFilter] = useState<StatusFilter>('all');

  const stats = useMemo(() => {
    if (!donations) return null;
    return {
      total: donations.length,
      quantity: donations.reduce((sum, d) => sum + (Number.isSafeInteger(d.Quantity) ? d.Quantity : 0), 0),
      pending: donations.filter((d) => d.Status === 'Pending').length,
      claimed: donations.filter((d) => d.Status === 'Claimed').length,
      delivered: donations.filter((d) => d.Status === 'Delivered').length,
    };
  }, [donations]);

  const statusGroups = useMemo(() => {
    const list = donations ?? [];
    return {
      pending: list.filter((d) => d.Status === 'Pending'),
      accepted: list.filter(
        (d) => d.Status === 'Claimed' || d.Status === 'Collection_Scheduled' || d.Status === 'Collected',
      ),
      delivered: list.filter((d) => d.Status === 'Delivered'),
    };
  }, [donations]);

  const filteredDonations = useMemo(() => {
    if (filter === 'pending') return statusGroups.pending;
    if (filter === 'accepted') return statusGroups.accepted;
    if (filter === 'delivered') return statusGroups.delivered;
    return donations ?? [];
  }, [filter, statusGroups, donations]);

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        const [donationList, stories] = await Promise.all([
          apiFetch<Donation[]>('/donations/mine', { idToken }),
          apiFetch<SuccessStory[]>('/donor/success-stories', { idToken }),
        ]);
        setDonations(donationList);
        setStoriesByDonation(new Map(stories.map((s) => [s.Donation_ID, s])));
      } catch {
        setError('Não foi possível carregar as suas doações.');
      }
    })();
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser || !session?.corporateAccountId) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        setCorporateAccount(await apiFetch<CorporateAccount | null>('/donor/corporate-account', { idToken }));
      } catch {
        // Non-critical — the attribution label just falls back to the generic form below.
      }
    })();
  }, [firebaseUser, session?.corporateAccountId]);

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Minhas Doações</h1>
        {stats && (
          <div className="stats-grid">
            <Card className="stack">
              <p style={{ fontSize: 28, fontWeight: 700 }}>{stats.total}</p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Total de doações</p>
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
              <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Aceites</p>
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
            icon="gift"
            action={
              <Button onClick={() => router.push('/donations/new')}>Fazer a primeira doação</Button>
            }
          />
        )}
        {donations && donations.length > 0 && (
          <div className="stack">
            <div className="filter-row">
              {(
                [
                  { key: 'all', label: 'Todas', count: donations.length },
                  { key: 'pending', label: 'Pendentes', count: statusGroups.pending.length },
                  { key: 'accepted', label: 'Aceites', count: statusGroups.accepted.length },
                  { key: 'delivered', label: 'Entregues', count: statusGroups.delivered.length },
                ] as { key: StatusFilter; label: string; count: number }[]
              ).map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className={['filter-btn', filter === chip.key ? 'filter-btn-active' : ''].join(' ')}
                  onClick={() => setFilter(chip.key)}
                  aria-pressed={filter === chip.key}
                >
                  {chip.label} ({chip.count})
                </button>
              ))}
            </div>
            {filteredDonations.length === 0 ? (
              <EmptyState
                title="Sem doações neste estado"
                description="Não há doações que correspondam a este filtro."
                icon="gift"
              />
            ) : (
              <div className="stack">
                {filteredDonations.map((d) => {
                  const story = storiesByDonation.get(d.Donation_ID);
                  return (
                <Card key={d.Donation_ID} className="stack">
                  <div className="donation-row" style={{ gap: 12 }}>
                    <Photo
                      src={d.Photo}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 8,
                        objectFit: 'contain',
                        background: 'var(--color-surface-2)',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600 }}>{d.Item_Type}</p>
                      <p className="mono" style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
                        {d.Public_Donation_Code} · Qtd {d.Quantity}
                      </p>
                    </div>
                    <Badge tone={DONATION_STATUS_TONE[d.Status]}>
                      {DONATION_STATUS_LABEL[d.Status]}
                    </Badge>
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
                    {d.Corporate_Account_ID
                      ? `🏢 Doação da Empresa${corporateAccount ? ` – ${corporateAccount.Company_Name}` : ''}`
                      : '👤 Doação Pessoal'}
                  </p>
                  <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
                    {d.Recipient_Category ? RECIPIENT_CATEGORY_LABEL[d.Recipient_Category] : '—'}
                    {' · '}
                    {d.Delivery_Method ? DELIVERY_METHOD_LABEL[d.Delivery_Method] : '—'}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
                    📅 {daysAgoLabel(d.Date_Submitted)}
                  </p>
                  {(d.Expected_Collection_Date || d.Expected_Delivery_Date) && (
                    <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
                      {d.Expected_Collection_Date && `Recolha estimada: ${formatDateLabel(d.Expected_Collection_Date)}`}
                      {d.Expected_Collection_Date && d.Expected_Delivery_Date && ' · '}
                      {d.Expected_Delivery_Date && `Entrega estimada: ${formatDateLabel(d.Expected_Delivery_Date)}`}
                    </p>
                  )}
                  {d.Status !== 'Pending' && <DonationTimeline donation={d} />}
                  {story && (
                    <div
                      style={{
                        display: 'flex',
                        gap: 'var(--space-3)',
                        background: 'var(--success-100)',
                        borderRadius: 8,
                        padding: 'var(--space-3)',
                      }}
                    >
                      <img
                        src={story.Image}
                        alt=""
                        width={56}
                        height={56}
                        style={{ borderRadius: 6, objectFit: 'cover' }}
                      />
                      <div>
                        <p
                          style={{
                            fontSize: 10.5,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            fontWeight: 600,
                            color: 'var(--success-700)',
                          }}
                        >
                          História de impacto
                        </p>
                        <p style={{ fontWeight: 600, fontSize: 13.5 }}>{story.Title}</p>
                        <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
                          {story.Description}
                        </p>
                      </div>
                    </div>
                  )}
                </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
