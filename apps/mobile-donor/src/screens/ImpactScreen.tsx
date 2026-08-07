import Ionicons from '@expo/vector-icons/Ionicons';
import { formatDateTimeLabel, type SuccessStory } from '@wafina/shared';
import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';
import { colors, fonts, spacing } from '@/theme/tokens';

// UX follow-up, 2026-08-07 — donors want to share a story to social media
// directly from its card. `Share.share()` opens the OS's native share sheet
// (WhatsApp, Instagram, X, etc. all register as targets there already) — no
// per-story public URL exists yet (only a general, non-deep-linkable
// `/impact` page on Donor Web), so this shares the story text itself rather
// than a link to it.
//
// RC1 note, 2026-08-07 — a version that downloaded the photo locally and
// shared it via `expo-sharing` (so the image itself, not just text, reached
// WhatsApp/Instagram) was tried and reverted: `expo-sharing` is a native
// module, and Expo Go on the test device couldn't resolve it even after a
// full reinstall/cache-clear cycle — resolving that needs an actual native
// rebuild, untestable through Expo Go. Reverted to unblock RC1; revisit
// once a real production/dev-client build exists to verify against.
async function onShareStory(story: SuccessStory) {
  try {
    await Share.share({
      title: `Wafina — ${story.Title}`,
      message: `${story.Title}\n\n${story.Description}\n\n— partilhado via Wafina`,
    });
  } catch {
    // Non-critical — the share sheet was likely just dismissed by the user.
  }
}

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
                icon="heart-outline"
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
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.storyTitle, { flex: 1 }]}>{item.Title}</Text>
                <Pressable
                  onPress={() => onShareStory(item)}
                  accessibilityRole="button"
                  accessibilityLabel="Partilhar história"
                  hitSlop={10}
                >
                  <Ionicons name="share-social-outline" size={20} color={colors.textMuted} />
                </Pressable>
              </View>
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
    fontFamily: 'Manrope-400',
    fontSize: 13.5,
    color: colors.textMuted,
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
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  storyTitle: {
    fontFamily: 'Manrope-700',
    fontSize: 17,
    color: colors.text,
  },
  description: {
    fontFamily: 'Manrope-400',
    fontSize: 14,
    color: colors.textMuted,
  },
  dateLabel: {
    fontFamily: 'Manrope-400',
    fontSize: 12,
    color: colors.textFaint,
  },
});
