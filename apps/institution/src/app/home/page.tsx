'use client';

import type { Donation, InstitutionDonationView, Notification, SuccessStory } from '@wafina/shared';
import { Card, Icon, type IconName } from '@wafina/ui';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { useOwnInstitution } from '@/hooks/useOwnInstitution';
import { apiFetch } from '@/lib/api';

/** yyyy-mm-dd for "today", compared against Expected_Collection_Date. */
function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

function StatCard({ icon, value, label }: { icon: IconName; value: number | null | undefined; label: string }) {
  return (
    <Card className="stack">
      <span className="stat-icon">
        <Icon name={icon} size={17} />
      </span>
      <p style={{ fontSize: 28, fontWeight: 700 }}>{value ?? '—'}</p>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{label}</p>
    </Card>
  );
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
          <StatCard icon="inbox" value={stats.available} label="Doações disponíveis" />
          <StatCard icon="check-circle" value={stats.accepted} label="Aceites" />
          <StatCard icon="truck" value={stats.collectionsToday} label="Recolhas hoje" />
          <StatCard icon="package" value={stats.deliveriesPending} label="Entregas pendentes" />
          <StatCard icon="heart" value={stats.storiesPublished} label="Histórias publicadas" />
          <StatCard icon="bell" value={stats.unreadNotifications} label="Notificações por ler" />
          <StatCard icon="gift" value={institution?.Total_Items_Received} label="Itens recebidos (total)" />
        </div>
      </div>
    </AppShell>
  );
}
