import type { Donation } from '@wafina/shared';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';
import { colors, fonts, spacing } from '@/theme/tokens';

export function AvailableDonationsScreen() {
  const { firebaseUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [donations, setDonations] = useState<Donation[] | null>(null);
  const [error, setError] = useState('');
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  async function load() {
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      setDonations(await apiFetch<Donation[]>('/donations/available', { idToken }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as doações.');
    }
  }

  useEffect(() => {
    load();
  }, [firebaseUser]);

  const filtered = useMemo(() => {
    if (!donations) return donations;
    const q = query.trim().toLowerCase();
    if (!q) return donations;
    return donations.filter(
      (d) => d.Item_Type.toLowerCase().includes(q) || d.Condition.toLowerCase().includes(q),
    );
  }, [donations, query]);

  async function onClaim(donationId: string) {
    setClaimingId(donationId);
    setError('');
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/donations/${donationId}/claim`, { method: 'POST', idToken });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível reclamar a doação.');
    } finally {
      setClaimingId(null);
    }
  }

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Doações Disponíveis</Text>
            {donations && donations.length > 0 && (
              <Input label="Filtrar" placeholder="Tipo ou estado…" value={query} onChangeText={setQuery} />
            )}
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {!error && donations === null && <Text style={styles.loading}>A carregar…</Text>}
            {donations?.length === 0 && (
              <EmptyState
                title="Sem doações disponíveis"
                description="Quando houver doações pendentes, aparecem aqui."
              />
            )}
            {donations && donations.length > 0 && filtered?.length === 0 && (
              <EmptyState title="Sem resultados" description="Nenhuma doação corresponde ao filtro." />
            )}
          </>
        }
        data={filtered ?? []}
        keyExtractor={(item) => item.Donation_ID}
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemType}>{item.Item_Type}</Text>
              <Text style={styles.mono}>
                {item.Donation_ID} · Qtd {item.Quantity} · {item.Condition}
              </Text>
            </View>
            <Button onPress={() => onClaim(item.Donation_ID)} disabled={claimingId === item.Donation_ID}>
              {claimingId === item.Donation_ID ? 'A reclamar…' : 'Reclamar'}
            </Button>
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
    marginBottom: spacing[3],
    gap: spacing[3],
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
