'use client';

import type { GeoRegion, Institution } from '@wafina/shared';
import { Button, Card, EmptyState, Input, Photo, useToast } from '@wafina/ui';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireAdminSession } from '@/context/AuthContext';
import { ApiError, apiFetch } from '@/lib/api';

export default function AdminInstitutionsPage() {
  const session = useRequireAdminSession();
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();

  const [institutions, setInstitutions] = useState<Institution[] | null>(null);
  const [countries, setCountries] = useState<GeoRegion[]>([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  async function load() {
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      const [pending, allCountries] = await Promise.all([
        apiFetch<Institution[]>('/admin/institutions/pending', { idToken }),
        apiFetch<GeoRegion[]>('/geo-regions/all-countries', { idToken }),
      ]);
      setInstitutions(pending);
      setCountries(allCountries);
    } catch {
      setError('Não foi possível carregar as instituições pendentes.');
    }
  }

  useEffect(() => {
    load();
  }, [firebaseUser]);

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
        <h1 style={{ fontSize: 24 }}>Instituições Pendentes</h1>
        {error && <div className="banner banner-error">{error}</div>}

        {institutions === null && !error && (
          <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>
        )}

        {institutions?.length === 0 && (
          <EmptyState
            title="Sem instituições pendentes"
            description="Quando uma instituição se registar, aparece aqui para revisão."
          />
        )}

        {institutions?.map((institution) => (
          <Card key={institution.Institution_ID} className="stack">
            <div className="institution-card" style={{ display: 'flex', gap: 12 }}>
              <Photo
                src={institution.Logo}
                placeholderIcon="🏢"
                style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
              />
              <div className="stack" style={{ gap: 2, flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: 16 }}>{institution.Name}</p>
                <p className="needs">
                  {institution.Type} · {countryName(institution.Country_ID)}
                </p>
                <p className="mono" style={{ fontSize: 11.5, color: 'var(--color-text-faint)' }}>
                  {institution.Institution_ID}
                </p>
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
              </div>
            </div>

            {rejectingId === institution.Institution_ID ? (
              <div className="stack">
                <Input
                  label="Motivo da rejeição"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
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
            )}
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
