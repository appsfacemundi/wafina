import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getDonorTierProgress, type Donation, type DonorTier, type GeoRegion, type Notification, type Partner, type SuccessStory } from '@wafina/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/Card';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Photo } from '@/components/Photo';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { apiFetch } from '@/lib/api';
import type { AppTabParamList, RootStackParamList } from '@/navigation/RootNavigator';
import { colors, fonts, palette, radius, spacing } from '@/theme/tokens';

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

/** Donor loyalty milestones (2026-08-17) — Bronze/Silver/Gold/Platinum, matching the email's own tier names. */
const TIER_EMOJI: Record<DonorTier, string> = {
  Bronze: '🥉',
  Silver: '🥈',
  Gold: '🥇',
  Platinum: '💎',
};

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
  const { t } = useTranslation();
  const { session, firebaseUser } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [activeCountryName, setActiveCountryName] = useState<string | null>(null);
  const [donations, setDonations] = useState<Donation[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestStory, setLatestStory] = useState<SuccessStory | null>(null);
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

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
          const [donationList, notifications, stories, partnerList] = await Promise.all([
            apiFetch<Donation[]>('/donations/mine', { idToken }),
            apiFetch<Notification[]>('/notifications', { idToken }),
            apiFetch<SuccessStory[]>('/donor/success-stories', { idToken }),
            apiFetch<Partner[]>('/partners', { idToken }),
          ]);
          setDonations(donationList);
          setUnreadCount(notifications.filter((n) => n.Status !== 'Read').length);
          setLatestStory(stories[0] ?? null);
          setPartners(partnerList);
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

  // Donor loyalty milestones (2026-08-17) — Delivered only, matching the
  // server-side milestone-email trigger exactly (see donor-tiers.ts): a
  // milestone means the item actually reached someone, not just "submitted"
  // (which is what the stats.total card above already counts).
  const tierProgress = useMemo(() => {
    if (!donations) return null;
    const deliveredCount = donations.filter((d) => d.Status === 'Delivered').length;
    return getDonorTierProgress(deliveredCount);
  }, [donations]);

  const quickActions: {
    key: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    bg: string;
    onPress: () => void;
  }[] = [
    { key: 'donate', label: t('home.quickDonate'), icon: 'gift', color: colors.cta, bg: colors.ctaSoft, onPress: () => navigation.navigate('Donate') },
    { key: 'impact', label: t('nav.impact'), icon: 'heart', color: colors.danger, bg: colors.dangerSoft, onPress: () => navigation.navigate('Impact') },
    { key: 'institutions', label: t('nav.institutions'), icon: 'business', color: colors.success, bg: colors.successSoft, onPress: () => navigation.navigate('Institutions') },
    { key: 'mine', label: t('nav.myDonations'), icon: 'person', color: colors.accent, bg: colors.accentSoft, onPress: () => navigation.navigate('MyDonations') },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[5] }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('home.greeting')}{session?.name ? `, ${session.name}` : ''} 👋</Text>
            <Text style={styles.subtitle}>{t('home.thankYou')}</Text>
          </View>
          <LanguageSwitcher />
          <Pressable
            onPress={() => navigation.navigate('Notifications')}
            accessibilityRole="button"
            accessibilityLabel={t('nav.notifications')}
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
                <Text style={styles.countrySubtitle}>{t('home.activeCountry')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </Card>
          </Pressable>
        )}

        <View style={styles.ctaCard}>
          <View style={styles.ctaCardTop}>
            <Text style={styles.ctaCardEmoji}>🎁</Text>
            <View style={styles.ctaCardTextWrap}>
              <Text style={styles.ctaCardTitle}>{t('home.donateNow')}</Text>
              <Text style={styles.ctaCardSubtitle}>{t('home.donateNowSubtitle')}</Text>
            </View>
          </View>
          <Pressable
            onPress={() => navigation.navigate('Donate')}
            accessibilityRole="button"
            accessibilityLabel={t('home.donateNow')}
            style={({ pressed }) => [styles.ctaCardBtn, pressed && styles.ctaCardBtnPressed]}
          >
            <Text style={styles.ctaCardBtnText}>{t('home.donateNowCta')}</Text>
          </Pressable>
        </View>

        <View style={[styles.ctaCard, styles.receiveCard]}>
          <View style={styles.ctaCardTop}>
            <Text style={styles.ctaCardEmoji}>🙏</Text>
            <View style={styles.ctaCardTextWrap}>
              <Text style={styles.ctaCardTitle}>{t('home.receiveNow')}</Text>
              <Text style={styles.ctaCardSubtitle}>{t('home.receiveNowSubtitle')}</Text>
            </View>
          </View>
          <Pressable
            onPress={() => navigation.navigate('Receber')}
            accessibilityRole="button"
            accessibilityLabel={t('home.receiveNow')}
            style={({ pressed }) => [styles.ctaCardBtn, pressed && styles.ctaCardBtnPressed]}
          >
            <Text style={[styles.ctaCardBtnText, { color: colors.receive }]}>{t('home.receiveNowCta')}</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t('home.yourImpact')}</Text>
          <Pressable onPress={() => navigation.navigate('MyDonations')} accessibilityRole="button">
            <Text style={styles.sectionLink}>{t('home.viewAll')}</Text>
          </Pressable>
        </View>
        {stats && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={[styles.statIconWrap, { backgroundColor: colors.ctaSoft }]}>
                <Ionicons name="heart" size={18} color={colors.cta} />
              </View>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>{t('home.donationsMade')}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIconWrap, { backgroundColor: colors.successSoft }]}>
                <Ionicons name="business" size={18} color={colors.success} />
              </View>
              <Text style={styles.statValue}>{stats.institutions}</Text>
              <Text style={styles.statLabel}>{t('home.institutionsSupported')}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIconWrap, { backgroundColor: colors.warningSoft }]}>
                <Ionicons name="cube" size={18} color={colors.warning} />
              </View>
              <Text style={styles.statValue}>{stats.quantity}</Text>
              <Text style={styles.statLabel}>{t('home.itemsDonated')}</Text>
            </View>
          </View>
        )}

        {/* Donor loyalty milestones (2026-08-17) — shown from the very first
            visit (even at 0 delivered), same "always visible once stats
            exist" precedent as the stats row above, to invite engagement
            rather than only appearing after a donor already has momentum. */}
        {tierProgress && (
          <Card style={styles.tierCard}>
            <View style={styles.tierHeaderRow}>
              <Text style={styles.tierEmoji}>{tierProgress.currentTier ? TIER_EMOJI[tierProgress.currentTier] : '🎖️'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.tierTitle}>
                  {tierProgress.currentTier
                    ? t('home.tierCurrent', { tier: tierProgress.currentTier })
                    : t('home.tierNoneYet')}
                </Text>
                <Text style={styles.tierSubtitle}>
                  {tierProgress.nextTier
                    ? t('home.tierProgress', { count: tierProgress.remainingToNextTier, tier: tierProgress.nextTier })
                    : t('home.tierMaxReached')}
                </Text>
              </View>
            </View>
            {tierProgress.nextThreshold !== null && (
              <View style={styles.tierBarTrack}>
                <View
                  style={[
                    styles.tierBarFill,
                    { width: `${Math.min(100, (tierProgress.deliveredCount / tierProgress.nextThreshold) * 100)}%` },
                  ]}
                />
              </View>
            )}
          </Card>
        )}

        <Text style={[styles.sectionTitle, { marginBottom: spacing[3] }]}>{t('home.quickActions')}</Text>
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
          <Text style={styles.sectionTitle}>{t('home.latestStories')}</Text>
          <Pressable onPress={() => navigation.navigate('Impact')} accessibilityRole="button">
            <Text style={styles.sectionLink}>{t('home.viewAllStories')}</Text>
          </Pressable>
        </View>
        {latestStory && (
          <Pressable onPress={() => navigation.navigate('Impact')} accessibilityRole="button">
            <Card style={styles.storyCard}>
              <Photo uri={latestStory.Image} style={styles.storyImage} placeholderIcon="❤️" resizeMode="contain" />
              <View style={styles.storyTextWrap}>
                <Text style={styles.storyTitle} numberOfLines={2}>
                  {latestStory.Title}
                </Text>
                {(latestStory.Institution_Name || latestStory.Item_Type) && (
                  <Text style={styles.storyDetails} numberOfLines={1}>
                    {[latestStory.Item_Type, latestStory.Institution_Name].filter(Boolean).join(' · ')}
                  </Text>
                )}
                <Text style={styles.storyMeta} numberOfLines={2}>
                  ❤️ {latestStory.Description}
                </Text>
              </View>
            </Card>
          </Pressable>
        )}

        {partners && partners.length > 0 && (
          <>
            <View style={{ marginTop: spacing[2] }}>
              <Text style={styles.sectionTitle}>{t('home.ourPartners')}</Text>
              <Text style={styles.subtitle}>{t('home.partnersTagline')}</Text>
            </View>
            <View style={styles.partnersGrid}>
              {partners.map((p) => (
                <Pressable
                  key={p.Partner_ID}
                  onPress={() => setSelectedPartner(p)}
                  accessibilityRole="button"
                  accessibilityLabel={p.Name}
                  style={styles.partnerTile}
                >
                  <Photo uri={p.Logo} style={styles.partnerLogo} placeholderIcon="🤝" />
                </Pressable>
              ))}
            </View>
            <Card style={styles.becomePartnerCard}>
              <Text style={styles.becomePartnerTitle}>{t('home.becomePartner')}</Text>
              <Text style={styles.becomePartnerText}>
                {t('home.becomePartnerText')}
              </Text>
              <Pressable
                onPress={() => {
                  // Real-device finding, 2026-08-08 — Linking.openURL rejects
                  // silently (no crash, no visible feedback) on a device with
                  // no mail app configured. Surfacing the address directly is
                  // the only fallback that doesn't need a new native module.
                  Linking.openURL('mailto:wafina@zuinder.com?subject=Parceria%20com%20a%20Wafina').catch(() =>
                    showToast(t('home.noMailApp', { email: 'wafina@zuinder.com' })),
                  );
                }}
                accessibilityRole="button"
              >
                <Text style={styles.sectionLink}>{t('home.becomePartnerCta')}</Text>
              </Pressable>
            </Card>
          </>
        )}
      </ScrollView>

      <Modal visible={selectedPartner !== null} transparent animationType="fade" onRequestClose={() => setSelectedPartner(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedPartner(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            {selectedPartner && (
              <>
                <Photo uri={selectedPartner.Logo} style={styles.modalLogo} placeholderIcon="🤝" />
                <Text style={styles.modalTitle}>{selectedPartner.Name}</Text>
                <Text style={styles.modalDescription}>{selectedPartner.Description}</Text>
                {selectedPartner.Website && (
                  <Pressable onPress={() => Linking.openURL(selectedPartner.Website!)} accessibilityRole="button">
                    <Text style={styles.sectionLink}>{t('home.visitWebsite')}</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => setSelectedPartner(null)}
                  accessibilityRole="button"
                  style={styles.modalCloseBtn}
                >
                  <Text style={styles.modalCloseText}>{t('home.close')}</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  // RECEBER card — same layout as the DOAR ctaCard above, in the logo's pink
  // (colors.receive) so "giving" (blue) and "receiving" (pink) stay visually
  // distinct.
  receiveCard: {
    backgroundColor: colors.receive,
    shadowColor: palette.pink700,
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
  // Donor loyalty milestones (2026-08-17)
  tierCard: {
    gap: spacing[3],
  },
  tierHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  tierEmoji: {
    fontSize: 32,
  },
  tierTitle: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.text,
  },
  tierSubtitle: {
    fontFamily: 'Manrope-400',
    fontSize: 12.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  tierBarTrack: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surface2,
    overflow: 'hidden',
  },
  tierBarFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.accent,
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
  storyDetails: {
    fontFamily: 'Manrope-600',
    fontSize: 12,
    color: colors.accent,
  },
  partnersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  partnerTile: {
    width: '31%',
    height: 64,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[2],
  },
  partnerLogo: {
    width: '100%',
    height: '100%',
  },
  becomePartnerCard: {
    gap: spacing[2],
    alignItems: 'flex-start',
  },
  becomePartnerTitle: {
    fontFamily: 'Manrope-700',
    fontSize: 15,
    color: colors.text,
  },
  becomePartnerText: {
    fontFamily: 'Manrope-400',
    fontSize: 13,
    color: colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing[6],
    gap: spacing[3],
    width: '100%',
    maxWidth: 360,
    alignItems: 'flex-start',
  },
  modalLogo: {
    width: 96,
    height: 56,
  },
  modalTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.text,
  },
  modalDescription: {
    fontFamily: 'Manrope-400',
    fontSize: 14,
    color: colors.textMuted,
  },
  modalCloseBtn: {
    marginTop: spacing[2],
  },
  modalCloseText: {
    fontFamily: 'Manrope-600',
    fontSize: 13.5,
    color: colors.textMuted,
  },
});
