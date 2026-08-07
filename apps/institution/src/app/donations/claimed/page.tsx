'use client';

import {
  DELIVERY_METHOD_LABEL,
  DONATION_STATUS_LABEL,
  DONATION_STATUS_TONE,
  daysAgoLabel,
  formatDateLabel,
  RECIPIENT_CATEGORY_LABEL,
  type InstitutionDonationView,
  type SuccessStory,
} from '@wafina/shared';
import { Badge, Button, Card, DonationTimeline, EmptyState, Photo, useToast } from '@wafina/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';

export default function ClaimedDonationsPage() {
  const session = useRequireSession();
  const { firebaseUser } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [donations, setDonations] = useState<InstitutionDonationView[] | null>(null);
  const [storiesByDonation, setStoriesByDonation] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);
  const [deliveredPrompt, setDeliveredPrompt] = useState<{ donationId: string; code: string } | null>(null);

  async function load() {
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      const [donationList, stories] = await Promise.all([
        apiFetch<InstitutionDonationView[]>('/donations/claimed-by-me', { idToken }),
        apiFetch<SuccessStory[]>('/success-stories/mine', { idToken }),
      ]);
      setDonations(donationList);
      setStoriesByDonation(new Set(stories.map((s) => s.Donation_ID)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as doações.');
    }
  }

  useEffect(() => {
    load();
  }, [firebaseUser]);

  // Real-device finding, 2026-08-07 — the API already returns this list
  // newest-claimed-first (listDonationsClaimedByInstitution sorts server-side),
  // but this page rendered raw API order with no sort of its own to fall
  // back on. Sorting here too keeps the newest-on-top guarantee even if that
  // ever changes, matching the Admin donations list's same defensive pattern.
  const sortedDonations = useMemo(() => {
    if (!donations) return donations;
    const parse = (v: string | null) => {
      if (!v) return 0;
      const t = Date.parse(v);
      return Number.isNaN(t) ? 0 : t;
    };
    return [...donations].sort((a, b) => parse(b.Date_Claimed) - parse(a.Date_Claimed));
  }, [donations]);

  const SUCCESS_MESSAGE: Record<'schedule-collection' | 'collect' | 'deliver', string> = {
    'schedule-collection': 'Recolha agendada com sucesso!',
    collect: 'Doação marcada como recolhida!',
    deliver: 'Entrega confirmada com sucesso!',
  };

  async function onAction(donationId: string, action: 'schedule-collection' | 'collect' | 'deliver', failMessage: string) {
    const code = donations?.find((d) => d.Donation_ID === donationId)?.Public_Donation_Code ?? '';
    setActingId(donationId);
    setError('');
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/donations/${donationId}/${action}`, { method: 'POST', idToken });
      await load();
      showToast(SUCCESS_MESSAGE[action]);
      if (action === 'deliver') setDeliveredPrompt({ donationId, code });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : failMessage);
    } finally {
      setActingId(null);
    }
  }

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Doações Aceites</h1>
        {deliveredPrompt && (
          <Card className="stack" style={{ background: 'var(--success-100)' }}>
            <p style={{ fontWeight: 700 }}>Parabéns! 🎉</p>
            <p style={{ fontSize: 13.5 }}>
              A doação {deliveredPrompt.code} foi entregue com sucesso. Gostaria de criar uma História de Impacto
              agora?
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                onClick={() => {
                  router.push(
                    `/success-stories/new?donationId=${deliveredPrompt.donationId}&code=${encodeURIComponent(deliveredPrompt.code)}`,
                  );
                  setDeliveredPrompt(null);
                }}
              >
                Criar História
              </Button>
              <Button variant="ghost" onClick={() => setDeliveredPrompt(null)}>
                Mais tarde
              </Button>
            </div>
          </Card>
        )}
        {error && <div className="banner banner-error">{error}</div>}
        {!error && donations === null && (
          <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>
        )}
        {donations?.length === 0 && (
          <EmptyState
            title="Ainda sem doações aceites"
            description="As doações que aceitar aparecem aqui."
          />
        )}
        {sortedDonations && sortedDonations.length > 0 && (
          <div className="stack">
            {sortedDonations.map((d) => (
              <Card key={d.Donation_ID} className="stack" style={{ padding: 0, overflow: 'hidden' }}>
                <Photo
                  src={d.Photo}
                  style={{ width: '100%', height: 180, objectFit: 'cover', display: 'flex' }}
                />
                <div className="stack" style={{ padding: 'var(--space-4)', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <p style={{ fontWeight: 700, fontSize: 17 }}>{d.Item_Type}</p>
                    <Badge tone={DONATION_STATUS_TONE[d.Status]}>{DONATION_STATUS_LABEL[d.Status]}</Badge>
                  </div>
                  <p className="mono" style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
                    {d.Public_Donation_Code}
                  </p>
                  <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>
                    Qtd: {d.Quantity} · Estado: {d.Condition}
                  </p>
                  <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>
                    {d.Recipient_Category ? RECIPIENT_CATEGORY_LABEL[d.Recipient_Category] : '—'}
                    {' · '}
                    {d.Delivery_Method ? DELIVERY_METHOD_LABEL[d.Delivery_Method] : '—'}
                  </p>
                  {d.City && (
                    <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>
                      📍 {d.City}{' '}
                      <a
                        href={`https://www.google.com/maps?q=${d.Location.lat},${d.Location.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--color-accent)', fontWeight: 600 }}
                      >
                        Ver no mapa
                      </a>
                    </p>
                  )}
                  {/* RC1 pickup-location fix, 2026-08-07 — map pin alone left no way to identify the exact spot or reach the donor. */}
                  {d.Address && (
                    <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>🏠 {d.Address}</p>
                  )}
                  {d.Donor_Display_Name && (
                    <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Photo
                        src={d.Donor_Display_Logo}
                        placeholderIcon="👤"
                        style={{ width: 18, height: 18, borderRadius: 4, objectFit: 'cover' }}
                      />
                      {d.Donor_Display_Name}
                    </p>
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
                  {(d.Expected_Collection_Date || d.Expected_Delivery_Date) && (
                    <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
                      {d.Expected_Collection_Date && `Recolha estimada: ${formatDateLabel(d.Expected_Collection_Date)}`}
                      {d.Expected_Collection_Date && d.Expected_Delivery_Date && ' · '}
                      {d.Expected_Delivery_Date && `Entrega estimada: ${formatDateLabel(d.Expected_Delivery_Date)}`}
                    </p>
                  )}
                  <div style={{ marginTop: 4, marginBottom: 4 }}>
                    <DonationTimeline donation={d} />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    {d.Status === 'Claimed' && (
                      <Button
                        variant="secondary"
                        onClick={() => onAction(d.Donation_ID, 'schedule-collection', 'Não foi possível agendar a recolha.')}
                        disabled={actingId === d.Donation_ID}
                      >
                        {actingId === d.Donation_ID ? 'A agendar…' : 'Confirmar recolha agendada'}
                      </Button>
                    )}
                    {d.Status === 'Collection_Scheduled' && (
                      <Button
                        variant="secondary"
                        onClick={() => onAction(d.Donation_ID, 'collect', 'Não foi possível marcar como recolhida.')}
                        disabled={actingId === d.Donation_ID}
                      >
                        {actingId === d.Donation_ID ? 'A confirmar…' : 'Marcar como recolhida'}
                      </Button>
                    )}
                    {d.Status === 'Collected' && (
                      <Button
                        variant="secondary"
                        onClick={() => onAction(d.Donation_ID, 'deliver', 'Não foi possível confirmar a entrega.')}
                        disabled={actingId === d.Donation_ID}
                      >
                        {actingId === d.Donation_ID ? 'A confirmar…' : 'Confirmar entrega'}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() =>
                        router.push(
                          `/disputes/new?donationId=${d.Donation_ID}&code=${encodeURIComponent(d.Public_Donation_Code)}`,
                        )
                      }
                    >
                      Comunicar Ocorrência
                    </Button>
                    {d.Status === 'Delivered' &&
                      (storiesByDonation.has(d.Donation_ID) ? (
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--success-700)' }}>
                          ✓ História publicada
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            router.push(
                              `/success-stories/new?donationId=${d.Donation_ID}&code=${encodeURIComponent(d.Public_Donation_Code)}`,
                            )
                          }
                        >
                          Publicar história
                        </Button>
                      ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
