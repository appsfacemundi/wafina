import Ionicons from '@expo/vector-icons/Ionicons';
import { formatDateTimeLabel, type SuccessStory } from '@wafina/shared';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { apiFetch, ApiError } from '@/lib/api';
import i18n from '@/i18n';
import { colors, fonts, spacing } from '@/theme/tokens';

// UX follow-up, 2026-08-07 — donors want to share a story to social media
// directly from its card.
//
// RC1 note, 2026-08-07 — an `expo-sharing` version (image itself, not just
// text, reaching WhatsApp/Instagram) was tried and reverted: it's a native
// module Expo Go couldn't resolve, untestable without a real build. Revisited
// 2026-08-12 against an actual local production build — confirmed working.
//
// Bug fix, 2026-08-12 — live-tested against a real WhatsApp send: the OS
// share intent only carries one payload type into an arbitrary third-party
// app, so the caption text never showed up alongside the shared photo (a
// platform limit, not something either API's options can work around). Fixed
// by burning the caption into the shared image itself via a hidden
// `react-native-view-shot` snapshot — the text is now part of the picture,
// so it survives no matter which app the photo lands in.
//
// Bug fix, 2026-08-08 — `Share.share()` only resolves on dismiss (both
// platforms), it never throws for that case; a rejection here is always a
// genuine failure (e.g. no share target registered on the device). The
// previous empty catch silently ate those too, so a real failure looked
// identical to nothing happening — surface it via a toast instead.
async function shareStoryTextOnly(story: SuccessStory) {
  // Title/Description are the institution's own content — never translated,
  // only the surrounding Wafina-authored share chrome uses i18n.
  await Share.share({
    title: i18n.t('impact.shareTitlePrefix', { title: story.Title }),
    message: `${story.Title}\n\n${story.Description}\n\n${i18n.t('impact.shareFooter')}`,
  });
}

/**
 * Institution App Polish QA review (2026-07-31) — a dedicated Impact section
 * had been missing on mobile too; donors could only see a story mentioned
 * inline on the one donation card it belonged to.
 */
export function ImpactScreen() {
  const { t } = useTranslation();
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [stories, setStories] = useState<SuccessStory[] | null>(null);
  const [error, setError] = useState('');
  // Hidden off-screen node holding the currently-shared story's photo with
  // its caption burned in — see the capture flow in handleShareStory below.
  const [shareTarget, setShareTarget] = useState<SuccessStory | null>(null);
  const captureViewRef = useRef<View>(null);
  const imageLoadResolveRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        setStories(await apiFetch<SuccessStory[]>('/donor/success-stories', { idToken }));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t('impact.loadError'));
      }
    })();
  }, [firebaseUser, t]);

  async function handleShareStory(story: SuccessStory) {
    try {
      const imageShareAvailable = await Sharing.isAvailableAsync();
      if (!imageShareAvailable) {
        await shareStoryTextOnly(story);
        return;
      }

      let captureUri: string;
      try {
        await new Promise<void>((resolve, reject) => {
          imageLoadResolveRef.current = resolve;
          setShareTarget(story);
          setTimeout(() => reject(new Error('image load timeout')), 8000);
        });
        // One frame so the native layer actually paints before the snapshot.
        await new Promise((resolve) => requestAnimationFrame(resolve));
        captureUri = await captureRef(captureViewRef, { format: 'jpg', quality: 0.92 });
      } catch {
        // Couldn't render/capture the captioned image — text-only is still
        // a real share, not a dead end.
        setShareTarget(null);
        await shareStoryTextOnly(story);
        return;
      }

      await Sharing.shareAsync(captureUri, {
        dialogTitle: t('impact.shareTitlePrefix', { title: story.Title }),
        mimeType: 'image/jpeg',
      });
      setShareTarget(null);
    } catch {
      setShareTarget(null);
      showToast(t('impact.shareFailedError'), 'error');
    }
  }

  return (
    <View style={styles.screen}>
      {shareTarget && (
        <View style={styles.captureWrapper} pointerEvents="none">
          <View ref={captureViewRef} collapsable={false} style={styles.captureCard}>
            <Image
              source={{ uri: shareTarget.Image }}
              style={styles.capturePhoto}
              resizeMode="cover"
              onLoad={() => imageLoadResolveRef.current?.()}
            />
            <View style={styles.captureCaption}>
              <Text style={styles.captureCaptionTitle}>{shareTarget.Title}</Text>
              <Text style={styles.captureCaptionFooter}>{t('impact.shareFooter')}</Text>
            </View>
          </View>
        </View>
      )}
      <FlatList
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>{t('impact.title')}</Text>
            <Text style={styles.subtitle}>{t('impact.subtitle')}</Text>
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {!error && stories === null && <Text style={styles.loading}>{t('common.loading')}</Text>}
            {stories?.length === 0 && (
              <EmptyState
                title={t('impact.emptyTitle')}
                description={t('impact.emptyDescription')}
                icon="heart-outline"
              />
            )}
          </>
        }
        data={stories ?? []}
        keyExtractor={(item) => item.Success_Story_ID}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Image source={{ uri: item.Image }} style={styles.photo} resizeMode="contain" />
            <View style={styles.cardBody}>
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.storyTitle, { flex: 1 }]}>{item.Title}</Text>
                <Pressable
                  onPress={() => handleShareStory(item)}
                  accessibilityRole="button"
                  accessibilityLabel={t('impact.shareAccessibilityLabel')}
                  hitSlop={10}
                >
                  <Ionicons name="share-social-outline" size={20} color={colors.textMuted} />
                </Pressable>
              </View>
              {(item.Institution_Name || item.Item_Type) && (
                <Text style={styles.storyDetails}>
                  {[item.Item_Type, item.Institution_Name].filter(Boolean).join(' · ')}
                </Text>
              )}
              <Text style={styles.description}>{item.Description}</Text>
              <Text style={styles.dateLabel}>
                {t('impact.publishedOn', { date: formatDateTimeLabel(item.Date_Published) })}
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
  captureWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 720,
    height: 720,
    opacity: 0,
    zIndex: -1,
  },
  captureCard: {
    width: 720,
    height: 720,
    backgroundColor: '#000',
  },
  capturePhoto: {
    width: 720,
    height: 720,
  },
  captureCaption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.72)',
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  captureCaptionTitle: {
    fontFamily: 'Manrope-700',
    fontSize: 27,
    color: '#fff',
    marginBottom: 6,
  },
  captureCaptionFooter: {
    fontFamily: 'Manrope-600',
    fontSize: 17,
    color: 'rgba(255,255,255,0.85)',
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
    backgroundColor: colors.surface2,
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
  storyDetails: {
    fontFamily: 'Manrope-600',
    fontSize: 12.5,
    color: colors.accent,
  },
  dateLabel: {
    fontFamily: 'Manrope-400',
    fontSize: 12,
    color: colors.textFaint,
  },
});
