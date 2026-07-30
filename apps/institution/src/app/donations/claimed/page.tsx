'use client';

import {
  DONATION_STATUS_LABEL,
  DONATION_STATUS_TONE,
  daysAgoLabel,
  type InstitutionDonationView,
  type SuccessStory,
} from '@wafina/shared';
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
  const [donations, setDonations] = useState<InstitutionDonationView[] | null>(null);
  const [storiesByDonation, setStoriesByDonation] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [deliveringId, setDeliveringId] = useState<string | null>(null);

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
        <h1 style={{ fontSize: 24 }}>Doações Aceites</h1>
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
        {donations && donations.length > 0 && (
          <div className="stack">
            {donations.map((d) => (
              <Card key={d.Donation_ID} className="stack" style={{ padding: 0, overflow: 'hidden' }}>
                <img
                  src={d.Photo}
                  alt=""
                  style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }}
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
                  {d.Donor_Display_Name && (
                    <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {d.Donor_Display_Logo ? (
                        <img
                          src={d.Donor_Display_Logo}
                          alt=""
                          style={{ width: 18, height: 18, borderRadius: 4, objectFit: 'cover' }}
                        />
                      ) : (
                        '👤'
                      )}
                      {d.Donor_Display_Name}
                    </p>
                  )}
                  <p style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
                    📅 {daysAgoLabel(d.Date_Submitted)}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    {d.Status === 'Claimed' && (
                      <Button
                        variant="secondary"
                        onClick={() => onDeliver(d.Donation_ID)}
                        disabled={deliveringId === d.Donation_ID}
                      >
                        {deliveringId === d.Donation_ID ? 'A confirmar…' : 'Confirmar entrega'}
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
