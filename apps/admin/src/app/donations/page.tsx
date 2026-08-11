'use client';

import {
  countryFlagEmoji,
  DELIVERY_METHOD_LABEL,
  DELIVERY_METHODS,
  daysAgoLabel,
  DONATION_STATUS_LABEL,
  DONATION_STATUS_TONE,
  INDIVIDUAL_DONATION_STATE_LABEL,
  INDIVIDUAL_DONATION_STATE_TONE,
  RECIPIENT_CATEGORIES,
  RECIPIENT_CATEGORY_LABEL,
  type AdminDonationView,
  type CollectionPoint,
  type DeliveryMethod,
  type GeoRegion,
  type RecipientCategory,
} from '@wafina/shared';
import { Badge, Button, Card, CollapsibleGroup, DonationTimeline, EmptyState, Input, Photo, Select, useToast } from '@wafina/ui';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireAdminSession } from '@/context/AuthContext';
import { ApiError, apiFetch } from '@/lib/api';

function parseDate(v: string | null): number {
  if (!v) return 0;
  const t = Date.parse(v);
  return Number.isNaN(t) ? 0 : t;
}

export default function AdminDonationsPage() {
  const session = useRequireAdminSession();
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [donations, setDonations] = useState<AdminDonationView[] | null>(null);
  const [countries, setCountries] = useState<GeoRegion[]>([]);
  // Admin collection-code visibility, 2026-08-10 — every configured
  // collection point, so an active reservation's card can show exactly
  // where staff should expect the recipient to show up.
  const [collectionPoints, setCollectionPoints] = useState<CollectionPoint[]>([]);
  const [countryFilter, setCountryFilter] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryMethod | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<RecipientCategory | ''>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'reserved' | 'delivered'>('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [photoSavingId, setPhotoSavingId] = useState<string | null>(null);
  const [storyFormId, setStoryFormId] = useState<string | null>(null);
  const [storyDrafts, setStoryDrafts] = useState<
    Record<string, { title: string; description: string; file: File | null; showDetails: boolean }>
  >({});
  const [storySavingId, setStorySavingId] = useState<string | null>(null);
  const [sendingToFeedId, setSendingToFeedId] = useState<string | null>(null);
  // RC1 RECEBER — used only by "Remover do Receber" on this page now;
  // approve/reject/request-correction moved to the dedicated
  // /donations/approve queue.
  const [approvalActionId, setApprovalActionId] = useState<string | null>(null);
  const [reasonFormId, setReasonFormId] = useState<string | null>(null);
  const [reasonMode, setReasonMode] = useState<'remove' | null>(null);
  const [reasonText, setReasonText] = useState('');

  async function load() {
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      const [list, countryList, collectionPointList] = await Promise.all([
        apiFetch<AdminDonationView[]>('/admin/donations', { idToken }),
        apiFetch<GeoRegion[]>('/geo-regions/all-countries', { idToken }),
        apiFetch<CollectionPoint[]>('/admin/collection-points', { idToken }),
      ]);
      setDonations(list);
      setCountries(countryList);
      setCollectionPoints(collectionPointList);
    } catch {
      setError(t('donationsPage.loadError'));
    }
  }

  useEffect(() => {
    load();
  }, [firebaseUser]);

  // Admin collection-code visibility, 2026-08-10 — ticks the reservation
  // countdown roughly live without re-rendering every card every second;
  // an operational glance doesn't need second-level precision the way the
  // recipient's own countdown does.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const filteredDonations = useMemo(() => {
    if (!donations) return null;
    let result = donations;
    if (countryFilter) result = result.filter((d) => d.Country_ID === countryFilter);
    if (deliveryFilter) result = result.filter((d) => d.Delivery_Method === deliveryFilter);
    if (categoryFilter) result = result.filter((d) => d.Recipient_Category === categoryFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      // Task 4 — a staff member must be able to search a Wafina ID (or a
      // receiver's name) and land directly on the active reservation, not
      // just donor/institution identity as before.
      result = result.filter((d) =>
        [
          d.Donor_Display_Name,
          d.Public_Donation_Code,
          d.Item_Type,
          d.Claimed_By_Institution_Name,
          d.City,
          d.Reserved_By_Wafina_ID,
          d.Reserved_By_Name,
        ]
          .filter(Boolean)
          .some((field) => field!.toLowerCase().includes(q)),
      );
    }
    // Real-device finding, 2026-08-07 — the API already returns this list
    // newest-submitted-first (listAllDonationsForAdmin sorts server-side),
    // but this page never re-sorted after filtering, so it relied entirely
    // on that order surviving the filters above untouched. Sorting
    // defensively here keeps the newest-on-top guarantee explicit.
    return [...result].sort((a, b) => parseDate(b.Date_Submitted) - parseDate(a.Date_Submitted));
  }, [donations, countryFilter, deliveryFilter, categoryFilter, search]);

  /**
   * Admin UX fix, 2026-08-07, revised 2026-08-10 — the delivery-pipeline
   * groups (Aceites/Pendentes/Entregue) are now a single-select filter
   * (statusFilter below) instead of three always-expanded fold/expand
   * groups, matching the donor/institution apps' equivalent lists.
   * Pendentes de Aprovação moved off this page entirely — it now lives on
   * its own badged nav item (/donations/approve). Rejeitadas stays here,
   * always-visible, for reference (no action left to take on it).
   */
  const priorityGroups = useMemo(() => {
    if (!filteredDonations) return [];
    return [
      {
        key: 'rejected',
        title: t('donationsPage.rejectedGroup'),
        items: filteredDonations.filter((d) => d.Approval_Status === 'Rejected'),
      },
    ];
  }, [filteredDonations, t]);

  // Task 1 — an active RECEBER reservation used to be indistinguishable
  // from a plain unclaimed item inside "Pendentes" (both are Status='Pending'
  // until confirmed). Splitting it into its own "Reservadas" filter is the
  // actual fix for "staff shouldn't have to search every card for the PIN" —
  // Individual_State is already computed server-side (see
  // listAllDonationsForAdmin), this only re-slices it for the UI.
  const isActiveReservation = (d: AdminDonationView) =>
    d.Recipient_Category === 'People' && d.Individual_State === 'Reserved';

  const statusCounts = useMemo(() => {
    const list = filteredDonations ?? [];
    return {
      accepted: list.filter((d) => d.Status === 'Claimed' || d.Status === 'Collection_Scheduled' || d.Status === 'Collected')
        .length,
      pending: list.filter((d) => d.Status === 'Pending' && d.Approval_Status === 'Approved' && !isActiveReservation(d))
        .length,
      reserved: list.filter(isActiveReservation).length,
      delivered: list.filter((d) => d.Status === 'Delivered').length,
    };
  }, [filteredDonations]);

  const visibleDonations = useMemo(() => {
    const list = filteredDonations ?? [];
    if (statusFilter === 'accepted') {
      return list.filter((d) => d.Status === 'Claimed' || d.Status === 'Collection_Scheduled' || d.Status === 'Collected');
    }
    if (statusFilter === 'pending') {
      return list.filter((d) => d.Status === 'Pending' && d.Approval_Status === 'Approved' && !isActiveReservation(d));
    }
    if (statusFilter === 'reserved') {
      // Newest reservation first — the most time-sensitive one operationally.
      return [...list.filter(isActiveReservation)].sort(
        (a, b) => parseDate(b.Reserved_At) - parseDate(a.Reserved_At),
      );
    }
    if (statusFilter === 'delivered') {
      // Bug fix, 2026-08-08 — sort by Date_Delivered (not the list's
      // Date_Submitted order) so the most recently delivered donation (the
      // one most likely to still need a story) is always first.
      return [...list.filter((d) => d.Status === 'Delivered')].sort(
        (a, b) => parseDate(b.Date_Delivered) - parseDate(a.Date_Delivered),
      );
    }
    // 'all' — everything the priority groups above don't already cover.
    return list.filter((d) => d.Approval_Status !== 'Pending_Review' && d.Approval_Status !== 'Rejected');
  }, [filteredDonations, statusFilter]);

  async function onChangePhoto(donationId: string, file: File) {
    setError('');
    setPhotoSavingId(donationId);
    try {
      const idToken = await firebaseUser?.getIdToken();
      const form = new FormData();
      form.append('photo', file);
      await apiFetch(`/admin/donations/${donationId}/photo`, { method: 'PATCH', idToken, body: form });
      await load();
      showToast(t('donationsPage.photoUpdated'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('donationsPage.photoUpdateError'));
    } finally {
      setPhotoSavingId(null);
    }
  }

  async function onSendToFeed(donationId: string) {
    setError('');
    setSendingToFeedId(donationId);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/admin/donations/${donationId}/send-to-feed`, { method: 'POST', idToken });
      await load();
      showToast(t('donationsPage.feedSentSuccess'));
    } catch (err) {
      // Bug fix, 2026-08-08 — this list can run to dozens of cards; the page-level
      // `error` banner renders at the very top, invisible while scrolled deep into
      // a status group. A failed send looked identical to nothing happening at
      // all. The toast is fixed-position, so it stays visible regardless of scroll.
      const message = err instanceof ApiError ? err.message : t('donationsPage.feedSentError');
      setError(message);
      showToast(message, 'error');
    } finally {
      setSendingToFeedId(null);
    }
  }

  function openReasonForm(donationId: string, mode: 'remove') {
    setReasonFormId(donationId);
    setReasonMode(mode);
    setReasonText('');
  }

  /** RC1 RECEBER — remove-from-Receber; approve/reject/request-correction moved to /donations/approve. */
  async function onSubmitReason(donationId: string) {
    if (!reasonText.trim()) {
      setError(t('donationsPage.removalRequired'));
      return;
    }
    setError('');
    setApprovalActionId(donationId);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/donations/${donationId}/remove-individual`, {
        method: 'POST',
        idToken,
        body: { reason: reasonText.trim() },
      });
      setReasonFormId(null);
      setReasonMode(null);
      setReasonText('');
      await load();
      showToast(t('donationsPage.removalSuccess'));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t('donationsPage.removalError');
      setError(message);
      showToast(message, 'error');
    } finally {
      setApprovalActionId(null);
    }
  }

  async function onPublishStory(donationId: string) {
    const draft = storyDrafts[donationId];
    if (!draft?.file) {
      setError(t('donationsPage.publishRequirePhoto'));
      return;
    }
    if (!draft.title.trim() || !draft.description.trim()) {
      setError(t('donationsPage.publishRequireFields'));
      return;
    }
    setError('');
    setStorySavingId(donationId);
    try {
      const idToken = await firebaseUser?.getIdToken();
      const form = new FormData();
      form.append('image', draft.file);
      form.append('Donation_ID', donationId);
      form.append('Title', draft.title.trim());
      form.append('Description', draft.description.trim());
      form.append('Show_Donation_Details', String(draft.showDetails));
      await apiFetch('/admin/success-stories', { method: 'POST', idToken, body: form });
      setStoryFormId(null);
      setStoryDrafts((prev) => ({
        ...prev,
        [donationId]: { title: '', description: '', file: null, showDetails: true },
      }));
      await load();
      showToast(t('donationsPage.publishSuccess'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('donationsPage.publishError'));
    } finally {
      setStorySavingId(null);
    }
  }

  /**
   * Admin collection-code visibility, 2026-08-10 — "Xh Ym restantes" (or
   * "Expirada", left to the server's own lazy-expiry check to actually
   * decide — this is display only, never a client-side expiry decision).
   */
  function reservationCountdownLabel(reservedAtIso: string): string {
    const expiresAt = new Date(reservedAtIso).getTime() + 24 * 60 * 60 * 1000;
    const diff = expiresAt - now;
    if (diff <= 0) return t('donationsPage.card.expired');
    const hours = Math.floor(diff / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    return t('donationsPage.card.timeLeft', { time: `${hours}h ${minutes}m` });
  }

  function renderDonationCard(d: AdminDonationView) {
    return (
      <Card key={d.Donation_ID} className="stack" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 12, padding: 'var(--space-4)' }}>
          <div className="stack" style={{ gap: 4, flexShrink: 0 }}>
            <Photo
              src={d.Photo}
              style={{
                width: 96,
                height: 96,
                borderRadius: 8,
                objectFit: 'contain',
                background: 'var(--color-surface-2)',
              }}
            />
            <label
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                textAlign: 'center',
                color: 'var(--color-accent)',
                cursor: photoSavingId === d.Donation_ID ? 'default' : 'pointer',
                opacity: photoSavingId === d.Donation_ID ? 0.6 : 1,
              }}
            >
              {photoSavingId === d.Donation_ID ? t('donationsPage.uploading') : t('donationsPage.changePhoto')}
              <input
                type="file"
                accept="image/*"
                disabled={photoSavingId === d.Donation_ID}
                style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) onChangePhoto(d.Donation_ID, file);
                }}
              />
            </label>
          </div>
          <div className="stack" style={{ gap: 4, flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <p style={{ fontWeight: 700, fontSize: 16 }}>{d.Item_Type}</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {d.Approval_Status === 'Rejected' && <Badge tone="danger">{t('donationsPage.rejectedBadge')}</Badge>}
                {d.Individual_State && (
                  <Badge tone={INDIVIDUAL_DONATION_STATE_TONE[d.Individual_State]}>
                    {INDIVIDUAL_DONATION_STATE_LABEL[d.Individual_State]}
                  </Badge>
                )}
                <Badge tone={DONATION_STATUS_TONE[d.Status]}>{DONATION_STATUS_LABEL[d.Status]}</Badge>
              </div>
            </div>
            <p className="mono" style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
              {d.Public_Donation_Code}
            </p>
            <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>
              {t('donationsPage.quantity')}: {d.Quantity} · {t('donationsPage.condition')}: {d.Condition}
              {d.City ? ` · ${d.City}` : ''}
              {' '}
              <a
                href={`https://www.google.com/maps?q=${d.Location.lat},${d.Location.lng}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--color-accent)', fontWeight: 600 }}
              >
                {t('donationsPage.viewOnMap')}
              </a>
            </p>
            <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>
              {d.Recipient_Category ? RECIPIENT_CATEGORY_LABEL[d.Recipient_Category] : '—'}
              {' · '}
              {d.Delivery_Method ? DELIVERY_METHOD_LABEL[d.Delivery_Method] : '—'}
            </p>
            {/* RC1 pickup-location fix, 2026-08-07 — Admin needs the same pickup context as Institution to help resolve logistics issues. */}
            {d.Address && <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>🏠 {d.Address}</p>}
            {d.Donor_Phone && (
              <p style={{ fontSize: 13.5 }}>
                <a href={`tel:${d.Donor_Phone}`} style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
                  📞 {d.Donor_Phone}
                </a>
              </p>
            )}
            <p style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>📅 {daysAgoLabel(d.Date_Submitted)}</p>
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
          {/* RC1 admin approval-gate rework, 2026-08-10 — this page never
              shows a Pending_Review donation anymore (approve/reject/request
              correction now live on the dedicated /donations/approve queue);
              a rejected donation's reason still shows here for reference. */}
          {d.Approval_Status === 'Rejected' && d.Approval_Rejection_Reason && (
            <p style={{ fontSize: 13, color: 'var(--color-danger-700, #b91c1c)' }}>
              {t('donationsPage.rejectionReason', { reason: d.Approval_Rejection_Reason })}
            </p>
          )}
          {/*
            Task 2/3, 2026-08-11 — reworked visual hierarchy: reservation
            status → receiver identity → Wafina ID → collection point →
            countdown → PIN (visually separated, largest element on the
            card) → PIN verification status → help microcopy. The PIN itself
            was already server-side and already reaching this component
            (Collection_Code on AdminDonationView) — this only changes how
            prominently it's displayed, not where it comes from. Only shown
            for an active reservation — once Delivered, nothing left to do.
          */}
          {d.Recipient_Category === 'People' && d.Individual_State === 'Reserved' && d.Reserved_At && (
            <div
              className="stack"
              style={{
                gap: 8,
                padding: 14,
                border: '1.5px solid var(--color-accent)',
                borderRadius: 8,
                background: 'var(--color-accent-soft, rgba(99,102,241,0.06))',
              }}
            >
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-accent)' }}>
                🎁 {t('donationsPage.card.reservationTitle')}
              </p>
              <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>
                {d.Public_Donation_Code} · {d.Item_Type}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 13.5 }}>
                <span>
                  👤 {t('donationsPage.card.receiver')}: <strong>{d.Reserved_By_Name ?? t('donationsPage.card.receiverFallback')}</strong>
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 13.5 }}>
                <span>
                  🪪 {t('donationsPage.card.wafinaId')}: <strong className="mono">{d.Reserved_By_Wafina_ID ?? '—'}</strong>
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 13.5 }}>
                <span>
                  {(() => {
                    const country = countries.find((c) => c.Region_ID === d.Country_ID);
                    return country ? `${countryFlagEmoji(country.ISO_Code)} ${country.Name}` : d.Country_ID;
                  })()}
                </span>
                <span>
                  📍 {t('donationsPage.card.collectionPoint')}:{' '}
                  {collectionPoints.find((cp) => cp.Country_ID === d.Country_ID)?.Name ??
                    t('donationsPage.card.collectionPointUnset')}
                </span>
              </div>
              <p style={{ fontSize: 13.5 }}>⏱️ {reservationCountdownLabel(d.Reserved_At)}</p>
              {/* PIN — visually separated from the metadata above (its own
                  bordered block, larger type) so it's the one thing on this
                  card a staff member can't miss. */}
              <div
                className="stack"
                style={{
                  gap: 4,
                  padding: '10px 12px',
                  background: 'var(--color-surface)',
                  borderRadius: 6,
                  border: '1.5px solid var(--color-border-strong, var(--color-border))',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-faint)' }}>
                  🔐 {t('donationsPage.card.pinLabel')}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span className="mono" style={{ fontSize: 28, fontWeight: 700, letterSpacing: 6 }}>
                    {d.Collection_Code ?? '----'}
                  </span>
                  <Badge tone={d.Collection_Code_Verified_At ? 'success' : 'warning'}>
                    {d.Collection_Code_Verified_At ? t('donationsPage.card.pinVerified') : t('donationsPage.card.pinNotVerified')}
                  </Badge>
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--color-text-faint)', display: 'flex', gap: 4 }}>
                <span>ℹ️</span>
                <span>{t('donationsPage.card.pinHelp')}</span>
              </p>
            </div>
          )}
          {/* RC1 RECEBER — Admin can pull an inappropriate individual donation out of RECEBER at any point before it's received. */}
          {d.Recipient_Category === 'People' &&
            d.Approval_Status === 'Approved' &&
            d.Individual_State !== 'Delivered' &&
            (reasonFormId === d.Donation_ID && reasonMode === 'remove' ? (
              <div className="stack" style={{ gap: 8, padding: 12, border: '1px solid var(--color-border)', borderRadius: 8 }}>
                <p style={{ fontSize: 13, fontWeight: 700 }}>{t('donationsPage.removeReasonTitle')}</p>
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
                  <Button
                    variant="danger"
                    onClick={() => onSubmitReason(d.Donation_ID)}
                    disabled={approvalActionId === d.Donation_ID}
                  >
                    {approvalActionId === d.Donation_ID ? t('donationsPage.uploading') : t('donationsPage.confirmRemoval')}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setReasonFormId(null)}
                    disabled={approvalActionId === d.Donation_ID}
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="danger" onClick={() => openReasonForm(d.Donation_ID, 'remove')}>
                {t('donationsPage.removeFromReceber')}
              </Button>
            ))}
          {d.Status === 'Delivered' && (
            <div className="stack" style={{ gap: 8 }}>
              {d.Success_Story_Status === 'Approved' ? (
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-success-700, #15803d)' }}>
                  {t('donationsPage.feedPublished')}
                </p>
              ) : d.Success_Story_Status === 'Pending' ? (
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-warning-700, #b45309)' }}>
                  {t('donationsPage.feedPending')}
                </p>
              ) : d.Success_Story_Status === 'Rejected' ? (
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-danger-700, #b91c1c)' }}>
                  {t('donationsPage.feedRejected')}
                </p>
              ) : storyFormId !== d.Donation_ID ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Button
                    variant="cta"
                    onClick={() => onSendToFeed(d.Donation_ID)}
                    disabled={sendingToFeedId === d.Donation_ID}
                  >
                    {sendingToFeedId === d.Donation_ID ? t('donationsPage.uploading') : t('donationsPage.sendToFeed')}
                  </Button>
                  <Button variant="secondary" onClick={() => setStoryFormId(d.Donation_ID)}>
                    {t('donationsPage.uploadFromComputer')}
                  </Button>
                </div>
              ) : (
                <div className="stack" style={{ gap: 8, padding: 12, border: '1px solid var(--color-border)', borderRadius: 8 }}>
                  <p style={{ fontSize: 13, fontWeight: 700 }}>
                    {t('donationsPage.uploadDifferentPhotoTitle')}
                  </p>
                  <Input
                    label={t('donationsPage.titleLabel')}
                    value={storyDrafts[d.Donation_ID]?.title ?? ''}
                    onChange={(e) =>
                      setStoryDrafts((prev) => ({
                        ...prev,
                        [d.Donation_ID]: {
                          title: e.target.value,
                          description: prev[d.Donation_ID]?.description ?? '',
                          file: prev[d.Donation_ID]?.file ?? null,
                          showDetails: prev[d.Donation_ID]?.showDetails ?? true,
                        },
                      }))
                    }
                  />
                  <div className="field">
                    <label htmlFor={`story-desc-${d.Donation_ID}`}>{t('donationsPage.descriptionLabel')}</label>
                    <textarea
                      id={`story-desc-${d.Donation_ID}`}
                      className="input"
                      rows={3}
                      style={{ resize: 'vertical' }}
                      value={storyDrafts[d.Donation_ID]?.description ?? ''}
                      onChange={(e) =>
                        setStoryDrafts((prev) => ({
                          ...prev,
                          [d.Donation_ID]: {
                            title: prev[d.Donation_ID]?.title ?? '',
                            description: e.target.value,
                            file: prev[d.Donation_ID]?.file ?? null,
                            showDetails: prev[d.Donation_ID]?.showDetails ?? true,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label>{t('donationsPage.photoLabel')}</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        setStoryDrafts((prev) => ({
                          ...prev,
                          [d.Donation_ID]: {
                            title: prev[d.Donation_ID]?.title ?? '',
                            description: prev[d.Donation_ID]?.description ?? '',
                            file,
                            showDetails: prev[d.Donation_ID]?.showDetails ?? true,
                          },
                        }));
                      }}
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13.5 }}>
                    <input
                      type="checkbox"
                      checked={storyDrafts[d.Donation_ID]?.showDetails ?? true}
                      onChange={(e) =>
                        setStoryDrafts((prev) => ({
                          ...prev,
                          [d.Donation_ID]: {
                            title: prev[d.Donation_ID]?.title ?? '',
                            description: prev[d.Donation_ID]?.description ?? '',
                            file: prev[d.Donation_ID]?.file ?? null,
                            showDetails: e.target.checked,
                          },
                        }))
                      }
                      style={{ marginTop: 2 }}
                    />
                    <span>
                      {t('donationsPage.showInstitutionToggle')}
                      <br />
                      <span style={{ color: 'var(--color-text-faint)', fontSize: 12 }}>
                        {t('donationsPage.showInstitutionHelp')}
                      </span>
                    </span>
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button onClick={() => onPublishStory(d.Donation_ID)} disabled={storySavingId === d.Donation_ID}>
                      {storySavingId === d.Donation_ID ? t('donationsPage.publishing') : t('donationsPage.publish')}
                    </Button>
                    <Button variant="ghost" onClick={() => setStoryFormId(null)} disabled={storySavingId === d.Donation_ID}>
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* RC1 admin approval-gate rework, 2026-08-10 — the collection/
              delivery date INPUTS are gone (Admin approves/moderates, it
              doesn't invent a delivery estimate — that's for the
              institution/recipient handoff to determine). The lifecycle
              itself stays visible via the same timeline donor/institution
              already see. */}
          <div style={{ paddingTop: 4 }}>
            <DonationTimeline donation={d} />
          </div>
        </div>
      </Card>
    );
  }

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>{t('donationsPage.title')}</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
          {t('donationsPage.subtitle')}{' '}
          {t('donationsPage.subtitleLink', { link: t('nav.approveDonations') })}
        </p>
        {error && <div className="banner banner-error">{error}</div>}
        {donations && donations.length > 0 && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Input
              label={t('common.search')}
              placeholder={t('donationsPage.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ minWidth: 240 }}
            />
            <Select label={t('donationsPage.filterCountry')} value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
              <option value="">{t('donationsPage.allCountries')}</option>
              {countries.map((c) => (
                <option key={c.Region_ID} value={c.Region_ID}>
                  {c.Name}
                </option>
              ))}
            </Select>
            <Select
              label={t('donationsPage.filterDelivery')}
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value as DeliveryMethod | '')}
            >
              <option value="">{t('donationsPage.allMethods')}</option>
              {DELIVERY_METHODS.map((m) => (
                <option key={m} value={m}>
                  {DELIVERY_METHOD_LABEL[m]}
                </option>
              ))}
            </Select>
          </div>
        )}
        {donations && donations.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant={categoryFilter === '' ? 'primary' : 'secondary'} onClick={() => setCategoryFilter('')}>
              {t('donationsPage.categoryAll')}
            </Button>
            {RECIPIENT_CATEGORIES.map((c) => (
              <Button
                key={c}
                variant={categoryFilter === c ? 'primary' : 'secondary'}
                onClick={() => setCategoryFilter(c)}
              >
                {RECIPIENT_CATEGORY_LABEL[c]}
              </Button>
            ))}
          </div>
        )}
        {!error && filteredDonations === null && (
          <p style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</p>
        )}
        {filteredDonations?.length === 0 && donations?.length === 0 && (
          <EmptyState title={t('donationsPage.emptyTitle')} description={t('donationsPage.emptyDescription')} icon="package" />
        )}
        {filteredDonations?.length === 0 && donations && donations.length > 0 && (
          <EmptyState
            title={t('donationsPage.emptyCountryTitle')}
            description={t('donationsPage.emptyCountryDescription')}
            icon="package"
          />
        )}
        {filteredDonations && filteredDonations.length > 0 && (
          <div className="stack" style={{ gap: 'var(--space-4)' }}>
            {priorityGroups
              .filter((group) => group.items.length > 0)
              .map((group) => (
                <CollapsibleGroup key={group.key} title={group.title} count={group.items.length}>
                  {group.items.map((d) => renderDonationCard(d))}
                </CollapsibleGroup>
              ))}
            <div className="filter-row">
              {(
                [
                  {
                    key: 'all',
                    label: t('donationsPage.filterAll'),
                    count: statusCounts.accepted + statusCounts.pending + statusCounts.reserved + statusCounts.delivered,
                  },
                  // Task 1 — "Reservadas" placed right after "Todas": this is
                  // the staff's operational workspace (find reservation →
                  // verify Wafina ID → give PIN → receiver confirms), so it
                  // should not be buried after the Institution-flow tabs.
                  { key: 'reserved', label: t('donationsPage.filterReserved'), count: statusCounts.reserved },
                  { key: 'pending', label: t('donationsPage.filterPending'), count: statusCounts.pending },
                  { key: 'accepted', label: t('donationsPage.filterAccepted'), count: statusCounts.accepted },
                  { key: 'delivered', label: t('donationsPage.filterDelivered'), count: statusCounts.delivered },
                ] as { key: 'all' | 'pending' | 'accepted' | 'reserved' | 'delivered'; label: string; count: number }[]
              ).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={['filter-btn', statusFilter === f.key ? 'filter-btn-active' : ''].join(' ')}
                  onClick={() => setStatusFilter(f.key)}
                  aria-pressed={statusFilter === f.key}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>
            {visibleDonations.length === 0 ? (
              <EmptyState
                title={t('donationsPage.emptyStatusTitle')}
                description={t('donationsPage.emptyStatusDescription')}
                icon="package"
              />
            ) : (
              visibleDonations.map((d) => renderDonationCard(d))
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
