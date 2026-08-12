import { formatDateTimeLabel, type Notification } from '@wafina/shared';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import type { AppTabParamList } from '@/navigation/RootNavigator';
import { colors, fonts, spacing } from '@/theme/tokens';

type Props = BottomTabScreenProps<AppTabParamList, 'Notifications'>;

export function NotificationsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { firebaseUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        setNotifications(await apiFetch<Notification[]>('/notifications', { idToken }));
      } catch {
        setError(t('notifications.loadError'));
      }
    })();
  }, [firebaseUser, t]);

  // Phase 3A Module 2 — real per-notification deep-linking, using Entity_Type
  // now that it exists, instead of always navigating to the same fixed screen.
  // Institution App Polish QA review (2026-07-31) — expanded once a
  // dedicated donor Impact screen existed to link Success_Story notifications to.
  function navigateForEntity(n: Notification) {
    if (n.Entity_Type === 'Corporate_Account') {
      navigation.navigate('Settings');
      return;
    }
    if (n.Entity_Type === 'Success_Story') {
      navigation.navigate('Impact');
      return;
    }
    // Real-device finding, 2026-08-07 — 'Donation' notifications (claimed,
    // delivered) always dropped the donor at the top of the list with no
    // way to tell which item it was about. Passing Entity_ID lets
    // MyDonationsScreen scroll to and highlight that specific donation.
    navigation.navigate('MyDonations', n.Entity_Type === 'Donation' ? { donationId: n.Entity_ID } : undefined);
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
    navigateForEntity(n);
  }

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>{t('notifications.title')}</Text>
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {!error && notifications === null && <Text style={styles.loading}>{t('common.loading')}</Text>}
            {notifications?.length === 0 && (
              <EmptyState
                title={t('notifications.emptyTitle')}
                description={t('notifications.emptyDescription')}
                icon="notifications-outline"
              />
            )}
          </>
        }
        data={notifications ?? []}
        keyExtractor={(item) => item.Notification_ID}
        renderItem={({ item }) => (
          <Pressable style={styles.item} onPress={() => onOpen(item)}>
            {item.Status !== 'Read' && <View style={styles.dot} />}
            <View style={{ flex: 1 }}>
              <Text style={[styles.message, { color: item.Status === 'Read' ? colors.textMuted : colors.text }]}>
                {item.Message}
              </Text>
              <Text style={styles.time}>{formatDateTimeLabel(item.Created_At)}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing[6],
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
    marginBottom: spacing[4],
  },
  loading: {
    fontFamily: 'Manrope-400',
    fontSize: 14,
    color: colors.textMuted,
  },
  errorBanner: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 8,
    padding: spacing[3],
    marginBottom: spacing[4],
  },
  errorText: {
    fontFamily: 'Manrope-400',
    fontSize: 13,
    color: colors.danger,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginTop: 6,
  },
  message: {
    fontFamily: 'Manrope-400',
    fontSize: 14,
  },
  time: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textFaint,
    marginTop: spacing[1],
  },
});
