import type { Donation } from '@wafina/shared';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/Card';
import { useAuth } from '@/context/AuthContext';
import { useOwnInstitution } from '@/hooks/useOwnInstitution';
import { apiFetch } from '@/lib/api';
import { colors, fonts, spacing } from '@/theme/tokens';

export function HomeScreen() {
  const { session, firebaseUser } = useAuth();
  const { institution } = useOwnInstitution();
  const insets = useSafeAreaInsets();
  const [donations, setDonations] = useState<Donation[] | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        setDonations(await apiFetch<Donation[]>('/donations/claimed-by-me', { idToken }));
      } catch {
        setDonations(null);
      }
    })();
  }, [firebaseUser]);

  const stats = useMemo(() => {
    if (!donations) return null;
    return {
      claimed: donations.filter((d) => d.Status === 'Claimed').length,
      delivered: donations.filter((d) => d.Status === 'Delivered').length,
    };
  }, [donations]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}
    >
      <Text style={styles.title}>
        Bem-vindo(a){institution ? `, ${institution.Name}` : ''}
      </Text>
      <Card style={{ gap: spacing[2] }}>
        <Text style={styles.email}>{session?.email}</Text>
      </Card>

      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{institution?.Total_Items_Received ?? '—'}</Text>
          <Text style={styles.statLabel}>Itens recebidos (total)</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{stats ? stats.claimed : '—'}</Text>
          <Text style={styles.statLabel}>Aceites por entregar</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{stats ? stats.delivered : '—'}</Text>
          <Text style={styles.statLabel}>Doações entregues</Text>
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
