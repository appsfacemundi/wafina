import { formatDateTimeLabel, type SuccessStory } from '@wafina/shared';
import { useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';
import { colors, fonts, spacing } from '@/theme/tokens';

/**
 * Institution App Polish QA review (2026-07-31) — a dedicated Impact section
 * had been missing on mobile too; donors could only see a story mentioned
 * inline on the one donation card it belonged to.
 */
export function ImpactScreen() {
  const { firebaseUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [stories, setStories] = useState<SuccessStory[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        setStories(await apiFetch<SuccessStory[]>('/donor/success-stories', { idToken }));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as histórias de impacto.');
      }
    })();
  }, [firebaseUser]);

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Histórias de Impacto</Text>
            <Text style={styles.subtitle}>
              Veja o impacto real das suas doações, partilhado pelas instituições que as receberam.
            </Text>
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {!error && stories === null && <Text style={styles.loading}>A carregar…</Text>}
            {stories?.length === 0 && (
              <EmptyState
                title="Ainda sem histórias"
                description="Quando uma instituição partilhar o impacto de uma das suas doações, aparece aqui."
              />
            )}
          </>
        }
        data={stories ?? []}
        keyExtractor={(item) => item.Success_Story_ID}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Image source={{ uri: item.Image }} style={styles.photo} />
            <View style={styles.cardBody}>
              <Text style={styles.storyTitle}>{item.Title}</Text>
              <Text style={styles.description}>{item.Description}</Text>
              <Text style={styles.dateLabel}>Publicada em {formatDateTimeLabel(item.Date_Published)}</Text>
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
    marginBottom: spacing[2],
  },
  subtitle: {
    fontFamily: 'WorkSans-400',
    fontSize: 13.5,
    color: colors.textMuted,
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
    padding: 0,
    overflow: 'hidden',
    gap: 0,
    marginBottom: spacing[3],
  },
  photo: {
    width: '100%',
    height: 200,
  },
  cardBody: {
    padding: spacing[4],
    gap: 6,
  },
  storyTitle: {
    fontFamily: 'WorkSans-700',
    fontSize: 17,
    color: colors.text,
  },
  description: {
    fontFamily: 'WorkSans-400',
    fontSize: 14,
    color: colors.textMuted,
  },
  dateLabel: {
    fontFamily: 'WorkSans-400',
    fontSize: 12,
    color: colors.textFaint,
  },
});
