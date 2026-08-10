import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { Donation, InstitutionDonationView, Notification, SuccessStory } from '@wafina/shared';
import type { ComponentProps } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/Card';
import { useAuth } from '@/context/AuthContext';
import { useOwnInstitution } from '@/hooks/useOwnInstitution';
import { apiFetch } from '@/lib/api';
import type { AppTabParamList } from '@/navigation/RootNavigator';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

type IoniconName = ComponentProps<typeof Ionicons>['name'];
type Props = BottomTabScreenProps<AppTabParamList, 'Home'>;

function StatCard({ icon, value, label }: { icon: IoniconName; value: number | null; label: string }) {
  return (
    <Card style={styles.statCard}>
      <View style={styles.statIconWrap}>
        <Ionicons name={icon} size={16} color={colors.accent} />
      </View>
      <Text style={styles.statValue}>{value ?? '—'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

export function HomeScreen({ navigation }: Props) {
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

      <Pressable
        onPress={() => navigation.navigate('AvailableDonations')}
        accessibilityRole="button"
        accessibilityLabel="Receber Doações"
        style={({ pressed }) => [styles.ctaCard, pressed && styles.ctaCardPressed]}
      >
        <View style={styles.ctaIconWrap}>
          <Ionicons name="gift" size={22} color={colors.accentText} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.ctaTitle}>Receber Doações</Text>
          <Text style={styles.ctaSubtitle}>
            {session?.role === 'Animal_Shelter'
              ? 'Encontre doações disponíveis para o seu abrigo'
              : 'Encontre doações disponíveis para a sua instituição'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.accentText} />
      </Pressable>

      <View style={styles.statsGrid}>
        <StatCard
          icon="file-tray-outline"
          value={stats.available}
          label={session?.role === 'Animal_Shelter' ? 'Doações para abrigos' : 'Doações disponíveis'}
        />
        <StatCard icon="checkmark-circle-outline" value={stats.accepted} label="Aceites" />
        <StatCard icon="car-outline" value={stats.collectionsToday} label="Recolhas hoje" />
        <StatCard icon="cube-outline" value={stats.deliveriesPending} label="Entregas pendentes" />
        <StatCard icon="heart-outline" value={stats.storiesPublished} label="Histórias publicadas" />
        <StatCard icon="notifications-outline" value={stats.unreadNotifications} label="Notificações por ler" />
        <StatCard icon="gift-outline" value={institution?.Total_Items_Received ?? null} label="Itens recebidos (total)" />
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
    fontFamily: 'Manrope-600',
    fontSize: 15,
    color: colors.text,
  },
  email: {
    fontFamily: 'Manrope-400',
    fontSize: 14,
    color: colors.textMuted,
  },
  ctaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    padding: spacing[4],
  },
  ctaCardPressed: {
    opacity: 0.85,
  },
  ctaIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.accentText,
  },
  ctaSubtitle: {
    fontFamily: 'Manrope-400',
    fontSize: 12.5,
    color: colors.accentText,
    opacity: 0.9,
    marginTop: 2,
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
  statIconWrap: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[1],
  },
  statValue: {
    fontFamily: 'Manrope-700',
    fontSize: 28,
    color: colors.text,
  },
  statLabel: {
    fontFamily: 'Manrope-400',
    fontSize: 12,
    color: colors.textMuted,
  },
});
