'use client';

import { Badge, Button, Card, Select } from '@wafina/ui';
import { useId, useState, type FormEvent } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { useOwnInstitution } from '@/hooks/useOwnInstitution';
import { apiFetch, ApiError } from '@/lib/api';

const MIN_REASON_LENGTH = 5;

const FIELD_LABEL: Record<string, string> = {
  Name: 'Nome',
  Type: 'Tipo',
  Location: 'Localização',
  Needs_List: 'Lista de necessidades',
  Logo: 'Logótipo',
};

export default function SettingsPage() {
  const session = useRequireSession();
  const { firebaseUser, signOutUser } = useAuth();
  const { institution, loading } = useOwnInstitution();
  const reasonId = useId();

  const [field, setField] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      await apiFetch('/change-requests', {
        method: 'POST',
        idToken,
        body: { Field_Requested: field, Reason: reason },
      });
      setSuccess(true);
      setField('');
      setReason('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o pedido.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!session || loading) return null;

  return (
    <AppShell>
      <div className="stack" style={{ maxWidth: 480 }}>
        <h1 style={{ fontSize: 24 }}>Definições</h1>

        <Card className="stack">
          <p style={{ fontWeight: 600 }}>{institution?.Name}</p>
          <p style={{ color: 'var(--color-text-muted)' }}>{session.email}</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Tipo: {institution?.Type}</p>
          {institution?.Needs_List && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
              Necessidades: {institution.Needs_List}
            </p>
          )}
          {institution?.Verified && <Badge tone="success">Verificado</Badge>}
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
                  {FIELD_LABEL[f] ?? f}
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

        <Button variant="secondary" onClick={() => signOutUser()}>
          Sair
        </Button>
      </div>
    </AppShell>
  );
}
