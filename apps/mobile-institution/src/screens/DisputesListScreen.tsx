import type { Dispute } from '@wafina/shared';
import { useEffect, useState } from 'react';
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
  const [error, setError] = useState('');

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        setDisputes(await apiFetch<Dispute[]>('/disputes/mine', { idToken }));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as disputas.');
      }
    })();
  }, [firebaseUser]);

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>As Minhas Disputas</Text>
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {!error && disputes === null && <Text style={styles.loading}>A carregar…</Text>}
            {disputes?.length === 0 && (
              <EmptyState
                title="Sem disputas"
                description="Os problemas que reportar sobre doações aparecem aqui."
              />
            )}
          </>
        }
        data={disputes ?? []}
        keyExtractor={(item) => item.Dispute_ID}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: spacing[3], gap: spacing[2] }}>
            <View style={styles.row}>
              <Text style={styles.mono}>Doação {item.Donation_ID}</Text>
              <Badge tone={item.Status === 'Open' ? 'warning' : 'success'}>
                {item.Status === 'Open' ? 'Aberta' : 'Resolvida'}
              </Badge>
            </View>
            <Text style={styles.body}>{item.Issue_Description}</Text>
            {item.Resolution_Notes && <Text style={styles.hint}>Resposta: {item.Resolution_Notes}</Text>}
            <Text style={styles.time}>{new Date(item.Date_Raised).toLocaleString('pt-PT')}</Text>
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textFaint,
  },
  body: {
    fontFamily: 'WorkSans-400',
    fontSize: 14,
    color: colors.text,
  },
  hint: {
    fontFamily: 'WorkSans-400',
    fontSize: 13,
    color: colors.textMuted,
  },
  time: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textFaint,
  },
});
