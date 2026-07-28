import { DONATION_STATUS_LABEL, DONATION_STATUS_TONE, type Donation } from '@wafina/shared';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { colors, fonts, spacing } from '@/theme/tokens';

export function MyDonationsScreen() {
  const { firebaseUser, session } = useAuth();
  const insets = useSafeAreaInsets();
  const [donations, setDonations] = useState<Donation[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        setDonations(await apiFetch<Donation[]>('/donations/mine', { idToken }));
      } catch {
        setError('Não foi possível carregar as suas doações.');
      }
    })();
  }, [firebaseUser]);

  const stats = useMemo(() => {
    if (!donations || !session?.corporateAccountId) return null;
    return {
      total: donations.length,
      quantity: donations.reduce((sum, d) => sum + d.Quantity, 0),
      pending: donations.filter((d) => d.Status === 'Pending').length,
      claimed: donations.filter((d) => d.Status === 'Claimed').length,
      delivered: donations.filter((d) => d.Status === 'Delivered').length,
    };
  }, [donations, session]);

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Minhas Doações</Text>
            {stats && (
              <View style={styles.statsGrid}>
                {[
                  ['Doações da empresa', stats.total],
                  ['Itens doados (total)', stats.quantity],
                  ['Pendentes', stats.pending],
                  ['Reclamadas', stats.claimed],
                  ['Entregues', stats.delivered],
                ].map(([label, value]) => (
                  <Card key={label as string} style={styles.statCard}>
                    <Text style={styles.statValue}>{value}</Text>
                    <Text style={styles.statLabel}>{label}</Text>
                  </Card>
                ))}
              </View>
            )}
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {!error && donations === null && <Text style={styles.loading}>A carregar…</Text>}
            {donations?.length === 0 && (
              <EmptyState
                title="Ainda sem doações"
                description="Quando submeter uma doação, o estado dela aparece aqui."
              />
            )}
          </>
        }
        data={donations ?? []}
        keyExtractor={(item) => item.Donation_ID}
        renderItem={({ item }) => (
          <Card style={styles.donationRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemType}>{item.Item_Type}</Text>
              <Text style={styles.donationId}>
                {item.Donation_ID} · Qtd {item.Quantity}
              </Text>
            </View>
            <Badge tone={DONATION_STATUS_TONE[item.Status]}>{DONATION_STATUS_LABEL[item.Status]}</Badge>
          </Card>
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
    gap: spacing[4],
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
    marginBottom: spacing[4],
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  statCard: {
    minWidth: '30%',
    flexGrow: 1,
  },
  statValue: {
    fontFamily: 'WorkSans-700',
    fontSize: 24,
    color: colors.text,
  },
  statLabel: {
    fontFamily: 'WorkSans-400',
    fontSize: 12,
    color: colors.textMuted,
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
  donationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  itemType: {
    fontFamily: 'WorkSans-600',
    fontSize: 15,
    color: colors.text,
  },
  donationId: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textFaint,
  },
});
