import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import {
  DELIVERY_METHOD_LABEL_KEY,
  daysAgoLabel,
  donorDonationStatusLabelKey,
  donorDonationStatusTone,
  DONATION_STATUSES,
  RECIPIENT_CATEGORY_LABEL_KEY,
  formatDateLabel,
  type CorporateAccount,
  type Donation,
  type SuccessStory,
} from '@wafina/shared';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DonationTimeline } from '@/components/DonationTimeline';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { PhotoGalleryModal } from '@/components/PhotoGalleryModal';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { ApiError, apiFetch } from '@/lib/api';
import type { AppTabParamList, RootStackParamList } from '@/navigation/RootNavigator';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

// Composite for the same reason as HomeScreen's Props (see its comment):
// "Editar" on a rejected donation navigates to 'Donate', which lives on
// RootStack one level up, not on this tab navigator.
type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabParamList, 'MyDonations'>,
  NativeStackScreenProps<RootStackParamList>
>;

type StatusFilter = 'all' | 'pending' | 'accepted' | 'delivered';

export function MyDonationsScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { firebaseUser, session } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const highlightId = route.params?.donationId;
  const listRef = useRef<FlatList<Donation>>(null);
  const [donations, setDonations] = useState<Donation[] | null>(null);
  const [storiesByDonation, setStoriesByDonation] = useState<Map<string, SuccessStory>>(new Map());
  const [corporateAccount, setCorporateAccount] = useState<CorporateAccount | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  // RC1 UX polish, 2026-08-10 — replaced the fold/expand sections with a
  // single-select filter row (TODAS/PENDENTES/ACEITES/ENTREGUES) per the
  // request; only one status group is shown at a time instead of three
  // simultaneously-collapsible ones.
  const [filter, setFilter] = useState<StatusFilter>('all');
  // RC1 rejection-loop fix, 2026-08-13 — tracks which card's "Reenviar" is
  // in flight so only that one card's button shows a loading state.
  const [resubmittingId, setResubmittingId] = useState<string | null>(null);
  // V2 multi-photo (2026-08-17) — which card's full gallery is open, if any.
  const [galleryDonation, setGalleryDonation] = useState<Donation | null>(null);

  const load = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      const [donationList, stories] = await Promise.all([
        apiFetch<Donation[]>('/donations/mine', { idToken }),
        apiFetch<SuccessStory[]>('/donor/success-stories', { idToken }),
      ]);
      setDonations(donationList);
      setStoriesByDonation(new Map(stories.map((s) => [s.Donation_ID, s])));
    } catch {
      setError(t('donations.loadError'));
    }
  }, [firebaseUser, t]);

  // Real-device finding, 2026-08-04: this only ran once on mount, so a
  // donation submitted on the Donate tab never appeared here until the app
  // was fully restarted — useFocusEffect refetches every time this tab
  // becomes active, not just the first time.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // RC1 rejection-loop fix, 2026-08-13 — the donor's only way to act on a
  // rejection without leaving the app: puts the donation straight back in
  // Admin's review queue. No confirmation dialog, matching the low-friction
  // pattern already used for Institution's claim action.
  async function onResubmit(donationId: string) {
    setResubmittingId(donationId);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/donations/${donationId}/resubmit`, { method: 'POST', idToken });
      showToast(t('donations.resubmitSuccess'));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('donations.resubmitError'));
    } finally {
      setResubmittingId(null);
    }
  }

  useEffect(() => {
    if (!firebaseUser || !session?.corporateAccountId) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        setCorporateAccount(await apiFetch<CorporateAccount | null>('/donor/corporate-account', { idToken }));
      } catch {
        // Non-critical — the attribution label just falls back to the generic form below.
      }
    })();
  }, [firebaseUser, session?.corporateAccountId]);

  const stats = useMemo(() => {
    if (!donations) return null;
    return {
      total: donations.length,
      quantity: donations.reduce((sum, d) => sum + (Number.isSafeInteger(d.Quantity) ? d.Quantity : 0), 0),
      pending: donations.filter((d) => d.Status === 'Pending').length,
      claimed: donations.filter((d) => d.Status === 'Claimed').length,
      delivered: donations.filter((d) => d.Status === 'Delivered').length,
    };
  }, [donations, session]);

  // Pilot feedback, 2026-08-05: sorted by newest-first only (B3 fix) — this
  // groups by pipeline stage instead (Pending first, matching the same
  // status order used for the Admin Reports donations filter), newest-first
  // as the tiebreaker within a stage. Plus a search box, also requested.
  const visibleDonations = useMemo(() => {
    let result = donations ?? [];
    result = [...result].sort((a, b) => {
      const byStatus = DONATION_STATUSES.indexOf(a.Status) - DONATION_STATUSES.indexOf(b.Status);
      return byStatus !== 0 ? byStatus : (b.Date_Submitted ?? '').localeCompare(a.Date_Submitted ?? '');
    });
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (d) => d.Item_Type.toLowerCase().includes(q) || d.Public_Donation_Code.toLowerCase().includes(q),
      );
    }
    return result;
  }, [donations, search]);

  const statusGroups = useMemo(
    () => ({
      pending: visibleDonations.filter((d) => d.Status === 'Pending'),
      accepted: visibleDonations.filter(
        (d) => d.Status === 'Claimed' || d.Status === 'Collection_Scheduled' || d.Status === 'Collected',
      ),
      delivered: visibleDonations.filter((d) => d.Status === 'Delivered'),
    }),
    [visibleDonations],
  );

  const filteredDonations = useMemo(() => {
    if (filter === 'pending') return statusGroups.pending;
    if (filter === 'accepted') return statusGroups.accepted;
    if (filter === 'delivered') return statusGroups.delivered;
    return visibleDonations;
  }, [filter, statusGroups, visibleDonations]);

  // A notification deep-links here with a specific donationId — whichever
  // filter tab that donation actually belongs to must win, otherwise the
  // donor could land on "Pendentes" while the item they tapped is filed
  // under "Entregue" and never appears.
  useEffect(() => {
    if (!highlightId || !donations) return;
    const target = donations.find((d) => d.Donation_ID === highlightId);
    if (!target) return;
    if (target.Status === 'Pending') setFilter('pending');
    else if (target.Status === 'Delivered') setFilter('delivered');
    else setFilter('accepted');
  }, [highlightId, donations]);

  // Real-device finding, 2026-08-07 — deep-linking here from a donation
  // notification always landed at the top of the list with no indication
  // of which item the notification was about. Scroll to it once it's in
  // the (already-loaded, correctly-filtered) list.
  useEffect(() => {
    if (!highlightId || filteredDonations.length === 0) return;
    const index = filteredDonations.findIndex((d) => d.Donation_ID === highlightId);
    if (index === -1) return;
    const timer = setTimeout(() => {
      try {
        listRef.current?.scrollToIndex({ index, animated: true, viewOffset: 20 });
      } catch {
        // Not measured yet — harmless, list is still usable without the scroll.
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [highlightId, filteredDonations]);

  const filterChips: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: t('donations.filterAll'), count: visibleDonations.length },
    { key: 'pending', label: t('donations.filterPending'), count: statusGroups.pending.length },
    { key: 'accepted', label: t('donations.filterAccepted'), count: statusGroups.accepted.length },
    { key: 'delivered', label: t('donations.filterDelivered'), count: statusGroups.delivered.length },
  ];

  return (
    <View style={styles.screen}>
      <FlatList
        ref={listRef}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}
        onScrollToIndexFailed={() => {
          // Item not measured yet — harmless, list is still usable without the scroll.
        }}
        ListHeaderComponent={
          <>
            <View style={styles.headerRow}>
              <Text style={styles.title}>{t('donations.title')}</Text>
            </View>
            {stats && (
              <View style={styles.statsGrid}>
                {[
                  [t('donations.statTotal'), stats.total],
                  [t('donations.statItemsTotal'), stats.quantity],
                  [t('donations.statPending'), stats.pending],
                  [t('donations.statAccepted'), stats.claimed],
                  [t('donations.statDelivered'), stats.delivered],
                ].map(([label, value]) => (
                  <Card key={label as string} style={styles.statCard}>
                    <Text style={styles.statValue}>{value}</Text>
                    <Text style={styles.statLabel}>{label}</Text>
                  </Card>
                ))}
              </View>
            )}
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {!error && donations === null && <Text style={styles.loading}>{t('common.loading')}</Text>}
            {donations && donations.length > 0 && (
              <>
                <Input
                  label={t('donations.searchLabel')}
                  placeholder={t('donations.searchPlaceholder')}
                  value={search}
                  onChangeText={setSearch}
                  style={{ marginBottom: spacing[3] }}
                />
                <View style={styles.filterRow}>
                  {filterChips.map((chip) => {
                    const active = filter === chip.key;
                    return (
                      <Pressable
                        key={chip.key}
                        onPress={() => setFilter(chip.key)}
                        style={[styles.filterBtn, active && styles.filterBtnActive]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.filterBtnText, active && styles.filterBtnTextActive]}>
                          {chip.label} ({chip.count})
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
            {donations?.length === 0 && (
              <EmptyState
                title={t('donations.emptyNoneTitle')}
                description={t('donations.emptyNoneDescription')}
                icon="gift-outline"
              />
            )}
            {donations && donations.length > 0 && visibleDonations.length === 0 && (
              <EmptyState
                title={t('donations.emptyNoResultsTitle')}
                description={t('donations.emptyNoResultsDescription')}
                icon="search-outline"
              />
            )}
            {donations && donations.length > 0 && visibleDonations.length > 0 && filteredDonations.length === 0 && (
              <EmptyState
                title={t('donations.emptyNoStatusTitle')}
                description={t('donations.emptyNoStatusDescription')}
                icon="filter-outline"
              />
            )}
          </>
        }
        data={filteredDonations}
        keyExtractor={(item) => item.Donation_ID}
        renderItem={({ item }) => {
          const story = storiesByDonation.get(item.Donation_ID);
          return (
            <Card
              style={[
                { marginBottom: spacing[3], gap: spacing[3] },
                item.Donation_ID === highlightId && styles.highlightedCard,
              ]}
            >
              {/* V2 multi-photo (2026-08-17) — tap the cover to open the full gallery; the badge only shows once there's more than one photo. */}
              {item.Photo && (
                <Pressable onPress={() => setGalleryDonation(item)} style={styles.photoWrap} accessibilityRole="button">
                  <Image source={{ uri: item.Photo }} style={styles.itemPhoto} resizeMode="cover" />
                  {item.Photos.length > 1 && (
                    <View style={styles.photoCountBadge}>
                      <Text style={styles.photoCountBadgeText}>📷 {item.Photos.length}</Text>
                    </View>
                  )}
                </Pressable>
              )}
              <View style={styles.donationRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemType}>{item.Item_Type}</Text>
                  <Text style={styles.donationId}>
                    {item.Public_Donation_Code} · {t('donations.quantityAbbrev')} {item.Quantity}
                  </Text>
                </View>
                <Badge tone={donorDonationStatusTone(item)}>{t(donorDonationStatusLabelKey(item))}</Badge>
              </View>
              {/* RC1 rejection-loop fix, 2026-08-13 — until now the reason only ever
                  appeared once, in a notification the donor could easily miss; this
                  makes it a permanent part of the donation card, plus the actual
                  actions (edit / resubmit) the backend has supported all along but
                  nothing in this app ever surfaced. */}
              {item.Approval_Status === 'Rejected' && (
                <View style={styles.rejectionBox}>
                  <Text style={styles.rejectionText}>
                    ⚠️ {t('donations.rejectionReasonLabel')} {item.Approval_Rejection_Reason}
                  </Text>
                  <View style={styles.rejectionActions}>
                    <View style={{ flex: 1 }}>
                      <Button variant="secondary" onPress={() => navigation.navigate('Donate', { editDonation: item })}>
                        {t('donations.editButton')}
                      </Button>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        variant="primary"
                        loading={resubmittingId === item.Donation_ID}
                        onPress={() => onResubmit(item.Donation_ID)}
                      >
                        {t('donations.resubmitButton')}
                      </Button>
                    </View>
                  </View>
                </View>
              )}
              <Text style={styles.donationId}>
                {item.Corporate_Account_ID
                  ? corporateAccount
                    ? t('donations.corporateDonationWithCompany', { company: corporateAccount.Company_Name })
                    : t('donations.corporateDonation')
                  : t('donations.personalDonation')}
              </Text>
              <Text style={styles.donationId}>
                {item.Recipient_Category ? t(RECIPIENT_CATEGORY_LABEL_KEY[item.Recipient_Category]) : '—'}
                {' · '}
                {item.Delivery_Method ? t(DELIVERY_METHOD_LABEL_KEY[item.Delivery_Method]) : '—'}
              </Text>
              <Text style={styles.donationId}>📅 {daysAgoLabel(item.Date_Submitted)}</Text>
              {/* V2 GPS distance (2026-08-17) — donor transparency: same Distance_Km the claiming institution saw, surfaced back once claimed. Never shown for a still-Pending (unclaimed) donation. */}
              {item.Distance_Km !== null && (
                <Text style={styles.donationId}>
                  📍 {t('donations.acceptedDistance', { distance: Math.round(item.Distance_Km) })}
                </Text>
              )}
              {(item.Expected_Collection_Date || item.Expected_Delivery_Date) && (
                <Text style={styles.donationId}>
                  {item.Expected_Collection_Date &&
                    t('donations.expectedCollection', { date: formatDateLabel(item.Expected_Collection_Date) })}
                  {item.Expected_Collection_Date && item.Expected_Delivery_Date && ' · '}
                  {item.Expected_Delivery_Date &&
                    t('donations.expectedDelivery', { date: formatDateLabel(item.Expected_Delivery_Date) })}
                </Text>
              )}
              {item.Status !== 'Pending' && <DonationTimeline donation={item} />}
              {story && (
                <View style={styles.storyCard}>
                  <Image source={{ uri: story.Image }} style={styles.storyImage} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.storyLabel}>{t('donations.impactStoryLabel')}</Text>
                    <Text style={styles.storyTitle}>{story.Title}</Text>
                    <Text style={styles.storyDescription} numberOfLines={3}>
                      {story.Description}
                    </Text>
                  </View>
                </View>
              )}
            </Card>
          );
        }}
      />
      <PhotoGalleryModal
        visible={!!galleryDonation}
        photos={galleryDonation?.Photos ?? []}
        onClose={() => setGalleryDonation(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  // RC1 rejection-loop fix, 2026-08-13
  rejectionBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing[3],
    gap: spacing[3],
  },
  rejectionText: {
    fontFamily: 'Manrope-400',
    fontSize: 13,
    color: colors.danger,
    lineHeight: 18,
  },
  rejectionActions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  content: {
    padding: spacing[6],
    gap: spacing[4],
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  statCard: {
    minWidth: '30%',
    flexGrow: 1,
  },
  statValue: {
    fontFamily: 'Manrope-700',
    fontSize: 24,
    color: colors.text,
  },
  statLabel: {
    fontFamily: 'Manrope-400',
    fontSize: 12,
    color: colors.textMuted,
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
  // Bug fix, 2026-08-11 — same 'contain'-in-a-small-box issue as the
  // DonateScreen upload preview: switched to 'cover' so the donor's own
  // photo fills the card instead of rendering as a tiny letterboxed strip.
  // V2 multi-photo (2026-08-17) — wraps the cover Image so the photo-count badge can anchor to it.
  photoWrap: {
    position: 'relative',
  },
  itemPhoto: {
    width: '100%',
    height: 180,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
  },
  photoCountBadge: {
    position: 'absolute',
    bottom: spacing[2],
    right: spacing[2],
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: radius.full,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  photoCountBadgeText: {
    fontFamily: 'Manrope-700',
    fontSize: 11,
    color: '#ffffff',
  },
  highlightedCard: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  filterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  filterBtnActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  filterBtnText: {
    fontFamily: 'Manrope-600',
    fontSize: 12.5,
    color: colors.textMuted,
  },
  filterBtnTextActive: {
    color: colors.accent,
  },
  donationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  storyCard: {
    flexDirection: 'row',
    gap: spacing[3],
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    padding: spacing[3],
  },
  storyImage: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
  },
  storyLabel: {
    fontFamily: 'Manrope-600',
    fontSize: 10.5,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.success,
  },
  storyTitle: {
    fontFamily: 'Manrope-600',
    fontSize: 13.5,
    color: colors.text,
  },
  storyDescription: {
    fontFamily: 'Manrope-400',
    fontSize: 12.5,
    color: colors.textMuted,
  },
  itemType: {
    fontFamily: 'Manrope-600',
    fontSize: 15,
    color: colors.text,
  },
  donationId: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textFaint,
  },
});
