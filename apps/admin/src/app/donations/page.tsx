'use client';

import {
  CONDITIONS,
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
import {
  Badge,
  Button,
  Card,
  CollapsibleGroup,
  DonationTimeline,
  EmptyState,
  Input,
  Photo,
  PhotoGalleryModal,
  Select,
  useToast,
} from '@wafina/ui';
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
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pending' | 'accepted' | 'reserved' | 'delivered' | 'cancelled'
  >('all');
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
  // V2 multi-photo (2026-08-17) — which donation's full gallery is open, if any.
  const [galleryDonation, setGalleryDonation] = useState<AdminDonationView | null>(null);
  // Admin donation edit/cancel (V2, 2026-08-17).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    Item_Type: string;
    Quantity: string;
    Condition: string;
    Recipient_Category: RecipientCategory;
    Delivery_Method: DeliveryMethod;
    City: string;
    Address: string;
  } | null>(null);
  const [editSavingId, setEditSavingId] = useState<string | null>(null);
  const [cancelFormId, setCancelFormId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSavingId, setCancelSavingId] = useState<string | null>(null);
  // Admin donation delete (2026-08-28) — real, permanent removal, unlike
  // Cancel above. No reason field (stakeholder decision) — just a confirm.
  const [deleteFormId, setDeleteFormId] = useState<string | null>(null);
  const [deleteSavingId, setDeleteSavingId] = useState<string | null>(null);
  // Bulk delete (2026-08-28 follow-up) — select many, delete at once.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirming, setBulkDeleteConfirming] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

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
      cancelled: list.filter((d) => d.Status === 'Cancelled').length,
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
    if (statusFilter === 'cancelled') {
      return list.filter((d) => d.Status === 'Cancelled');
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

  function startEdit(d: AdminDonationView) {
    setEditingId(d.Donation_ID);
    setEditDraft({
      Item_Type: d.Item_Type,
      Quantity: String(d.Quantity),
      Condition: d.Condition,
      Recipient_Category: d.Recipient_Category ?? 'Institutions',
      Delivery_Method: d.Delivery_Method ?? 'Donor_Delivers',
      City: d.City ?? '',
      Address: d.Address ?? '',
    });
  }

  async function onSaveEdit(donationId: string) {
    if (!editDraft) return;
    setError('');
    setEditSavingId(donationId);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/admin/donations/${donationId}`, {
        method: 'PATCH',
        idToken,
        body: {
          Item_Type: editDraft.Item_Type,
          Quantity: Number(editDraft.Quantity),
          Condition: editDraft.Condition,
          Recipient_Category: editDraft.Recipient_Category,
          Delivery_Method: editDraft.Delivery_Method,
          City: editDraft.City,
          Address: editDraft.Address,
        },
      });
      setEditingId(null);
      setEditDraft(null);
      await load();
      showToast(t('donationsPage.editSuccess'));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t('donationsPage.editError');
      setError(message);
      showToast(message, 'error');
    } finally {
      setEditSavingId(null);
    }
  }

  async function onCancelDonation(donationId: string) {
    if (!cancelReason.trim()) {
      setError(t('donationsPage.cancelRequired'));
      return;
    }
    setError('');
    setCancelSavingId(donationId);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/admin/donations/${donationId}/cancel`, {
        method: 'POST',
        idToken,
        body: { reason: cancelReason.trim() },
      });
      setCancelFormId(null);
      setCancelReason('');
      await load();
      showToast(t('donationsPage.cancelSuccess'));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t('donationsPage.cancelError');
      setError(message);
      showToast(message, 'error');
    } finally {
      setCancelSavingId(null);
    }
  }

  async function onDeleteDonation(donationId: string) {
    setError('');
    setDeleteSavingId(donationId);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/admin/donations/${donationId}`, { method: 'DELETE', idToken });
      setDeleteFormId(null);
      await load();
      showToast(t('donationsPage.deleteSuccess'));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t('donationsPage.deleteError');
      setError(message);
      showToast(message, 'error');
    } finally {
      setDeleteSavingId(null);
    }
  }

  function toggleSelected(donationId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(donationId)) next.delete(donationId);
      else next.add(donationId);
      return next;
    });
  }

  // Only Delivered donations are ineligible for delete (matches adminDeleteDonation's
  // own guard) — everything else in the currently visible/filtered list is selectable.
  const selectableVisibleIds = useMemo(
    () => visibleDonations.filter((d) => d.Status !== 'Delivered').map((d) => d.Donation_ID),
    [visibleDonations],
  );
  const allVisibleSelected =
    selectableVisibleIds.length > 0 && selectableVisibleIds.every((id) => selectedIds.has(id));

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        // Deselect just the currently-visible ones — keep any selection made
        // under a different filter intact, rather than wiping it silently.
        const next = new Set(prev);
        selectableVisibleIds.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...selectableVisibleIds]);
    });
  }

  /**
   * Bulk delete (2026-08-28) — sequential, not Promise.all. Each DELETE hits
   * deleteRow on the same Donations tab; deleteRow shifts every row below the
   * one it removes, so firing several in parallel could race each other's
   * row positions (see deleteRow's own doc comment in config/sheets.ts).
   * Continues past individual failures (e.g. a selected row was Delivered,
   * or got deleted by someone else a moment ago) so one bad row doesn't
   * block the rest of a bulk action; reports a combined success/failure count.
   */
  async function onBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkDeleting(true);
    setError('');
    let succeeded = 0;
    let failed = 0;
    try {
      const idToken = await firebaseUser?.getIdToken();
      for (const id of ids) {
        try {
          await apiFetch(`/admin/donations/${id}`, { method: 'DELETE', idToken });
          succeeded += 1;
        } catch {
          failed += 1;
        }
      }
      setSelectedIds(new Set());
      setBulkDeleteConfirming(false);
      await load();
      if (failed === 0) {
        showToast(t('donationsPage.bulkDeleteSuccess', { count: succeeded }));
      } else {
        showToast(t('donationsPage.bulkDeletePartial', { succeeded, failed }), 'error');
      }
    } finally {
      setBulkDeleting(false);
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
          {/* Bulk delete (2026-08-28) — Delivered donations aren't eligible
              for delete at all (matches adminDeleteDonation's own guard), so
              no checkbox renders for those; nothing to select there. */}
          {d.Status !== 'Delivered' && (
            <input
              type="checkbox"
              checked={selectedIds.has(d.Donation_ID)}
              onChange={() => toggleSelected(d.Donation_ID)}
              aria-label={t('donationsPage.selectForBulkDelete')}
              style={{ marginTop: 4, flexShrink: 0, width: 18, height: 18, cursor: 'pointer' }}
            />
          )}
          <div className="stack" style={{ gap: 4, flexShrink: 0 }}>
            {/* V2 multi-photo (2026-08-17) — click to open the full gallery; badge only shows once there's more than one photo. */}
            <button
              type="button"
              onClick={() => d.Photos.length > 0 && setGalleryDonation(d)}
              aria-label="Ver todas as fotos"
              style={{ position: 'relative', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
            >
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
          {/* Admin donation edit/cancel (V2, 2026-08-17) — a data-entry fix or
              a withdrawal-on-the-donor's-behalf. Hidden once the donation is
              done (Delivered/Cancelled) — nothing left to correct or void. */}
          {d.Status !== 'Delivered' && d.Status !== 'Cancelled' && (
            <div className="stack" style={{ gap: 8 }}>
              {editingId === d.Donation_ID && editDraft ? (
                <div className="stack" style={{ gap: 8, padding: 12, border: '1px solid var(--color-border)', borderRadius: 8 }}>
                  <p style={{ fontSize: 13, fontWeight: 700 }}>{t('donationsPage.editFormTitle')}</p>
                  <Input
                    label={t('donationsPage.editItemType')}
                    value={editDraft.Item_Type}
                    onChange={(e) => setEditDraft({ ...editDraft, Item_Type: e.target.value })}
                  />
                  <Input
                    label={t('donationsPage.editQuantity')}
                    type="number"
                    min={1}
                    value={editDraft.Quantity}
                    onChange={(e) => setEditDraft({ ...editDraft, Quantity: e.target.value })}
                  />
                  <Select
                    label={t('donationsPage.editCondition')}
                    value={editDraft.Condition}
                    onChange={(e) => setEditDraft({ ...editDraft, Condition: e.target.value })}
                  >
                    {CONDITIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label={t('donationsPage.editRecipientCategory')}
                    value={editDraft.Recipient_Category}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, Recipient_Category: e.target.value as RecipientCategory })
                    }
                  >
                    {RECIPIENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {RECIPIENT_CATEGORY_LABEL[c]}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label={t('donationsPage.editDeliveryMethod')}
                    value={editDraft.Delivery_Method}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, Delivery_Method: e.target.value as DeliveryMethod })
                    }
                  >
                    {DELIVERY_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {DELIVERY_METHOD_LABEL[m]}
                      </option>
                    ))}
                  </Select>
                  <Input
                    label={t('donationsPage.editCity')}
                    value={editDraft.City}
                    onChange={(e) => setEditDraft({ ...editDraft, City: e.target.value })}
                  />
                  <Input
                    label={t('donationsPage.editAddress')}
                    value={editDraft.Address}
                    onChange={(e) => setEditDraft({ ...editDraft, Address: e.target.value })}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button onClick={() => onSaveEdit(d.Donation_ID)} disabled={editSavingId === d.Donation_ID}>
                      {editSavingId === d.Donation_ID ? t('donationsPage.uploading') : t('donationsPage.saveEdit')}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditingId(null);
                        setEditDraft(null);
                      }}
                      disabled={editSavingId === d.Donation_ID}
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              ) : cancelFormId === d.Donation_ID ? (
                <div className="stack" style={{ gap: 8, padding: 12, border: '1px solid var(--color-border)', borderRadius: 8 }}>
                  <p style={{ fontSize: 13, fontWeight: 700 }}>{t('donationsPage.cancelReasonTitle')}</p>
                  <div className="field">
                    <textarea
                      className="input"
                      rows={2}
                      style={{ resize: 'vertical' }}
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      variant="danger"
                      onClick={() => onCancelDonation(d.Donation_ID)}
                      disabled={cancelSavingId === d.Donation_ID}
                    >
                      {cancelSavingId === d.Donation_ID ? t('donationsPage.uploading') : t('donationsPage.confirmCancel')}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setCancelFormId(null)}
                      disabled={cancelSavingId === d.Donation_ID}
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="secondary" onClick={() => startEdit(d)}>
                    {t('donationsPage.editAction')}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      setCancelFormId(d.Donation_ID);
                      setCancelReason('');
                    }}
                  >
                    {t('donationsPage.cancelAction')}
                  </Button>
                </div>
              )}
            </div>
          )}
          {/* Admin donation delete (2026-08-28) — real, permanent removal.
              Deliberately its own block, separate from the edit/cancel guard
              above: unlike those, delete stays available on a Cancelled
              donation too (clearing out a mistake is the main reason this
              exists) — only Delivered is off-limits, since that's the one
              state with a real linked Success Story/impact history. */}
          {d.Status !== 'Delivered' && (
            <div className="stack" style={{ gap: 8 }}>
              {deleteFormId === d.Donation_ID ? (
                <div className="stack" style={{ gap: 8, padding: 12, border: '1px solid var(--color-border)', borderRadius: 8 }}>
                  <p style={{ fontSize: 13, fontWeight: 700 }}>{t('donationsPage.deleteConfirmTitle')}</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      variant="danger"
                      onClick={() => onDeleteDonation(d.Donation_ID)}
                      disabled={deleteSavingId === d.Donation_ID}
                    >
                      {deleteSavingId === d.Donation_ID ? t('donationsPage.uploading') : t('donationsPage.confirmDelete')}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setDeleteFormId(null)}
                      disabled={deleteSavingId === d.Donation_ID}
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="danger" onClick={() => setDeleteFormId(d.Donation_ID)}>
                  {t('donationsPage.deleteAction')}
                </Button>
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
                    count:
                      statusCounts.accepted +
                      statusCounts.pending +
                      statusCounts.reserved +
                      statusCounts.delivered +
                      statusCounts.cancelled,
                  },
                  // Task 1 — "Reservadas" placed right after "Todas": this is
                  // the staff's operational workspace (find reservation →
                  // verify Wafina ID → give PIN → receiver confirms), so it
                  // should not be buried after the Institution-flow tabs.
                  { key: 'reserved', label: t('donationsPage.filterReserved'), count: statusCounts.reserved },
                  { key: 'pending', label: t('donationsPage.filterPending'), count: statusCounts.pending },
                  { key: 'accepted', label: t('donationsPage.filterAccepted'), count: statusCounts.accepted },
                  { key: 'delivered', label: t('donationsPage.filterDelivered'), count: statusCounts.delivered },
                  { key: 'cancelled', label: t('donationsPage.filterCancelled'), count: statusCounts.cancelled },
                ] as {
                  key: 'all' | 'pending' | 'accepted' | 'reserved' | 'delivered' | 'cancelled';
                  label: string;
                  count: number;
                }[]
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
            {/* Bulk delete (2026-08-28) — only shown once there's at least
                one selectable (non-Delivered) donation in the current
                filter, so the bar doesn't clutter an empty/Delivered-only view. */}
            {selectableVisibleIds.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  {t('donationsPage.selectAllVisible')}
                </label>
                {selectedIds.size > 0 &&
                  (bulkDeleteConfirming ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>
                        {t('donationsPage.bulkDeleteConfirmTitle', { count: selectedIds.size })}
                      </span>
                      <Button variant="danger" onClick={onBulkDelete} disabled={bulkDeleting}>
                        {bulkDeleting ? t('donationsPage.uploading') : t('donationsPage.confirmDelete')}
                      </Button>
                      <Button variant="ghost" onClick={() => setBulkDeleteConfirming(false)} disabled={bulkDeleting}>
                        {t('common.cancel')}
                      </Button>
                    </div>
                  ) : (
                    <Button variant="danger" onClick={() => setBulkDeleteConfirming(true)}>
                      {t('donationsPage.bulkDeleteAction', { count: selectedIds.size })}
                    </Button>
                  ))}
              </div>
            )}
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
      <PhotoGalleryModal
        open={!!galleryDonation}
        photos={galleryDonation?.Photos ?? []}
        onClose={() => setGalleryDonation(null)}
      />
    </AppShell>
  );
}
