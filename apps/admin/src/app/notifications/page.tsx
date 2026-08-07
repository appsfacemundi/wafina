'use client';

import type { GeoRegion, Notification } from '@wafina/shared';
import { Button, Card, EmptyState, Input, Select, useToast } from '@wafina/ui';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireAdminSession } from '@/context/AuthContext';
import { ApiError, apiFetch } from '@/lib/api';

const ROLE_OPTIONS = [
  { label: 'Qualquer tipo de conta', value: '' },
  { label: 'Doadores', value: 'Donor' },
  { label: 'Instituições', value: 'Institution' },
];

export default function AdminNotificationsPage() {
  const session = useRequireAdminSession();
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();

  const [countries, setCountries] = useState<GeoRegion[]>([]);
  const [sent, setSent] = useState<Notification[] | null>(null);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [singleMessage, setSingleMessage] = useState('');
  const [sendingSingle, setSendingSingle] = useState(false);

  const [role, setRole] = useState('');
  const [countryId, setCountryId] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  async function load() {
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      const [countryList, sentList] = await Promise.all([
        apiFetch<GeoRegion[]>('/geo-regions/all-countries', { idToken }),
        apiFetch<Notification[]>('/admin/notifications/sent', { idToken }),
      ]);
      setCountries(countryList);
      setSent(sentList);
    } catch {
      setError('Não foi possível carregar os dados.');
    }
  }

  useEffect(() => {
    load();
  }, [firebaseUser]);

  async function onSendSingle() {
    if (!email.trim() || !singleMessage.trim()) {
      setError('Indique o email e a mensagem.');
      return;
    }
    setError('');
    setSendingSingle(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/admin/notifications/send', {
        method: 'POST',
        idToken,
        body: { email, message: singleMessage },
      });
      setEmail('');
      setSingleMessage('');
      await load();
      showToast('Notificação enviada.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar a notificação.');
    } finally {
      setSendingSingle(false);
    }
  }

  async function onBroadcast() {
    if (!role && !countryId) {
      setError('Escolha pelo menos um filtro (tipo de conta ou país).');
      return;
    }
    if (!broadcastMessage.trim()) {
      setError('Indique a mensagem.');
      return;
    }
    setError('');
    setBroadcasting(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      const result = await apiFetch<{ sentCount: number }>('/admin/notifications/broadcast', {
        method: 'POST',
        idToken,
        body: { role: role || undefined, countryId: countryId || undefined, message: broadcastMessage },
      });
      setBroadcastMessage('');
      await load();
      showToast(`Anúncio enviado a ${result.sentCount} utilizador${result.sentCount === 1 ? '' : 'es'}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o anúncio.');
    } finally {
      setBroadcasting(false);
    }
  }

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Notificações</h1>
        {error && <div className="banner banner-error">{error}</div>}

        <Card className="stack">
          <p style={{ fontWeight: 700, fontSize: 15 }}>Enviar a um utilizador</p>
          <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
            Envia uma notificação dentro da aplicação — não é um email. O utilizador vê-a na sua
            própria conta Wafina, em "Notificações".
          </p>
          <Input
            label="Email do utilizador (para localizar a conta)"
            hint="Usado apenas para encontrar a conta — a mensagem não é enviada por email."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input label="Mensagem" value={singleMessage} onChange={(e) => setSingleMessage(e.target.value)} />
          <Button onClick={onSendSingle} disabled={sendingSingle}>
            {sendingSingle ? 'A enviar…' : 'Enviar'}
          </Button>
        </Card>

        <Card className="stack">
          <p style={{ fontWeight: 700, fontSize: 15 }}>Anúncio (difusão)</p>
          <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>
            Escolha pelo menos um filtro — nunca envia a todos os utilizadores de uma só vez.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Select label="Tipo de conta" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            <Select label="País" value={countryId} onChange={(e) => setCountryId(e.target.value)}>
              <option value="">Qualquer país</option>
              {countries.map((c) => (
                <option key={c.Region_ID} value={c.Region_ID}>
                  {c.Name}
                </option>
              ))}
            </Select>
          </div>
          <Input label="Mensagem" value={broadcastMessage} onChange={(e) => setBroadcastMessage(e.target.value)} />
          <Button onClick={onBroadcast} disabled={broadcasting}>
            {broadcasting ? 'A enviar…' : 'Enviar anúncio'}
          </Button>
        </Card>

        <div className="stack">
          <p style={{ fontWeight: 700, fontSize: 15 }}>Histórico de mensagens enviadas</p>
          {sent === null && !error && <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>}
          {sent?.length === 0 && (
            <EmptyState title="Sem mensagens enviadas" description="Mensagens manuais e anúncios aparecem aqui." icon="bell" />
          )}
          {sent && sent.length > 0 && (
            <div className="stack">
              {sent.map((n) => (
                <Card key={n.Notification_ID} className="stack" style={{ gap: 4 }}>
                  <p style={{ fontSize: 13.5 }}>{n.Message}</p>
                  <p style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>{n.Created_At}</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
