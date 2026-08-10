'use client';

import {
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
  type DeliveryMethod,
  type GeoRegion,
  type RecipientCategory,
} from '@wafina/shared';
import { Badge, Button, Card, CollapsibleGroup, DonationTimeline, EmptyState, Input, Photo, Select, useToast } from '@wafina/ui';
import { useEffect, useMemo, useState } from 'react';
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

  const [donations, setDonations] = useState<AdminDonationView[] | null>(null);
  const [countries, setCountries] = useState<GeoRegion[]>([]);
  const [countryFilter, setCountryFilter] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryMethod | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<RecipientCategory | ''>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'delivered'>('all');
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
      const [list, countryList] = await Promise.all([
        apiFetch<AdminDonationView[]>('/admin/donations', { idToken }),
        apiFetch<GeoRegion[]>('/geo-regions/all-countries', { idToken }),
      ]);
      setDonations(list);
      setCountries(countryList);
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
    if (categoryFilter) result = result.filter((d) => d.Recipient_Category === categoryFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((d) =>
        [d.Donor_Display_Name, d.Public_Donation_Code, d.Item_Type, d.Claimed_By_Institution_Name, d.City]
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
        title: 'Rejeitadas',
        items: filteredDonations.filter((d) => d.Approval_Status === 'Rejected'),
      },
    ];
  }, [filteredDonations]);

  const statusCounts = useMemo(() => {
    const list = filteredDonations ?? [];
    return {
      accepted: list.filter((d) => d.Status === 'Claimed' || d.Status === 'Collection_Scheduled' || d.Status === 'Collected')
        .length,
      pending: list.filter((d) => d.Status === 'Pending' && d.Approval_Status === 'Approved').length,
      delivered: list.filter((d) => d.Status === 'Delivered').length,
    };
  }, [filteredDonations]);

  const visibleDonations = useMemo(() => {
    const list = filteredDonations ?? [];
    if (statusFilter === 'accepted') {
      return list.filter((d) => d.Status === 'Claimed' || d.Status === 'Collection_Scheduled' || d.Status === 'Collected');
    }
    if (statusFilter === 'pending') {
      return list.filter((d) => d.Status === 'Pending' && d.Approval_Status === 'Approved');
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
      showToast('Fotografia atualizada com sucesso.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível atualizar a fotografia.');
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
      showToast('Enviado para a Feed de Impacto.');
    } catch (err) {
      // Bug fix, 2026-08-08 — this list can run to dozens of cards; the page-level
      // `error` banner renders at the very top, invisible while scrolled deep into
      // a status group. A failed send looked identical to nothing happening at
      // all. The toast is fixed-position, so it stays visible regardless of scroll.
      const message = err instanceof ApiError ? err.message : 'Não foi possível enviar para a Feed.';
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
      setError('O motivo é obrigatório.');
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
      showToast('Doação removida do Receber.');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Não foi possível concluir a ação.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setApprovalActionId(null);
    }
  }

  async function onPublishStory(donationId: string) {
    const draft = storyDrafts[donationId];
    if (!draft?.file) {
      setError('Escolha uma fotografia para a história.');
      return;
    }
    if (!draft.title.trim() || !draft.description.trim()) {
      setError('Preencha o título e a descrição da história.');
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
      showToast('História publicada — já visível no Feed de Impacto do doador.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível publicar a história.');
    } finally {
      setStorySavingId(null);
    }
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
              {photoSavingId === d.Donation_ID ? 'A enviar…' : 'Alterar foto'}
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
                {d.Approval_Status === 'Rejected' && <Badge tone="danger">Rejeitada</Badge>}
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
              Motivo: {d.Approval_Rejection_Reason}
            </p>
          )}
          {/* RC1 RECEBER — Admin can pull an inappropriate individual donation out of RECEBER at any point before it's received. */}
          {d.Recipient_Category === 'People' &&
            d.Approval_Status === 'Approved' &&
            d.Individual_State !== 'Delivered' &&
            (reasonFormId === d.Donation_ID && reasonMode === 'remove' ? (
              <div className="stack" style={{ gap: 8, padding: 12, border: '1px solid var(--color-border)', borderRadius: 8 }}>
                <p style={{ fontSize: 13, fontWeight: 700 }}>Motivo da remoção do Receber</p>
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
                    {approvalActionId === d.Donation_ID ? 'A enviar…' : 'Confirmar remoção'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setReasonFormId(null)}
                    disabled={approvalActionId === d.Donation_ID}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="danger" onClick={() => openReasonForm(d.Donation_ID, 'remove')}>
                Remover do Receber
              </Button>
            ))}
          {d.Status === 'Delivered' && (
            <div className="stack" style={{ gap: 8 }}>
              {d.Success_Story_Status === 'Approved' ? (
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-success-700, #15803d)' }}>
                  ✓ Já publicado no Feed de Impacto
                </p>
              ) : d.Success_Story_Status === 'Pending' ? (
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-warning-700, #b45309)' }}>
                  ⏳ Aguarda aprovação — história enviada pela instituição, ainda não visível ao doador. Reveja em
                  Histórias de Impacto.
                </p>
              ) : d.Success_Story_Status === 'Rejected' ? (
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-danger-700, #b91c1c)' }}>
                  ✗ A história anterior desta doação foi rejeitada.
                </p>
              ) : storyFormId !== d.Donation_ID ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Button
                    variant="cta"
                    onClick={() => onSendToFeed(d.Donation_ID)}
                    disabled={sendingToFeedId === d.Donation_ID}
                  >
                    {sendingToFeedId === d.Donation_ID ? 'A enviar…' : 'Enviar para a Feed'}
                  </Button>
                  <Button variant="secondary" onClick={() => setStoryFormId(d.Donation_ID)}>
                    Carregar do PC
                  </Button>
                </div>
              ) : (
                <div className="stack" style={{ gap: 8, padding: 12, border: '1px solid var(--color-border)', borderRadius: 8 }}>
                  <p style={{ fontSize: 13, fontWeight: 700 }}>
                    Carregar uma fotografia diferente para a Feed
                  </p>
                  <Input
                    label="Título"
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
                    <label htmlFor={`story-desc-${d.Donation_ID}`}>Descrição</label>
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
                    <label>Fotografia</label>
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
                      Mostrar instituição e item doado na história
                      <br />
                      <span style={{ color: 'var(--color-text-faint)', fontSize: 12 }}>
                        Se desativar, o doador vê apenas o título e a descrição acima.
                      </span>
                    </span>
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button onClick={() => onPublishStory(d.Donation_ID)} disabled={storySavingId === d.Donation_ID}>
                      {storySavingId === d.Donation_ID ? 'A publicar…' : 'Publicar'}
                    </Button>
                    <Button variant="ghost" onClick={() => setStoryFormId(null)} disabled={storySavingId === d.Donation_ID}>
                      Cancelar
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
        <h1 style={{ fontSize: 24 }}>Doações</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
          Acompanhe o percurso de cada doação já aprovada. Para rever e aprovar doações novas, vá a{' '}
          <strong>Aprovar Doações</strong> no menu.
        </p>
        {error && <div className="banner banner-error">{error}</div>}
        {donations && donations.length > 0 && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Input
              label="Pesquisar"
              placeholder="Nome do doador, código, item, instituição…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ minWidth: 240 }}
            />
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
        {donations && donations.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant={categoryFilter === '' ? 'primary' : 'secondary'} onClick={() => setCategoryFilter('')}>
              Todos
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
          <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>
        )}
        {filteredDonations?.length === 0 && donations?.length === 0 && (
          <EmptyState title="Sem doações" description="Doações aparecem aqui assim que são submetidas por um doador." icon="package" />
        )}
        {filteredDonations?.length === 0 && donations && donations.length > 0 && (
          <EmptyState title="Sem doações neste país" description="Experimente outro país, ou limpe o filtro." icon="package" />
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
                    label: 'Todos',
                    count: statusCounts.accepted + statusCounts.pending + statusCounts.delivered,
                  },
                  { key: 'pending', label: 'Pendentes', count: statusCounts.pending },
                  { key: 'accepted', label: 'Aceites', count: statusCounts.accepted },
                  { key: 'delivered', label: 'Entregues', count: statusCounts.delivered },
                ] as { key: 'all' | 'pending' | 'accepted' | 'delivered'; label: string; count: number }[]
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
              <EmptyState title="Sem doações neste estado" description="Não há doações que correspondam a este filtro." icon="package" />
            ) : (
              visibleDonations.map((d) => renderDonationCard(d))
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
