'use client';

import type { Donation, InstitutionDonationView, Notification, SuccessStory } from '@wafina/shared';
import { Card } from '@wafina/ui';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { useOwnInstitution } from '@/hooks/useOwnInstitution';
import { apiFetch } from '@/lib/api';

/** yyyy-mm-dd for "today", compared against Expected_Collection_Date. */
function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function HomePage() {
  const session = useRequireSession();
  const { firebaseUser } = useAuth();
  const { institution } = useOwnInstitution();
  const [available, setAvailable] = useState<InstitutionDonationView[] | null>(null);
  const [claimedByMe, setClaimedByMe] = useState<InstitutionDonationView[] | null>(null);
  const [stories, setStories] = useState<SuccessStory[] | null>(null);
  const [notifications, setNotifications] = useState<Notification[] | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        const [availableList, claimedList, storyList, notificationList] = await Promise.all([
          apiFetch<InstitutionDonationView[]>('/donations/available', { idToken }),
          apiFetch<InstitutionDonationView[]>('/donations/claimed-by-me', { idToken }),
          apiFetch<SuccessStory[]>('/success-stories/mine', { idToken }),
          apiFetch<Notification[]>('/notifications', { idToken }),
        ]);
        setAvailable(availableList);
        setClaimedByMe(claimedList);
        setStories(storyList);
        setNotifications(notificationList);
      } catch {
        // Non-critical — the dashboard just shows "—" for whichever counts failed to load.
      }
    })();
  }, [firebaseUser]);

  const stats = useMemo(() => {
    const today = todayDateOnly();
    return {
      available: available?.length ?? null,
      accepted: claimedByMe ? claimedByMe.filter((d: Donation) => d.Status === 'Claimed').length : null,
      collectionsToday: claimedByMe
        ? claimedByMe.filter(
            (d: Donation) => d.Status === 'Collection_Scheduled' && d.Expected_Collection_Date?.slice(0, 10) === today,
          ).length
        : null,
      deliveriesPending: claimedByMe ? claimedByMe.filter((d: Donation) => d.Status === 'Collected').length : null,
      storiesPublished: stories?.length ?? null,
      unreadNotifications: notifications ? notifications.filter((n) => !n.Read_At).length : null,
    };
  }, [available, claimedByMe, stories, notifications]);

  if (!session) return null;

  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Bem-vindo(a){institution ? `, ${institution.Name}` : ''}</h1>
        <Card className="stack">
          <p style={{ color: 'var(--color-text-muted)' }}>{session.email}</p>
        </Card>

        <div className="stats-grid">
          <Card className="stack">
            <p style={{ fontSize: 28, fontWeight: 700 }}>{stats.available ?? '—'}</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Doações disponíveis</p>
          </Card>
          <Card className="stack">
            <p style={{ fontSize: 28, fontWeight: 700 }}>{stats.accepted ?? '—'}</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Aceites</p>
          </Card>
          <Card className="stack">
            <p style={{ fontSize: 28, fontWeight: 700 }}>{stats.collectionsToday ?? '—'}</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Recolhas hoje</p>
          </Card>
          <Card className="stack">
            <p style={{ fontSize: 28, fontWeight: 700 }}>{stats.deliveriesPending ?? '—'}</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Entregas pendentes</p>
          </Card>
          <Card className="stack">
            <p style={{ fontSize: 28, fontWeight: 700 }}>{stats.storiesPublished ?? '—'}</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Histórias publicadas</p>
          </Card>
          <Card className="stack">
            <p style={{ fontSize: 28, fontWeight: 700 }}>{stats.unreadNotifications ?? '—'}</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Notificações por ler</p>
          </Card>
          <Card className="stack">
            <p style={{ fontSize: 28, fontWeight: 700 }}>{institution?.Total_Items_Received ?? '—'}</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Itens recebidos (total)</p>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
