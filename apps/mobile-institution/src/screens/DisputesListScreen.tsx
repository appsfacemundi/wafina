import { formatDateTimeLabel, type Dispute, type InstitutionDonationView } from '@wafina/shared';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';
import { colors, fonts, spacing } from '@/theme/tokens';

export function DisputesListScreen() {
  const { firebaseUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [disputes, setDisputes] = useState<Dispute[] | null>(null);
  const [codeByDonationId, setCodeByDonationId] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState('');

  // Real-device finding, 2026-08-04: only fetched once on mount — an Admin
  // resolution never showed up here without a full app restart.
  useFocusEffect(
    useCallback(() => {
      if (!firebaseUser) return;
      (async () => {
        try {
          const idToken = await firebaseUser.getIdToken();
          const [disputeList, donations] = await Promise.all([
            apiFetch<Dispute[]>('/disputes/mine', { idToken }),
            apiFetch<InstitutionDonationView[]>('/donations/claimed-by-me', { idToken }),
          ]);
          setDisputes(disputeList);
          setCodeByDonationId(new Map(donations.map((d) => [d.Donation_ID, d.Public_Donation_Code])));
        } catch (err) {
          setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as ocorrências.');
        }
      })();
    }, [firebaseUser]),
  );

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>As Minhas Ocorrências</Text>
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {!error && disputes === null && <Text style={styles.loading}>A carregar…</Text>}
            {disputes?.length === 0 && (
              <EmptyState
                title="Sem ocorrências"
                description="As ocorrências que comunicar sobre doações aparecem aqui."
                icon="alert-circle-outline"
              />
            )}
          </>
        }
        data={disputes ?? []}
        keyExtractor={(item) => item.Dispute_ID}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: spacing[3], gap: spacing[2] }}>
            <View style={styles.row}>
              <Text style={[styles.mono, styles.monoId]}>Doação {codeByDonationId.get(item.Donation_ID) ?? ''}</Text>
              <Badge tone={item.Status === 'Open' ? 'warning' : 'success'}>
                {item.Status === 'Open' ? 'Aberta' : 'Resolvida'}
              </Badge>
            </View>
            <Text style={styles.body}>{item.Issue_Description}</Text>
            {item.Resolution_Notes && <Text style={styles.hint}>Resposta: {item.Resolution_Notes}</Text>}
            <Text style={styles.time}>{formatDateTimeLabel(item.Date_Raised)}</Text>
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textFaint,
  },
  monoId: {
    flex: 1,
    flexWrap: 'wrap',
  },
  body: {
    fontFamily: 'Manrope-400',
    fontSize: 14,
    color: colors.text,
  },
  hint: {
    fontFamily: 'Manrope-400',
    fontSize: 13,
    color: colors.textMuted,
  },
  time: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textFaint,
  },
});
