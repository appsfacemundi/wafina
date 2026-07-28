import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { colors, fonts, spacing } from '@/theme/tokens';

/** Matches the public projection GET /institutions returns for donors — not the full Institution shape. */
interface PublicInstitution {
  Institution_ID: string;
  Name: string;
  Logo: string | null;
  Type: string;
  Needs_List: string | null;
  Total_Items_Received: number;
}

export function InstitutionsScreen() {
  const { firebaseUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [institutions, setInstitutions] = useState<PublicInstitution[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        setInstitutions(await apiFetch<PublicInstitution[]>('/institutions', { idToken }));
      } catch {
        setError('Não foi possível carregar as instituições.');
      }
    })();
  }, [firebaseUser]);

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Instituições</Text>
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {!error && institutions === null && <Text style={styles.loading}>A carregar…</Text>}
            {institutions?.length === 0 && (
              <EmptyState
                title="Ainda sem instituições verificadas"
                description="As instituições aprovadas pelo Admin aparecem aqui."
              />
            )}
          </>
        }
        data={institutions ?? []}
        keyExtractor={(item) => item.Institution_ID}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text style={styles.name}>{item.Name}</Text>
            <Text style={styles.meta}>{item.Type.trim()}</Text>
            {item.Needs_List && <Text style={styles.meta}>Necessita: {item.Needs_List}</Text>}
            <Text style={styles.mono}>{item.Total_Items_Received} itens recebidos</Text>
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
  card: {
    marginBottom: spacing[3],
  },
  name: {
    fontFamily: 'WorkSans-600',
    fontSize: 16,
    color: colors.text,
  },
  meta: {
    fontFamily: 'WorkSans-400',
    fontSize: 13,
    color: colors.textMuted,
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    color: colors.textFaint,
  },
});
