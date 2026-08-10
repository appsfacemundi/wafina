import { formatDateTimeLabel, type SuccessStory, type SuccessStoryStatus } from '@wafina/shared';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '@/components/Badge';
import { ErrorBanner } from '@/components/Banner';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';
import { colors, fonts, spacing } from '@/theme/tokens';

const STATUS_LABEL: Record<SuccessStoryStatus, string> = {
  Approved: 'Publicada',
  Pending: 'Pendente de aprovação',
  Rejected: 'Rejeitada',
};

const STATUS_TONE: Record<SuccessStoryStatus, 'success' | 'warning' | 'danger'> = {
  Approved: 'success',
  Pending: 'warning',
  Rejected: 'danger',
};

type Filter = 'all' | SuccessStoryStatus;
const FILTERS: Filter[] = ['all', 'Approved', 'Pending', 'Rejected'];

export function MySuccessStoriesScreen() {
  const { firebaseUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [stories, setStories] = useState<SuccessStory[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  // Real-device finding, 2026-08-04: only fetched once on mount — an Admin
  // approval/rejection never showed up here without a full app restart.
  useFocusEffect(
    useCallback(() => {
      if (!firebaseUser) return;
      (async () => {
        try {
          const idToken = await firebaseUser.getIdToken();
          setStories(await apiFetch<SuccessStory[]>('/success-stories/mine', { idToken }));
        } catch (err) {
          setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as histórias.');
        }
      })();
    }, [firebaseUser]),
  );

  const filtered = useMemo(() => {
    if (!stories) return stories;
    if (filter === 'all') return stories;
    return stories.filter((s) => s.Status === filter);
  }, [stories, filter]);

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Histórias de Impacto</Text>
            <View style={styles.filterRow}>
              {FILTERS.map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setFilter(f)}
                  style={[styles.filterChip, filter === f && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                    {f === 'all' ? 'Todas' : STATUS_LABEL[f]}
                  </Text>
                </Pressable>
              ))}
            </View>
            {error ? <ErrorBanner message={error} /> : null}
            {!error && stories === null && <Text style={styles.loading}>A carregar…</Text>}
            {filtered?.length === 0 && (
              <EmptyState
                title="Sem histórias"
                description="Publique uma história de impacto a partir de uma doação entregue."
                icon="heart-outline"
              />
            )}
          </>
        }
        data={filtered ?? []}
        keyExtractor={(item) => item.Success_Story_ID}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Image source={{ uri: item.Image }} style={styles.photo} resizeMode="contain" />
            <View style={styles.cardBody}>
              <View style={styles.rowBetween}>
                <Text style={styles.storyTitle}>{item.Title}</Text>
                <Badge tone={STATUS_TONE[item.Status]}>{STATUS_LABEL[item.Status]}</Badge>
              </View>
              <Text style={styles.description}>{item.Description}</Text>
              {item.Status === 'Rejected' && item.Rejection_Reason && (
                <Text style={styles.rejectionReason}>Motivo da rejeição: {item.Rejection_Reason}</Text>
              )}
              <Text style={styles.dateLabel}>
                {item.Status === 'Approved' ? 'Publicada' : 'Enviada'} em {formatDateTimeLabel(item.Date_Published)}
              </Text>
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterChipText: {
    fontFamily: 'Manrope-600',
    fontSize: 12,
    color: colors.textMuted,
  },
  filterChipTextActive: {
    color: colors.accentText,
  },
  loading: {
    fontFamily: 'Manrope-400',
    fontSize: 14,
    color: colors.textMuted,
  },
  card: {
    padding: 0,
    overflow: 'hidden',
    gap: 0,
    marginBottom: spacing[3],
  },
  photo: {
    width: '100%',
    height: 160,
    backgroundColor: colors.surface2,
  },
  cardBody: {
    padding: spacing[4],
    gap: 6,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  storyTitle: {
    fontFamily: 'Manrope-700',
    fontSize: 16.5,
    color: colors.text,
  },
  description: {
    fontFamily: 'Manrope-400',
    fontSize: 13.5,
    color: colors.textMuted,
  },
  rejectionReason: {
    fontFamily: 'Manrope-400',
    fontSize: 13,
    color: colors.danger,
  },
  dateLabel: {
    fontFamily: 'Manrope-400',
    fontSize: 12,
    color: colors.textFaint,
  },
});
