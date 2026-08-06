'use client';

import {
  DELIVERY_METHOD_LABEL,
  DONATION_STATUS_LABEL,
  DONATION_STATUS_TONE,
  formatDateLabel,
  RECIPIENT_CATEGORY_LABEL,
  type CorporateAccount,
  type Donation,
  type SuccessStory,
} from '@wafina/shared';
import { Badge, Button, Card, DonationTimeline, EmptyState } from '@wafina/ui';
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
  const [storiesByDonation, setStoriesByDonation] = useState<Map<string, SuccessStory>>(new Map());
  const [corporateAccount, setCorporateAccount] = useState<CorporateAccount | null>(null);
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
            action={
              <Button onClick={() => router.push('/donations/new')}>Fazer a primeira doação</Button>
            }
          />
        )}
        {donations && donations.length > 0 && (
          <div className="stack">
            {donations.map((d) => {
              const story = storiesByDonation.get(d.Donation_ID);
              return (
                <Card key={d.Donation_ID} className="stack">
                  <div className="donation-row">
                    <div>
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
    </AppShell>
  );
}
