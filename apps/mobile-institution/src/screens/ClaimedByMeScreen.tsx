import { DONATION_STATUS_LABEL, DONATION_STATUS_TONE, type Donation } from '@wafina/shared';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';
import type { AppTabParamList } from '@/navigation/RootNavigator';
import { colors, fonts, spacing } from '@/theme/tokens';

type Props = BottomTabScreenProps<AppTabParamList, 'ClaimedByMe'>;

export function ClaimedByMeScreen({ navigation }: Props) {
  const { firebaseUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [donations, setDonations] = useState<Donation[] | null>(null);
  const [error, setError] = useState('');
  const [deliveringId, setDeliveringId] = useState<string | null>(null);

  async function load() {
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      setDonations(await apiFetch<Donation[]>('/donations/claimed-by-me', { idToken }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as doações.');
    }
  }

  useEffect(() => {
    load();
  }, [firebaseUser]);

  async function onDeliver(donationId: string) {
    setDeliveringId(donationId);
    setError('');
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/donations/${donationId}/deliver`, { method: 'POST', idToken });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível confirmar a entrega.');
    } finally {
      setDeliveringId(null);
    }
  }

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Reclamadas por Mim</Text>
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {!error && donations === null && <Text style={styles.loading}>A carregar…</Text>}
            {donations?.length === 0 && (
              <EmptyState
                title="Ainda sem doações reclamadas"
                description="As doações que reclamar aparecem aqui."
              />
            )}
          </>
        }
        data={donations ?? []}
        keyExtractor={(item) => item.Donation_ID}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: spacing[3], gap: spacing[2] }}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemType}>{item.Item_Type}</Text>
                <Text style={styles.mono}>
                  {item.Donation_ID} · Qtd {item.Quantity}
                </Text>
              </View>
              <Badge tone={DONATION_STATUS_TONE[item.Status]}>{DONATION_STATUS_LABEL[item.Status]}</Badge>
            </View>
            <View style={styles.actions}>
              {item.Status === 'Claimed' && (
                <Button
                  variant="secondary"
                  onPress={() => onDeliver(item.Donation_ID)}
                  disabled={deliveringId === item.Donation_ID}
                >
                  {deliveringId === item.Donation_ID ? 'A confirmar…' : 'Confirmar entrega'}
                </Button>
              )}
              <Button
                variant="ghost"
                onPress={() =>
                  navigation.navigate('Disputes', {
                    screen: 'NewDispute',
                    params: { donationId: item.Donation_ID },
                  })
                }
              >
                Reportar problema
              </Button>
            </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  itemType: {
    fontFamily: 'WorkSans-600',
    fontSize: 15,
    color: colors.text,
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textFaint,
  },
});
