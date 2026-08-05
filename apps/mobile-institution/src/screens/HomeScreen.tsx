import type { Donation, InstitutionDonationView, Notification, SuccessStory } from '@wafina/shared';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/Card';
import { useAuth } from '@/context/AuthContext';
import { useOwnInstitution } from '@/hooks/useOwnInstitution';
import { apiFetch } from '@/lib/api';
import { colors, fonts, spacing } from '@/theme/tokens';

function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

export function HomeScreen() {
  const { session, firebaseUser } = useAuth();
  const { institution } = useOwnInstitution();
  const insets = useSafeAreaInsets();
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

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}
    >
      <Text style={styles.title}>
        Bem-vindo(a){institution ? `, ${institution.Name}` : ''}
      </Text>
      <Card style={{ gap: spacing[2] }}>
        {/* Pilot feedback, 2026-08-05: the greeting above shows the
         * institution's own name, not the signed-in person's — this line is
         * the only place that ever did (or, for older accounts that never
         * set one via Settings, will once they do). */}
        {session?.name && <Text style={styles.name}>{session.name}</Text>}
        <Text style={styles.email}>{session?.email}</Text>
      </Card>

      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{stats.available ?? '—'}</Text>
          <Text style={styles.statLabel}>Doações disponíveis</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{stats.accepted ?? '—'}</Text>
          <Text style={styles.statLabel}>Aceites</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{stats.collectionsToday ?? '—'}</Text>
          <Text style={styles.statLabel}>Recolhas hoje</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{stats.deliveriesPending ?? '—'}</Text>
          <Text style={styles.statLabel}>Entregas pendentes</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{stats.storiesPublished ?? '—'}</Text>
          <Text style={styles.statLabel}>Histórias publicadas</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{stats.unreadNotifications ?? '—'}</Text>
          <Text style={styles.statLabel}>Notificações por ler</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{institution?.Total_Items_Received ?? '—'}</Text>
          <Text style={styles.statLabel}>Itens recebidos (total)</Text>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing[6],
    gap: spacing[4],
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
  },
  name: {
    fontFamily: 'WorkSans-600',
    fontSize: 15,
    color: colors.text,
  },
  email: {
    fontFamily: 'WorkSans-400',
    fontSize: 14,
    color: colors.textMuted,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  statCard: {
    minWidth: '30%',
    flexGrow: 1,
  },
  statValue: {
    fontFamily: 'WorkSans-700',
    fontSize: 28,
    color: colors.text,
  },
  statLabel: {
    fontFamily: 'WorkSans-400',
    fontSize: 12,
    color: colors.textMuted,
  },
});
