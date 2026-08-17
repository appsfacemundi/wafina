'use client';

import {
  countryFlagEmoji,
  formatDateTimeLabel,
  RECIPIENT_CATEGORY_LABEL,
  type AdminDonationView,
  type GeoRegion,
} from '@wafina/shared';
import { Badge, Button, Card, EmptyState, Photo, PhotoGalleryModal, useToast } from '@wafina/ui';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireAdminSession } from '@/context/AuthContext';
import { ApiError, apiFetch } from '@/lib/api';

/**
 * RC1 admin approval-gate rework, 2026-08-10 — the dedicated "Aprovar
 * Doações" queue, split out of the general Doações page so Admin has one
 * obvious, badged place to review every donation before it can reach an
 * Institution, Animal Shelter, or individual (RECEBER). Every donation here
 * has Approval_Status === 'Pending_Review' — nothing on this list is visible
 * to any recipient yet (server-enforced in reserveDonationForIndividual /
 * claimDonation / the list endpoints — not just hidden in this UI).
 */
export default function ApproveDonationsPage() {
  const session = useRequireAdminSession();
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();

  const [donations, setDonations] = useState<AdminDonationView[] | null>(null);
  // Country-routing fix, 2026-08-10 — fetched so each card can show the
  // donation's distribution country (Country_ID) as a flag + name, making it
  // immediately obvious where approval will route it (not just which
  // recipient category).
  const [countries, setCountries] = useState<GeoRegion[]>([]);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [reasonFormId, setReasonFormId] = useState<string | null>(null);
  const [reasonMode, setReasonMode] = useState<'reject' | 'correction' | null>(null);
  const [reasonText, setReasonText] = useState('');
  // V2 multi-photo (2026-08-17) — reviewing every angle matters most right
  // here, before approval, so this queue gets the same gallery viewer as
  // the main Doações page.
  const [galleryDonation, setGalleryDonation] = useState<AdminDonationView | null>(null);

  async function load() {
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      const [pending, countryList] = await Promise.all([
        apiFetch<AdminDonationView[]>('/donations/pending-review', { idToken }),
        apiFetch<GeoRegion[]>('/geo-regions/all-countries', { idToken }),
      ]);
      setDonations(pending);
      setCountries(countryList);
    } catch {
      setError('Não foi possível carregar as doações pendentes de aprovação.');
    }
  }

  useEffect(() => {
    load();
  }, [firebaseUser]);

  async function onApprove(donationId: string) {
    setError('');
    setActionId(donationId);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/donations/${donationId}/approve`, { method: 'POST', idToken });
      await load();
      showToast('Doação aprovada — já visível no fluxo do destinatário correto.');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Não foi possível aprovar a doação.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setActionId(null);
    }
  }

  function openReasonForm(donationId: string, mode: 'reject' | 'correction') {
    setReasonFormId(donationId);
    setReasonMode(mode);
    setReasonText('');
  }

  async function onSubmitReason(donationId: string) {
    if (!reasonText.trim()) {
      setError('O motivo é obrigatório.');
      return;
    }
    const endpoint =
      reasonMode === 'reject' ? `/donations/${donationId}/reject` : `/donations/${donationId}/request-correction`;
    setError('');
    setActionId(donationId);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(endpoint, { method: 'POST', idToken, body: { reason: reasonText.trim() } });
      setReasonFormId(null);
      setReasonMode(null);
      setReasonText('');
      await load();
      showToast(reasonMode === 'reject' ? 'Doação rejeitada.' : 'Correção pedida ao doador.');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Não foi possível concluir a ação.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setActionId(null);
    }
  }

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Aprovar Doações</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
          Nenhuma doação fica visível a uma Instituição, Abrigo de Animais, ou através do Receber, sem passar
          primeiro por aqui. Reveja os dados e aprove, rejeite, ou peça uma correção ao doador.
        </p>
        {error && <div className="banner banner-error">{error}</div>}
        {!error && donations === null && <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>}
        {donations?.length === 0 && (
          <EmptyState
            title="Sem doações pendentes"
            description="Todas as doações submetidas já foram revistas. Novas doações aparecem aqui automaticamente."
            icon="check-circle"
          />
        )}
        {donations && donations.length > 0 && (
          <div className="stack" style={{ gap: 'var(--space-4)' }}>
            {donations.map((d) => (
              <Card key={d.Donation_ID} className="stack" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: 'var(--warning-100, #fef3c7)' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--warning-700, #92400e)' }}>
                    ⏳ Pendente de Aprovação
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {/* Country-routing fix, 2026-08-10 — the distribution country
                        (Donation.Country_ID), shown alongside recipient category so
                        Admin sees at a glance exactly which country+category pool
                        approval will route this donation into. */}
                    <Badge tone="neutral">
                      {(() => {
                        const country = countries.find((c) => c.Region_ID === d.Country_ID);
                        return country ? `${countryFlagEmoji(country.ISO_Code)} ${country.Name}` : d.Country_ID;
                      })()}
                    </Badge>
                    <Badge tone="warning">
                      {d.Recipient_Category ? RECIPIENT_CATEGORY_LABEL[d.Recipient_Category] : 'Destinatário não definido'}
                    </Badge>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, padding: 'var(--space-4)' }}>
                  <button
                    type="button"
                    onClick={() => d.Photos.length > 0 && setGalleryDonation(d)}
                    aria-label="Ver todas as fotos"
                    style={{
                      position: 'relative',
                      padding: 0,
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <Photo
                      src={d.Photo}
                      style={{
                        width: 120,
                        height: 120,
                        borderRadius: 8,
                        objectFit: 'contain',
                        background: 'var(--color-surface-2)',
                      }}
                    />
                    {d.Photos.length > 1 && (
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 4,
                          right: 4,
                          background: 'rgba(15, 23, 42, 0.7)',
                          color: '#ffffff',
                          fontSize: 10.5,
                          fontWeight: 700,
                          borderRadius: 999,
                          padding: '2px 7px',
                        }}
                      >
                        📷 {d.Photos.length}
                      </span>
                    )}
                  </button>
                  <div className="stack" style={{ gap: 4, flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: 17 }}>{d.Item_Type}</p>
                    <p className="mono" style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
                      {d.Public_Donation_Code}
                    </p>
                    <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>
                      Qtd: {d.Quantity} · Estado: {d.Condition}
                    </p>
                    {(d.City || d.Address) && (
                      <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>
                        📍 {[d.Address, d.City].filter(Boolean).join(', ')}{' '}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <Photo
                        src={d.Donor_Display_Logo}
                        placeholderIcon="👤"
                        style={{ width: 22, height: 22, borderRadius: 5, objectFit: 'cover' }}
                      />
                      <p style={{ fontSize: 13.5, fontWeight: 600 }}>
                        {d.Donor_Display_Name ?? 'Doador'}
                        {d.Corporate_Account_ID ? ' · Doação Corporativa' : ''}
                      </p>
                    </div>
                    {d.Donor_Phone && (
                      <p style={{ fontSize: 13.5 }}>
                        <a href={`tel:${d.Donor_Phone}`} style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
                          📞 {d.Donor_Phone}
                        </a>
                      </p>
                    )}
                    <p style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
                      Submetida em {formatDateTimeLabel(d.Date_Submitted)}
                    </p>
                  </div>
                </div>
                <div
                  className="stack"
                  style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}
                >
                  {reasonFormId === d.Donation_ID ? (
                    <div className="stack" style={{ gap: 8, padding: 12, border: '1px solid var(--color-border)', borderRadius: 8 }}>
                      <p style={{ fontSize: 13, fontWeight: 700 }}>
                        {reasonMode === 'reject' ? 'Motivo da rejeição' : 'O que precisa de ser corrigido?'}
                      </p>
                      <div className="field">
                        <textarea
                          className="input"
                          rows={2}
                          style={{ resize: 'vertical' }}
                          value={reasonText}
                          onChange={(e) => setReasonText(e.target.value)}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button variant="danger" onClick={() => onSubmitReason(d.Donation_ID)} disabled={actionId === d.Donation_ID}>
                          {actionId === d.Donation_ID ? 'A enviar…' : 'Confirmar'}
                        </Button>
                        <Button variant="ghost" onClick={() => setReasonFormId(null)} disabled={actionId === d.Donation_ID}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Button variant="cta" onClick={() => onApprove(d.Donation_ID)} disabled={actionId === d.Donation_ID}>
                        {actionId === d.Donation_ID ? 'A aprovar…' : '✓ Aprovar Doação'}
                      </Button>
                      <Button variant="danger" onClick={() => openReasonForm(d.Donation_ID, 'reject')} disabled={actionId === d.Donation_ID}>
                        ✕ Rejeitar Doação
                      </Button>
                      <Button variant="secondary" onClick={() => openReasonForm(d.Donation_ID, 'correction')} disabled={actionId === d.Donation_ID}>
                        Pedir Correção
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      <PhotoGalleryModal
        open={!!galleryDonation}
        photos={galleryDonation?.Photos ?? []}
        onClose={() => setGalleryDonation(null)}
      />
    </AppShell>
  );
}
