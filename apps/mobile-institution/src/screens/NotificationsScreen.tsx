import type { Notification } from '@wafina/shared';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import type { AppTabParamList } from '@/navigation/RootNavigator';
import { colors, fonts, spacing } from '@/theme/tokens';

type Props = BottomTabScreenProps<AppTabParamList, 'Notifications'>;

export function NotificationsScreen({ navigation }: Props) {
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
            prev?.map((x) => (x.Notification_ID === n.Notification_ID ? { ...x, Read: true } : x)) ?? null,
        );
      } catch {
        // Non-critical — still navigate even if marking read failed.
      }
    }
    navigation.navigate('ClaimedByMe');
  }

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Notificações</Text>
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {!error && notifications === null && <Text style={styles.loading}>A carregar…</Text>}
            {notifications?.length === 0 && (
              <EmptyState
                title="Sem notificações"
                description="Quando houver novidades, aparecem aqui."
              />
            )}
          </>
        }
        data={notifications ?? []}
        keyExtractor={(item) => item.Notification_ID}
        renderItem={({ item }) => (
          <Pressable style={styles.item} onPress={() => onOpen(item)}>
            {!item.Read && <View style={styles.dot} />}
            <View style={{ flex: 1 }}>
              <Text style={[styles.message, { color: item.Read ? colors.textMuted : colors.text }]}>
                {item.Message}
              </Text>
              <Text style={styles.time}>{new Date(item.Date_Created).toLocaleString()}</Text>
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
    fontFamily: 'WorkSans-400',
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
    fontFamily: 'WorkSans-400',
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
    fontFamily: 'WorkSans-400',
    fontSize: 14,
  },
  time: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textFaint,
    marginTop: spacing[1],
  },
});
