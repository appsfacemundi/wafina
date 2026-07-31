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

  // Phase 3A Module 2 — real per-notification deep-linking, using Entity_Type
  // now that it exists, instead of always navigating to the same fixed page.
  // Institution App Polish QA review (2026-07-31) — expanded once Success
  // Story approval and a dedicated donor Impact page existed to link to.
  function pathForEntity(n: Notification): string {
    switch (n.Entity_Type) {
      case 'Corporate_Account':
        return '/settings';
      case 'Success_Story':
        return '/impact';
      case 'Donation':
      default:
        return '/donations';
    }
  }

  async function onOpen(n: Notification) {
    if (n.Status !== 'Read') {
      try {
        const idToken = await firebaseUser?.getIdToken();
        await apiFetch(`/notifications/${n.Notification_ID}`, { method: 'PATCH', idToken });
        setNotifications(
          (prev) =>
            prev?.map((x) => (x.Notification_ID === n.Notification_ID ? { ...x, Status: 'Read' } : x)) ??
            null,
        );
      } catch {
        // Non-critical — still navigate even if marking read failed.
      }
    }
    router.push(pathForEntity(n));
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
            description="Quando houver novidades sobre as suas doações, aparecem aqui."
          />
        )}
        {notifications && notifications.length > 0 && (
          <div className="list">
            {notifications.map((n) => (
              <button key={n.Notification_ID} className="notif-item" onClick={() => onOpen(n)}>
                {n.Status !== 'Read' && <span className="notif-dot" />}
                <div className="grow" style={{ textAlign: 'left' }}>
                  <div
                    className="txt"
                    style={{ color: n.Status === 'Read' ? 'var(--color-text-muted)' : 'var(--color-text)' }}
                  >
                    {n.Message}
                  </div>
                  <div className="time">{new Date(n.Created_At).toLocaleString()}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
