import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Donation, GeoRegion, Notification, SuccessStory } from '@wafina/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/Card';
import { Photo } from '@/components/Photo';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import type { AppTabParamList, RootStackParamList } from '@/navigation/RootNavigator';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

// Composite because navigating to 'Donate' targets a screen one level up —
// it lives on RootStack now as a modal sibling of the tab navigator, not on
// AppTab itself (see RootNavigator.tsx). Plain BottomTabScreenProps only
// types routes within this tab navigator, which would make that call a type
// error even though React Navigation resolves it fine at runtime by
// bubbling up to the parent stack.
type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

/**
 * Full redesign, 2026-08-08 (stakeholder-provided reference mockup) — Home
 * went from a single CTA + account card to the app's actual dashboard:
 * greeting header with a notifications bell, active country, the donate
 * CTA, a personal impact summary, quick actions to every other tab, and the
 * latest impact story. Stats/notifications/story all come from endpoints
 * that already exist for other screens (MyDonations, Notifications, Impact)
 * — nothing new on the backend, just surfaced here too.
 */
export function HomeScreen({ navigation }: Props) {
  const { session, firebaseUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [activeCountryName, setActiveCountryName] = useState<string | null>(null);
  const [donations, setDonations] = useState<Donation[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestStory, setLatestStory] = useState<SuccessStory | null>(null);

  useEffect(() => {
    if (!firebaseUser || !session?.activeCountryId) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        const countries = await apiFetch<GeoRegion[]>('/geo-regions/all-countries', { idToken });
        setActiveCountryName(countries.find((c) => c.Region_ID === session.activeCountryId)?.Name ?? null);
      } catch {
        // Non-critical — the banner just doesn't render if this fails.
      }
    })();
  }, [firebaseUser, session?.activeCountryId]);

  // useFocusEffect (not a plain mount effect) so the summary — donation
  // count, unread badge, latest story — is fresh every time a donor lands
  // back on Home, e.g. right after submitting a donation or reading a
  // notification elsewhere in the app (same pattern MyDonationsScreen uses).
  useFocusEffect(
    useCallback(() => {
      if (!firebaseUser) return;
      (async () => {
        try {
          const idToken = await firebaseUser.getIdToken();
          const [donationList, notifications, stories] = await Promise.all([
            apiFetch<Donation[]>('/donations/mine', { idToken }),
            apiFetch<Notification[]>('/notifications', { idToken }),
            apiFetch<SuccessStory[]>('/donor/success-stories', { idToken }),
          ]);
          setDonations(donationList);
          setUnreadCount(notifications.filter((n) => n.Status !== 'Read').length);
          setLatestStory(stories[0] ?? null);
        } catch {
          // Non-critical — Home's summary sections just stay empty if this fails.
        }
      })();
    }, [firebaseUser]),
  );

  const stats = useMemo(() => {
    if (!donations) return null;
    const institutionIds = new Set(donations.map((d) => d.Claimed_By_Institution_ID).filter(Boolean));
    return {
      total: donations.length,
      institutions: institutionIds.size,
      quantity: donations.reduce((sum, d) => sum + (Number.isSafeInteger(d.Quantity) ? d.Quantity : 0), 0),
    };
  }, [donations]);

  const quickActions: {
    key: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    bg: string;
    onPress: () => void;
  }[] = [
    { key: 'donate', label: 'Doar', icon: 'gift', color: colors.cta, bg: colors.ctaSoft, onPress: () => navigation.navigate('Donate') },
    { key: 'impact', label: 'Impacto', icon: 'heart', color: colors.danger, bg: colors.dangerSoft, onPress: () => navigation.navigate('Impact') },
    { key: 'institutions', label: 'Instituições', icon: 'business', color: colors.success, bg: colors.successSoft, onPress: () => navigation.navigate('Institutions') },
    { key: 'mine', label: 'As Minhas', icon: 'person', color: colors.accent, bg: colors.accentSoft, onPress: () => navigation.navigate('MyDonations') },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[5] }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Olá{session?.name ? `, ${session.name}` : ''} 👋</Text>
            <Text style={styles.subtitle}>Obrigado por fazer parte da Wafina.</Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('Notifications')}
            accessibilityRole="button"
            accessibilityLabel="Notificações"
            hitSlop={10}
            style={styles.bellWrap}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.text} />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {activeCountryName && (
          <Pressable onPress={() => navigation.navigate('Settings')} accessibilityRole="button">
            <Card style={styles.countryCard}>
              <View style={styles.countryIconWrap}>
                <Ionicons name="globe-outline" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.countryName}>{activeCountryName}</Text>
                <Text style={styles.countrySubtitle}>País ativo</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </Card>
          </Pressable>
        )}

        <View style={styles.ctaCard}>
          <View style={styles.ctaCardTop}>
            <Text style={styles.ctaCardEmoji}>🎁</Text>
            <View style={styles.ctaCardTextWrap}>
              <Text style={styles.ctaCardTitle}>Doar Agora</Text>
              <Text style={styles.ctaCardSubtitle}>Ajude alguém em menos de 2 minutos.</Text>
            </View>
          </View>
          <Pressable
            onPress={() => navigation.navigate('Donate')}
            accessibilityRole="button"
            accessibilityLabel="Doar agora"
            style={({ pressed }) => [styles.ctaCardBtn, pressed && styles.ctaCardBtnPressed]}
          >
            <Text style={styles.ctaCardBtnText}>Doar agora →</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>O seu impacto</Text>
          <Pressable onPress={() => navigation.navigate('MyDonations')} accessibilityRole="button">
            <Text style={styles.sectionLink}>Ver tudo</Text>
          </Pressable>
        </View>
        {stats && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={[styles.statIconWrap, { backgroundColor: colors.ctaSoft }]}>
                <Ionicons name="heart" size={18} color={colors.cta} />
              </View>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Doações{'\n'}realizadas</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIconWrap, { backgroundColor: colors.successSoft }]}>
                <Ionicons name="business" size={18} color={colors.success} />
              </View>
              <Text style={styles.statValue}>{stats.institutions}</Text>
              <Text style={styles.statLabel}>Instituições{'\n'}apoiadas</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIconWrap, { backgroundColor: colors.warningSoft }]}>
                <Ionicons name="cube" size={18} color={colors.warning} />
              </View>
              <Text style={styles.statValue}>{stats.quantity}</Text>
              <Text style={styles.statLabel}>Itens{'\n'}doados</Text>
            </View>
          </View>
        )}

        <Text style={[styles.sectionTitle, { marginBottom: spacing[3] }]}>Ações rápidas</Text>
        <View style={styles.quickActionsRow}>
          {quickActions.map((action) => (
            <Pressable key={action.key} onPress={action.onPress} accessibilityRole="button" style={styles.quickAction}>
              <View style={[styles.quickActionIconWrap, { backgroundColor: action.bg }]}>
                <Ionicons name={action.icon} size={20} color={action.color} />
              </View>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Últimas histórias</Text>
          <Pressable onPress={() => navigation.navigate('Impact')} accessibilityRole="button">
            <Text style={styles.sectionLink}>Ver todas</Text>
          </Pressable>
        </View>
        {latestStory && (
          <Pressable onPress={() => navigation.navigate('Impact')} accessibilityRole="button">
            <Card style={styles.storyCard}>
              <Photo uri={latestStory.Image} style={styles.storyImage} placeholderIcon="❤️" />
              <View style={styles.storyTextWrap}>
                <Text style={styles.storyTitle} numberOfLines={2}>
                  {latestStory.Title}
                </Text>
                <Text style={styles.storyMeta}>❤️ Obrigado.</Text>
              </View>
            </Card>
          </Pressable>
        )}
      </ScrollView>
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
    paddingBottom: spacing[10],
    gap: spacing[4],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.text,
  },
  subtitle: {
    fontFamily: 'Manrope-400',
    fontSize: 13.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  bellWrap: {
    padding: spacing[2],
  },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    fontFamily: 'Manrope-700',
    fontSize: 9.5,
    color: '#ffffff',
  },
  countryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
  },
  countryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countryName: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.text,
  },
  countrySubtitle: {
    fontFamily: 'Manrope-400',
    fontSize: 11.5,
    color: colors.textFaint,
  },
  ctaCard: {
    backgroundColor: colors.accent,
    borderRadius: radius.xl,
    padding: spacing[5],
    gap: spacing[4],
    shadowColor: colors.accentHover,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  ctaCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  ctaCardEmoji: {
    fontSize: 36,
  },
  ctaCardTextWrap: {
    flex: 1,
    gap: 2,
  },
  ctaCardTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.accentText,
  },
  ctaCardSubtitle: {
    fontFamily: 'Manrope-400',
    fontSize: 13,
    color: colors.accentSoft,
  },
  ctaCardBtn: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingVertical: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaCardBtnPressed: {
    opacity: 0.85,
  },
  ctaCardBtnText: {
    fontFamily: 'Manrope-700',
    fontSize: 15,
    color: colors.accent,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing[2],
  },
  sectionTitle: {
    fontFamily: 'Manrope-700',
    fontSize: 16,
    color: colors.text,
  },
  sectionLink: {
    fontFamily: 'Manrope-600',
    fontSize: 13,
    color: colors.accent,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[3],
    gap: 4,
  },
  statIconWrap: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.text,
  },
  statLabel: {
    fontFamily: 'Manrope-400',
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 14,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAction: {
    alignItems: 'center',
    gap: 6,
    width: 72,
  },
  quickActionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontFamily: 'Manrope-600',
    fontSize: 11,
    color: colors.text,
    textAlign: 'center',
  },
  storyCard: {
    padding: 0,
    overflow: 'hidden',
    gap: 0,
  },
  storyImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  storyTextWrap: {
    padding: spacing[4],
    gap: 4,
  },
  storyTitle: {
    fontFamily: 'Manrope-700',
    fontSize: 15.5,
    color: colors.text,
  },
  storyMeta: {
    fontFamily: 'Manrope-400',
    fontSize: 13,
    color: colors.textMuted,
  },
});
