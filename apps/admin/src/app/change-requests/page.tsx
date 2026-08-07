'use client';

import type { AdminChangeRequestView } from '@wafina/shared';
import { Button, Card, EmptyState, Input, Photo, useToast } from '@wafina/ui';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireAdminSession } from '@/context/AuthContext';
import { ApiError, apiFetch } from '@/lib/api';

export default function AdminChangeRequestsPage() {
  const session = useRequireAdminSession();
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();

  const [requests, setRequests] = useState<AdminChangeRequestView[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [newValue, setNewValue] = useState('');
  const [newLat, setNewLat] = useState('');
  const [newLng, setNewLng] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  async function load() {
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      setRequests(await apiFetch<AdminChangeRequestView[]>('/admin/change-requests/pending', { idToken }));
    } catch {
      setError('Não foi possível carregar os pedidos pendentes.');
    }
  }

  useEffect(() => {
    load();
  }, [firebaseUser]);

  async function onApprove(requestId: string, isLocation: boolean) {
    const value = isLocation ? `${newLat.trim()},${newLng.trim()}` : newValue.trim();
    if (isLocation ? !newLat.trim() || !newLng.trim() : !newValue.trim()) {
      setError(isLocation ? 'Indique latitude e longitude.' : 'Indique o novo valor a aplicar.');
      return;
    }
    setError('');
    setBusyId(requestId);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/admin/change-requests/${requestId}/approve`, {
        method: 'POST',
        idToken,
        body: { value },
      });
      setApprovingId(null);
      setNewValue('');
      setNewLat('');
      setNewLng('');
      await load();
      showToast('Pedido aprovado — a instituição foi notificada.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível aprovar o pedido.');
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(requestId: string) {
    if (!rejectReason.trim()) {
      setError('Indique o motivo da rejeição.');
      return;
    }
    setError('');
    setBusyId(requestId);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/admin/change-requests/${requestId}/reject`, {
        method: 'POST',
        idToken,
        body: { reason: rejectReason },
      });
      setRejectingId(null);
      setRejectReason('');
      await load();
      showToast('Pedido rejeitado.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível rejeitar o pedido.');
    } finally {
      setBusyId(null);
    }
  }

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Pedidos de Alteração Pendentes</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
          Instituições pedem para alterar um campo bloqueado do perfil. Aprove para aplicar o novo valor, ou rejeite com um motivo.
        </p>
        {error && <div className="banner banner-error">{error}</div>}
        {requests === null && !error && <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>}
        {requests?.length === 0 && (
          <EmptyState
            title="Sem pedidos pendentes"
            description="Quando uma instituição pedir para alterar um campo bloqueado, aparece aqui para revisão."
            icon="refresh"
          />
        )}
        {requests && requests.length > 0 && (
          <div className="stack">
            {requests.map((request) => (
              <Card key={request.Request_ID} className="stack" style={{ gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Photo
                    src={request.Institution_Logo}
                    placeholderIcon="🏢"
                    style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }}
                  />
                  <p style={{ fontWeight: 700, fontSize: 15 }}>{request.Institution_Name ?? 'Instituição'}</p>
                </div>
                <p style={{ fontSize: 13.5 }}>
                  Campo: <strong>{request.Field_Label}</strong>
                </p>
                <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>{request.Reason}</p>

                {approvingId === request.Request_ID ? (
                  <div className="stack">
                    {request.Field_Requested === 'Location' ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Input
                          label="Latitude"
                          type="number"
                          value={newLat}
                          onChange={(e) => setNewLat(e.target.value)}
                        />
                        <Input
                          label="Longitude"
                          type="number"
                          value={newLng}
                          onChange={(e) => setNewLng(e.target.value)}
                        />
                      </div>
                    ) : (
                      <Input
                        label="Novo valor"
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                      />
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button
                        onClick={() => onApprove(request.Request_ID, request.Field_Requested === 'Location')}
                        disabled={busyId === request.Request_ID}
                      >
                        {busyId === request.Request_ID ? 'A aprovar…' : 'Confirmar aprovação'}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setApprovingId(null);
                          setNewValue('');
                          setNewLat('');
                          setNewLng('');
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : rejectingId === request.Request_ID ? (
                  <div className="stack">
                    <Input
                      label="Motivo da rejeição"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button
                        variant="danger"
                        onClick={() => onReject(request.Request_ID)}
                        disabled={busyId === request.Request_ID}
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
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <Button onClick={() => setApprovingId(request.Request_ID)} disabled={busyId === request.Request_ID}>
                      Aprovar
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => setRejectingId(request.Request_ID)}
                      disabled={busyId === request.Request_ID}
                    >
                      Rejeitar
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
