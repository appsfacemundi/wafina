'use client';

import type { Notification } from '@wafina/shared';
import { EmptyState } from '@wafina/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';

export default function NotificationsPage() {
  const session = useRequireSession();
  const { firebaseUser } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        setNotifications(await apiFetch<Notification[]>('/notifications', { idToken }));
      } catch {
        setError('Não foi possível carregar as notificações.');
      }
    })();
  }, [firebaseUser]);

  async function onOpen(n: Notification) {
    if (!n.Read) {
      try {
        const idToken = await firebaseUser?.getIdToken();
        await apiFetch(`/notifications/${n.Notification_ID}`, { method: 'PATCH', idToken });
        setNotifications(
          (prev) =>
            prev?.map((x) => (x.Notification_ID === n.Notification_ID ? { ...x, Read: true } : x)) ??
            null,
        );
      } catch {
        // Non-critical — still navigate even if marking read failed.
      }
    }
    router.push('/donations/claimed');
  }

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Notificações</h1>
        {error && <div className="banner banner-error">{error}</div>}
        {!error && notifications === null && (
          <p style={{ color: 'var(--color-text-muted)' }}>A carregar…</p>
        )}
        {notifications?.length === 0 && (
          <EmptyState
            title="Sem notificações"
            description="Quando houver novidades sobre as doações, aparecem aqui."
          />
        )}
        {notifications && notifications.length > 0 && (
          <div className="list">
            {notifications.map((n) => (
              <button key={n.Notification_ID} className="notif-item" onClick={() => onOpen(n)}>
                {!n.Read && <span className="notif-dot" />}
                <div className="grow" style={{ textAlign: 'left' }}>
                  <div
                    className="txt"
                    style={{ color: n.Read ? 'var(--color-text-muted)' : 'var(--color-text)' }}
                  >
                    {n.Message}
                  </div>
                  <div className="time">{new Date(n.Date_Created).toLocaleString('pt-PT')}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
