'use client';

import type { GeoRegion, Institution } from '@wafina/shared';
import { formatDateLabel } from '@wafina/shared';
import { Badge, Button, Card, EmptyState, Input, Photo, Select, useToast } from '@wafina/ui';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireAdminSession } from '@/context/AuthContext';
import { ApiError, apiFetch } from '@/lib/api';

type InstitutionStatus = 'pending' | 'verified' | 'rejected';

function statusOf(institution: Institution): InstitutionStatus {
  if (institution.Verified) return 'verified';
  if (institution.Rejection_Reason) return 'rejected';
  return 'pending';
}

const STATUS_BADGE: Record<InstitutionStatus, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  verified: { label: 'Verificada', tone: 'success' },
  pending: { label: 'Pendente', tone: 'warning' },
  rejected: { label: 'Rejeitada', tone: 'danger' },
};

export default function AdminInstitutionsPage() {
  const session = useRequireAdminSession();
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();

  const [institutions, setInstitutions] = useState<Institution[] | null>(null);
  const [countries, setCountries] = useState<GeoRegion[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InstitutionStatus | 'all'>('all');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  async function load() {
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      const [all, allCountries] = await Promise.all([
        apiFetch<Institution[]>('/admin/institutions', { idToken }),
        apiFetch<GeoRegion[]>('/geo-regions/all-countries', { idToken }),
      ]);
      setInstitutions(all);
      setCountries(allCountries);
    } catch {
      setError('Não foi possível carregar as instituições.');
    }
  }

  useEffect(() => {
    load();
  }, [firebaseUser]);

  // Pilot feedback, 2026-08-05: unsorted (whatever order the sheet rows
  // arrived in) — same pending-needs-attention-first ordering already
  // applied to the Reports page's Institutions filter.
  const STATUS_PRIORITY: Record<InstitutionStatus, number> = { pending: 0, rejected: 1, verified: 2 };

  const filtered = useMemo(() => {
    if (!institutions) return null;
    const q = search.trim().toLowerCase();
    let base = q ? institutions.filter((i) => i.Name.toLowerCase().includes(q)) : institutions;
    if (statusFilter !== 'all') base = base.filter((i) => statusOf(i) === statusFilter);
    // Epic 0.5, 2026-08-06: Created_At now exists — within a status group,
    // newest-registered first, closing the gap this comment used to flag.
    return [...base].sort((a, b) => {
      const statusDiff = STATUS_PRIORITY[statusOf(a)] - STATUS_PRIORITY[statusOf(b)];
      if (statusDiff !== 0) return statusDiff;
      return (b.Created_At || '').localeCompare(a.Created_At || '');
    });
  }, [institutions, search, statusFilter]);

  function countryName(countryId: string): string {
    return countries.find((c) => c.Region_ID === countryId)?.Name ?? countryId;
  }

  async function onApprove(institutionId: string) {
    setError('');
    setBusyId(institutionId);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/admin/institutions/${institutionId}/verify`, { method: 'POST', idToken });
      await load();
      showToast('Instituição aprovada com sucesso.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível aprovar a instituição.');
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(institutionId: string) {
    if (!rejectReason.trim()) {
      setError('Indique o motivo da rejeição.');
      return;
    }
    setError('');
    setBusyId(institutionId);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/admin/institutions/${institutionId}/reject`, {
        method: 'POST',
        idToken,
        body: { reason: rejectReason },
      });
      setRejectingId(null);
      setRejectReason('');
      await load();
      showToast('Instituição rejeitada.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível rejeitar a instituição.');
    } finally {
      setBusyId(null);
    }
  }

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Instituições</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Input
            label="Procurar por nome"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            label="Estado"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InstitutionStatus | 'all')}
          >
            <option value="all">Todos</option>
            <option value="pending">Pendente</option>
            <option value="verified">Verificada</option>
            <option value="rejected">Rejeitada</option>
          </Select>
        </div>
        {error && <div className="banner banner-error">{error}</div>}

        {filtered === null && !error && (
          <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>
        )}

        {filtered?.length === 0 && (
          <EmptyState
            title="Sem instituições"
            description="Quando uma instituição se registar, aparece aqui."
          />
        )}

        {filtered?.map((institution) => {
          const status = statusOf(institution);
          const badge = STATUS_BADGE[status];
          return (
            <Card key={institution.Institution_ID} className="stack">
              <div className="institution-card" style={{ display: 'flex', gap: 12 }}>
                <Photo
                  src={institution.Logo}
                  placeholderIcon="🏢"
                  style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                />
                <div className="stack" style={{ gap: 2, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <p style={{ fontWeight: 600, fontSize: 16 }}>{institution.Name}</p>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </div>
                  <p className="needs">
                    {institution.Type} · {countryName(institution.Country_ID)}
                  </p>
                  <p className="mono" style={{ fontSize: 11.5, color: 'var(--color-text-faint)' }}>
                    {institution.Institution_ID}
                  </p>
                  {institution.Created_At && (
                    <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                      Registado: {formatDateLabel(institution.Created_At)}
                    </p>
                  )}
                  <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    Localização: {institution.Location.lat.toFixed(5)}, {institution.Location.lng.toFixed(5)}
                    {institution.Service_Radius_Km ? ` · Raio: ${institution.Service_Radius_Km} km` : ''}
                  </p>
                  {institution.Coverage_Area && (
                    <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                      Área de cobertura: {institution.Coverage_Area}
                    </p>
                  )}
                  {institution.Needs_List && <p className="needs">Necessidades: {institution.Needs_List}</p>}
                  {status === 'rejected' && institution.Rejection_Reason && (
                    <p style={{ fontSize: 13, color: 'var(--color-danger, #b8433a)' }}>
                      Motivo: {institution.Rejection_Reason}
                    </p>
                  )}
                </div>
              </div>

              {status === 'pending' &&
                (rejectingId === institution.Institution_ID ? (
                  <div className="stack">
                    <Input
                      label="Motivo da rejeição"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    {/* Inline, not just the page-top banner (institutions/page.tsx original) —
                        found live, 2026-08-06: a validation error rendered only at the top of
                        the page was invisible when this form is deep in a long list. */}
                    {error && <div className="banner banner-error">{error}</div>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button
                        variant="danger"
                        onClick={() => onReject(institution.Institution_ID)}
                        disabled={busyId === institution.Institution_ID}
                      >
                        Confirmar rejeição
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setRejectingId(null);
                          setRejectReason('');
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      onClick={() => onApprove(institution.Institution_ID)}
                      disabled={busyId === institution.Institution_ID}
                    >
                      Aprovar
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => setRejectingId(institution.Institution_ID)}
                      disabled={busyId === institution.Institution_ID}
                    >
                      Rejeitar
                    </Button>
                  </div>
                ))}
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
