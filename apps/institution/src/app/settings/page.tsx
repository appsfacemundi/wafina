'use client';

import { INSTITUTION_FIELD_LABELS } from '@wafina/shared';
import { Badge, Button, Card, Photo, Select, useToast } from '@wafina/ui';
import { useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { useOwnInstitution } from '@/hooks/useOwnInstitution';
import { apiFetch, ApiError } from '@/lib/api';

const MIN_REASON_LENGTH = 5;

export default function SettingsPage() {
  const session = useRequireSession();
  const { firebaseUser, signOutUser } = useAuth();
  const { institution, loading, refetch } = useOwnInstitution();
  const { showToast } = useToast();
  const reasonId = useId();

  const [field, setField] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [logoError, setLogoError] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (!field) {
      setError('Escolha o campo que pretende alterar.');
      return;
    }
    if (reason.trim().length < MIN_REASON_LENGTH) {
      setError(`Explique o motivo com pelo menos ${MIN_REASON_LENGTH} caracteres.`);
      return;
    }
    setSubmitting(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      const fieldLabel = INSTITUTION_FIELD_LABELS[field] ?? field;
      await apiFetch('/change-requests', {
        method: 'POST',
        idToken,
        body: { Field_Requested: field, Reason: reason },
      });
      setSuccess(true);
      setField('');
      setReason('');
      showToast(`O seu pedido de alteração de "${fieldLabel}" foi enviado ao Admin.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o pedido.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onUploadLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoError('');
    setUploadingLogo(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      const form = new FormData();
      form.append('logo', file);
      await apiFetch('/institutions/me/logo', { method: 'PATCH', idToken, body: form });
      await refetch();
      showToast('Logótipo atualizado com sucesso!');
    } catch (err) {
      setLogoError(err instanceof ApiError ? err.message : 'Não foi possível enviar o logótipo.');
    } finally {
      setUploadingLogo(false);
    }
  }

  // Real-device finding, 2026-08-07 — registration requires a Logo
  // (`createInstitution` throws if `!input.Logo`, apps/api/src/services/institutions.ts),
  // so a real institution can never be verified/locked without one already
  // set. Gating on `institution?.Logo` too means an institution that somehow
  // ended up locked with no logo anyway (e.g. force-verified test data,
  // bypassing registration) still gets the upload button instead of being
  // stuck behind a "locked" message for an asset that was never actually
  // there to lock. Same fix as mobile-institution's SettingsScreen.
  const logoLocked = (institution?.Locked_Fields.includes('Logo') ?? false) && Boolean(institution?.Logo);

  if (!session || loading) return null;

  return (
    <AppShell>
      <div className="stack" style={{ maxWidth: 480 }}>
        <h1 style={{ fontSize: 24 }}>Definições</h1>

        <Card className="stack">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Photo
              src={institution?.Logo}
              style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover' }}
            />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600 }}>{institution?.Name}</p>
              {institution?.Verified && <Badge tone="success">Verificado</Badge>}
            </div>
          </div>
          {logoLocked ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 12.5 }}>
              O logótipo está bloqueado. Peça uma alteração abaixo para o mudar.
            </p>
          ) : (
            <>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={onUploadLogo}
              />
              <Button
                variant="secondary"
                type="button"
                disabled={uploadingLogo}
                onClick={() => logoInputRef.current?.click()}
              >
                {uploadingLogo ? 'A enviar…' : institution?.Logo ? 'Alterar logótipo' : 'Adicionar logótipo'}
              </Button>
              {logoError && <div className="banner banner-error">{logoError}</div>}
            </>
          )}
          <p style={{ color: 'var(--color-text-muted)' }}>{session.email}</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Tipo: {institution?.Type}</p>
          {institution?.Needs_List && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
              Necessidades: {institution.Needs_List}
            </p>
          )}
        </Card>

        <Card className="stack">
          <h2 style={{ fontSize: 16 }}>Solicitar alteração</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
            O seu perfil está bloqueado após a verificação. Para alterar um campo, peça ao Admin.
          </p>
          <form className="stack" onSubmit={onSubmit}>
            <Select label="Campo" value={field} onChange={(e) => setField(e.target.value)}>
              <option value="">Selecione…</option>
              {(institution?.Locked_Fields ?? []).map((f) => (
                <option key={f} value={f}>
                  {INSTITUTION_FIELD_LABELS[f] ?? f}
                </option>
              ))}
            </Select>
            <div className="field">
              <label htmlFor={reasonId}>Motivo</label>
              <textarea
                id={reasonId}
                className="input"
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            {error && <div className="banner banner-error">{error}</div>}
            {success && <div className="banner banner-success">Pedido enviado ao Admin.</div>}
            <Button type="submit" fullWidth disabled={submitting}>
              {submitting ? 'A enviar…' : 'Enviar pedido'}
            </Button>
          </form>
        </Card>

        <Card className="stack">
          <p style={{ fontWeight: 600 }}>Eliminar conta</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
            Para solicitar a eliminação da sua conta e dos dados associados, consulte a nossa página
            de eliminação de conta.
          </p>
          <a
            href="https://wafina-donor-web.onrender.com/delete-account"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            style={{ textDecoration: 'none', textAlign: 'center' }}
          >
            Solicitar eliminação de conta
          </a>
        </Card>

        <Button variant="secondary" onClick={() => signOutUser()}>
          Sair
        </Button>
      </div>
    </AppShell>
  );
}
