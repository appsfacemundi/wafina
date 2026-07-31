'use client';

import { daysAgoLabel, type GeoRegion, type InstitutionDonationView } from '@wafina/shared';
import { Button, Card, EmptyState, Input, Photo, useToast } from '@wafina/ui';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { useOwnInstitution } from '@/hooks/useOwnInstitution';
import { apiFetch, ApiError } from '@/lib/api';

export default function AvailableDonationsPage() {
  const session = useRequireSession();
  const { firebaseUser } = useAuth();
  const { institution } = useOwnInstitution();
  const { showToast } = useToast();
  const [donations, setDonations] = useState<InstitutionDonationView[] | null>(null);
  const [countryName, setCountryName] = useState('');
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
      setDonations(await apiFetch<InstitutionDonationView[]>('/donations/available', { idToken }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as doações.');
    }
  }

  useEffect(() => {
    load();
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser || !institution?.Country_ID) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        const countries = await apiFetch<GeoRegion[]>('/geo-regions/all-countries', { idToken });
        setCountryName(countries.find((c) => c.Region_ID === institution.Country_ID)?.Name ?? '');
      } catch {
        // Non-critical — the card just omits the country name if this fails.
      }
    })();
  }, [firebaseUser, institution?.Country_ID]);

  async function onClaim(donationId: string) {
    setClaimingId(donationId);
    setError('');
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/donations/${donationId}/claim`, { method: 'POST', idToken });
      await load();
      showToast('Doação aceite com sucesso! Já pode agendar a recolha em "Doações Aceites".');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível aceitar a doação.');
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
              <Card key={d.Donation_ID} className="stack" style={{ padding: 0, overflow: 'hidden' }}>
                <Photo
                  src={d.Photo}
                  style={{ width: '100%', height: 200, objectFit: 'cover', display: 'flex' }}
                />
                <div className="stack" style={{ padding: 'var(--space-4)', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <p style={{ fontWeight: 700, fontSize: 17 }}>{d.Item_Type}</p>
                    <p className="mono" style={{ fontSize: 12, color: 'var(--color-text-faint)', whiteSpace: 'nowrap' }}>
                      {d.Public_Donation_Code}
                    </p>
                  </div>
                  <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>
                    Qtd: {d.Quantity} · Estado: {d.Condition}
                  </p>
                  {(d.City || countryName) && (
                    <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>
                      📍 {[d.City, countryName].filter(Boolean).join(', ')}{' '}
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
                      <Photo
                        src={d.Donor_Display_Logo}
                        placeholderIcon="👤"
                        style={{ width: 18, height: 18, borderRadius: 4, objectFit: 'cover' }}
                      />
                      {d.Donor_Display_Name}
                    </p>
                  )}
                  <p style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
                    📅 {daysAgoLabel(d.Date_Submitted)}
                  </p>
                  <Button
                    onClick={() => onClaim(d.Donation_ID)}
                    disabled={claimingId === d.Donation_ID}
                    fullWidth
                    style={{ marginTop: 4 }}
                  >
                    {claimingId === d.Donation_ID ? 'A aceitar…' : 'Aceitar Doação'}
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
