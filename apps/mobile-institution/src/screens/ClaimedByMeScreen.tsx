import {
  DELIVERY_METHOD_LABEL_KEY,
  DELIVERY_METHODS,
  DONATION_STATUS_LABEL_KEY,
  DONATION_STATUS_TONE,
  DONATION_STATUSES,
  RECIPIENT_CATEGORY_LABEL_KEY,
  daysAgoLabel,
  formatDateLabel,
  type DeliveryMethod,
  type InstitutionDonationView,
  type SuccessStory,
} from '@wafina/shared';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DonationTimeline } from '@/components/DonationTimeline';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { Photo } from '@/components/Photo';
import { ThankYouNoteModal } from '@/components/ThankYouNoteModal';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { apiFetch, uploadFile, ApiError } from '@/lib/api';
import type { ClaimedByMeStackParamList } from '@/navigation/RootNavigator';
import { colors, fonts, spacing } from '@/theme/tokens';

type Props = NativeStackScreenProps<ClaimedByMeStackParamList, 'ClaimedByMeList'>;
type StatusFilter = 'all' | 'active' | 'delivered';

export function ClaimedByMeScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const highlightId = route.params?.donationId;
  const listRef = useRef<FlatList<InstitutionDonationView>>(null);
  const [donations, setDonations] = useState<InstitutionDonationView[] | null>(null);
  const [storiesByDonation, setStoriesByDonation] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);
  // Donation lifecycle emails, 2026-08-11 — "Confirmar entrega" opens this
  // optional note first instead of calling the API directly; holds the
  // donation being delivered while the modal is open.
  const [deliverModalDonationId, setDeliverModalDonationId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryMethod | 'all'>('all');
  // RC1 UX polish, 2026-08-10 — replaced the fold/expand Em Curso/Entregues
  // sections with a single-select filter row (Todos/Em Curso/Entregues),
  // matching the donor apps' equivalent lists.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  async function load() {
    if (!firebaseUser) return;
    let idToken: string;
    try {
      idToken = await firebaseUser.getIdToken();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('donations.claimed.loadError'));
      return;
    }
    // The claimed-donations list is this screen's primary content; the stories
    // lookup only drives an optional "already published" badge, so it degrades
    // silently instead of blocking the list (e.g. not applicable to this
    // account's role).
    const [donationsResult, storiesResult] = await Promise.allSettled([
      apiFetch<InstitutionDonationView[]>('/donations/claimed-by-me', { idToken }),
      apiFetch<SuccessStory[]>('/success-stories/mine', { idToken }),
    ]);
    if (donationsResult.status === 'fulfilled') {
      setDonations(donationsResult.value);
      setError('');
    } else {
      setError(donationsResult.reason instanceof ApiError ? donationsResult.reason.message : t('donations.claimed.loadError'));
    }
    if (storiesResult.status === 'fulfilled') {
      setStoriesByDonation(new Set(storiesResult.value.map((s) => s.Donation_ID)));
    }
  }

  // Real-device finding, 2026-08-04: only fetched once on mount, so this
  // tab never reflected a change made elsewhere without a full app restart.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [firebaseUser]),
  );

  // Real-device finding, 2026-08-04: everything rendered in one flat list
  // with no distinction between "still needs action" and "delivered — done."
  // A thin section header separates them instead of a new tab, so this
  // stays a small, contained change rather than a navigation restructure.
  // Pilot feedback, 2026-08-05: within each section, order followed
  // whatever /donations/claimed-by-me returned (Date_Claimed desc) — this
  // sorts by pipeline stage instead (Aceite → Recolha Agendada → Recolhida
  // → Entregue), Date_Claimed desc as the tiebreaker within a stage. Plus a
  // search box, also requested.
  const byStage = (a: InstitutionDonationView, b: InstitutionDonationView) => {
    const byStatus = DONATION_STATUSES.indexOf(a.Status) - DONATION_STATUSES.indexOf(b.Status);
    return byStatus !== 0 ? byStatus : (b.Date_Claimed ?? '').localeCompare(a.Date_Claimed ?? '');
  };

  const searchedAndDeliveryFiltered = useMemo(() => {
    if (!donations) return null;
    const q = search.trim().toLowerCase();
    let visible = q
      ? donations.filter(
          (d) =>
            d.Item_Type.toLowerCase().includes(q) ||
            d.Public_Donation_Code.toLowerCase().includes(q) ||
            (d.Donor_Display_Name ?? '').toLowerCase().includes(q),
        )
      : donations;
    if (deliveryFilter !== 'all') {
      visible = visible.filter((d) => d.Delivery_Method === deliveryFilter);
    }
    return visible;
  }, [donations, search, deliveryFilter]);

  const statusCounts = useMemo(() => {
    const list = searchedAndDeliveryFiltered ?? [];
    return {
      all: list.length,
      active: list.filter((d) => d.Status !== 'Delivered').length,
      delivered: list.filter((d) => d.Status === 'Delivered').length,
    };
  }, [searchedAndDeliveryFiltered]);

  const visibleDonations = useMemo(() => {
    const list = searchedAndDeliveryFiltered ?? [];
    const filtered =
      statusFilter === 'active'
        ? list.filter((d) => d.Status !== 'Delivered')
        : statusFilter === 'delivered'
          ? list.filter((d) => d.Status === 'Delivered')
          : list;
    return [...filtered].sort(byStage);
  }, [searchedAndDeliveryFiltered, statusFilter]);

  // A notification deep-links here with a specific donationId — whichever
  // filter tab that donation actually belongs to must win, otherwise it
  // could be filed under a tab the institution isn't currently viewing.
  useEffect(() => {
    if (!highlightId || !donations) return;
    const target = donations.find((d) => d.Donation_ID === highlightId);
    if (!target) return;
    setStatusFilter(target.Status === 'Delivered' ? 'delivered' : 'active');
  }, [highlightId, donations]);

  // Real-device finding, 2026-08-07 — deep-linking here from a donation
  // notification always landed at the top of the list with no indication of
  // which item it was about. Scroll to it once it's in the loaded (and
  // correctly-filtered) list.
  useEffect(() => {
    if (!highlightId || visibleDonations.length === 0) return;
    const index = visibleDonations.findIndex((d) => d.Donation_ID === highlightId);
    if (index === -1) return;
    const timer = setTimeout(() => {
      try {
        listRef.current?.scrollToIndex({ index, animated: true, viewOffset: 20 });
      } catch {
        // Not measured yet — harmless, list is still usable without the scroll.
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [highlightId, visibleDonations]);

  const SUCCESS_MESSAGE: Record<'schedule-collection' | 'collect' | 'deliver', string> = {
    'schedule-collection': t('donations.claimed.successSchedule'),
    collect: t('donations.claimed.successCollect'),
    deliver: t('donations.claimed.successDeliver'),
  };

  async function onAction(
    donationId: string,
    action: 'schedule-collection' | 'collect' | 'deliver',
    failMessage: string,
  ) {
    const publicCode = donations?.find((d) => d.Donation_ID === donationId)?.Public_Donation_Code ?? '';
    setActingId(donationId);
    setError('');
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/donations/${donationId}/${action}`, { method: 'POST', idToken });
      // Pilot feedback, 2026-08-05: load() swallows its own errors (sets
      // `error` internally, doesn't re-throw) — so if only the post-action
      // refresh hit a transient hiccup (e.g. Sheets rate limit), the success
      // toast/alert below still fired right next to a leftover error banner,
      // showing "success!" and "something's wrong" at the same time. The
      // action itself already succeeded by this point; a stale list is
      // harmless (useFocusEffect refetches on the next visit), so clear
      // whatever load() may have just set rather than let it contradict the
      // success feedback the user is about to see.
      await load();
      setError('');
      showToast(SUCCESS_MESSAGE[action]);
      if (action === 'deliver') {
        Alert.alert(t('donations.claimed.deliverySuccessTitle'), t('donations.claimed.deliverySuccessBody'), [
          { text: t('donations.claimed.later'), style: 'cancel' },
          {
            text: t('donations.claimed.createStory'),
            onPress: () => navigation.navigate('NewSuccessStory', { donationId, publicCode }),
          },
        ]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : failMessage);
    } finally {
      setActingId(null);
    }
  }

  /**
   * Donation lifecycle emails, 2026-08-11 — same "deliver" endpoint and
   * success flow as onAction above, but from the ThankYouNoteModal, where a
   * message and/or photo may have been left. Kept separate from onAction
   * rather than folding a conditional multipart branch into it — the two
   * request shapes (multipart-with-photo vs plain JSON) are different enough
   * that sharing the function would obscure both call sites more than the
   * small duplication here does.
   */
  async function onDeliverWithNote(donationId: string, message: string, photo: ImagePicker.ImagePickerAsset | null) {
    const publicCode = donations?.find((d) => d.Donation_ID === donationId)?.Public_Donation_Code ?? '';
    setActingId(donationId);
    setError('');
    try {
      const idToken = await firebaseUser?.getIdToken();
      if (photo) {
        await uploadFile(`/donations/${donationId}/deliver`, 'photo', photo.uri, {
          idToken,
          mimeType: photo.mimeType ?? 'image/jpeg',
          parameters: message ? { thankYouMessage: message } : {},
        });
      } else {
        await apiFetch(`/donations/${donationId}/deliver`, {
          method: 'POST',
          idToken,
          body: message ? { thankYouMessage: message } : undefined,
        });
      }
      await load();
      setError('');
      setDeliverModalDonationId(null);
      showToast(SUCCESS_MESSAGE.deliver);
      Alert.alert(t('donations.claimed.deliverySuccessTitle'), t('donations.claimed.deliverySuccessBody'), [
        { text: t('donations.claimed.later'), style: 'cancel' },
        {
          text: t('donations.claimed.createStory'),
          onPress: () => navigation.navigate('NewSuccessStory', { donationId, publicCode }),
        },
      ]);
    } catch (err) {
      // Close the modal on failure too, so the screen's own error banner
      // (rendered behind it) is actually visible instead of hidden by the
      // modal overlay.
      setDeliverModalDonationId(null);
      setError(err instanceof ApiError ? err.message : t('donations.claimed.deliverError'));
    } finally {
      setActingId(null);
    }
  }

  function onSkipDeliver() {
    if (!deliverModalDonationId) return;
    const id = deliverModalDonationId;
    setDeliverModalDonationId(null);
    onAction(id, 'deliver', t('donations.claimed.deliverError'));
  }

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
              <Text style={styles.title}>{t('donations.claimed.title')}</Text>
              <Pressable onPress={() => navigation.navigate('MySuccessStories')}>
                <Text style={styles.mapLink}>{t('donations.claimed.viewStories')}</Text>
              </Pressable>
            </View>
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {!error && donations === null && <Text style={styles.loading}>{t('common.loading')}</Text>}
            {donations && donations.length > 0 && (
              <>
                <Input
                  label={t('common.search')}
                  placeholder={t('donations.claimed.searchPlaceholder')}
                  value={search}
                  onChangeText={setSearch}
                  style={{ marginBottom: spacing[3] }}
                />
                <View style={styles.filterRow}>
                  {(
                    [
                      { key: 'all', label: t('donations.claimed.filterAll', { count: statusCounts.all }) },
                      { key: 'active', label: t('donations.claimed.filterActive', { count: statusCounts.active }) },
                      {
                        key: 'delivered',
                        label: t('donations.claimed.filterDelivered', { count: statusCounts.delivered }),
                      },
                    ] as { key: StatusFilter; label: string }[]
                  ).map((f) => (
                    <Pressable
                      key={f.key}
                      onPress={() => setStatusFilter(f.key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: statusFilter === f.key }}
                      style={[styles.filterChip, statusFilter === f.key && styles.filterChipActive]}
                    >
                      <Text style={[styles.filterChipText, statusFilter === f.key && styles.filterChipTextActive]}>
                        {f.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.filterRow}>
                  {(['all', ...DELIVERY_METHODS] as const).map((f) => (
                    <Pressable
                      key={f}
                      onPress={() => setDeliveryFilter(f)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: deliveryFilter === f }}
                      style={[styles.filterChip, deliveryFilter === f && styles.filterChipActive]}
                    >
                      <Text style={[styles.filterChipText, deliveryFilter === f && styles.filterChipTextActive]}>
                        {f === 'all' ? t('donations.claimed.filterAllMethods') : t(DELIVERY_METHOD_LABEL_KEY[f])}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            {donations?.length === 0 && (
              <EmptyState
                title={t('donations.claimed.emptyNoneTitle')}
                description={t('donations.claimed.emptyNoneDescription')}
                icon="checkmark-circle-outline"
              />
            )}
            {donations && donations.length > 0 && visibleDonations.length === 0 && (
              <EmptyState
                title={t('donations.claimed.emptyNoResultsTitle')}
                description={t('donations.claimed.emptyNoResultsDescription')}
                icon="search-outline"
              />
            )}
          </>
        }
        data={visibleDonations}
        keyExtractor={(item) => item.Donation_ID}
        renderItem={({ item }) => (
          <Card style={[styles.card, item.Donation_ID === highlightId && styles.highlightedCard]}>
            <Photo uri={item.Photo} style={styles.photo} resizeMode="contain" />
            <View style={styles.cardBody}>
              <View style={styles.rowBetween}>
                <Text style={styles.itemType}>{item.Item_Type}</Text>
                <Badge tone={DONATION_STATUS_TONE[item.Status]}>{t(DONATION_STATUS_LABEL_KEY[item.Status])}</Badge>
              </View>
              <Text style={styles.mono}>{item.Public_Donation_Code}</Text>
              <Text style={styles.meta}>
                {t('donations.available.qtyCondition', { qty: item.Quantity, condition: item.Condition })}
              </Text>
              <Text style={styles.meta}>
                {item.Recipient_Category ? t(RECIPIENT_CATEGORY_LABEL_KEY[item.Recipient_Category]) : '—'}
                {' · '}
                {item.Delivery_Method ? t(DELIVERY_METHOD_LABEL_KEY[item.Delivery_Method]) : '—'}
              </Text>
              {item.City && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.meta}>📍 {item.City}</Text>
                  <Pressable
                    onPress={() =>
                      Linking.openURL(`https://www.google.com/maps?q=${item.Location.lat},${item.Location.lng}`)
                    }
                  >
                    <Text style={styles.mapLink}>{t('donations.available.viewOnMap')}</Text>
                  </Pressable>
                </View>
              )}
              {/* RC1 pickup-location fix, 2026-08-07 — see AvailableDonationsScreen for context. */}
              {item.Address && <Text style={styles.meta}>🏠 {item.Address}</Text>}
              {item.Donor_Display_Name && (
                <View style={styles.donorRow}>
                  <Photo uri={item.Donor_Display_Logo} placeholderIcon="👤" style={styles.donorLogo} />
                  <Text style={styles.donorName}>{item.Donor_Display_Name}</Text>
                </View>
              )}
              {item.Donor_Phone && (
                <Pressable onPress={() => Linking.openURL(`tel:${item.Donor_Phone}`)}>
                  <Text style={styles.mapLink}>📞 {item.Donor_Phone}</Text>
                </Pressable>
              )}
              <Text style={styles.dateLabel}>📅 {daysAgoLabel(item.Date_Submitted)}</Text>
              {(item.Expected_Collection_Date || item.Expected_Delivery_Date) && (
                <Text style={styles.meta}>
                  {item.Expected_Collection_Date &&
                    t('donations.claimed.expectedCollection', {
                      date: formatDateLabel(item.Expected_Collection_Date),
                    })}
                  {item.Expected_Collection_Date && item.Expected_Delivery_Date && ' · '}
                  {item.Expected_Delivery_Date &&
                    t('donations.claimed.expectedDelivery', { date: formatDateLabel(item.Expected_Delivery_Date) })}
                </Text>
              )}
              <View style={{ marginTop: 4, marginBottom: 4 }}>
                <DonationTimeline donation={item} />
              </View>
              <View style={styles.actions}>
                {item.Status === 'Claimed' && (
                  <Button
                    variant="secondary"
                    onPress={() =>
                      onAction(item.Donation_ID, 'schedule-collection', t('donations.claimed.scheduleError'))
                    }
                    disabled={actingId === item.Donation_ID}
                  >
                    {actingId === item.Donation_ID
                      ? t('donations.claimed.scheduling')
                      : t('donations.claimed.confirmScheduled')}
                  </Button>
                )}
                {item.Status === 'Collection_Scheduled' && (
                  <Button
                    variant="secondary"
                    onPress={() => onAction(item.Donation_ID, 'collect', t('donations.claimed.collectError'))}
                    disabled={actingId === item.Donation_ID}
                  >
                    {actingId === item.Donation_ID
                      ? t('donations.claimed.confirming')
                      : t('donations.claimed.markCollected')}
                  </Button>
                )}
                {item.Status === 'Collected' && (
                  <Button
                    variant="secondary"
                    onPress={() => setDeliverModalDonationId(item.Donation_ID)}
                    disabled={actingId === item.Donation_ID}
                  >
                    {actingId === item.Donation_ID
                      ? t('donations.claimed.confirming')
                      : t('donations.claimed.confirmDelivery')}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onPress={() =>
                    navigation.getParent()?.navigate('Disputes', {
                      screen: 'NewDispute',
                      params: { donationId: item.Donation_ID, publicCode: item.Public_Donation_Code },
                    })
                  }
                >
                  {t('donations.claimed.reportIssue')}
                </Button>
                {item.Status === 'Delivered' &&
                  (storiesByDonation.has(item.Donation_ID) ? (
                    <Text style={styles.storyPublished}>{t('donations.claimed.storyPublished')}</Text>
                  ) : (
                    <Button
                      variant="ghost"
                      onPress={() =>
                        navigation.navigate('NewSuccessStory', {
                          donationId: item.Donation_ID,
                          publicCode: item.Public_Donation_Code,
                        })
                      }
                    >
                      {t('donations.claimed.publishStory')}
                    </Button>
                  ))}
              </View>
            </View>
          </Card>
        )}
      />
      <ThankYouNoteModal
        visible={deliverModalDonationId !== null}
        submitting={actingId === deliverModalDonationId}
        onSkip={onSkipDeliver}
        onSubmit={(message, photo) => deliverModalDonationId && onDeliverWithNote(deliverModalDonationId, message, photo)}
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
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  filterChip: {
    paddingVertical: 11,
    paddingHorizontal: 14,
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
  card: {
    padding: 0,
    overflow: 'hidden',
    gap: 0,
    marginBottom: spacing[3],
  },
  highlightedCard: {
    borderColor: colors.accent,
    borderWidth: 2,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: 4,
  },
  itemType: {
    fontFamily: 'Manrope-700',
    fontSize: 16.5,
    color: colors.text,
  },
  meta: {
    fontFamily: 'Manrope-400',
    fontSize: 13.5,
    color: colors.textMuted,
  },
  storyPublished: {
    fontFamily: 'Manrope-600',
    fontSize: 12,
    color: colors.success,
    alignSelf: 'center',
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textFaint,
  },
  mapLink: {
    fontFamily: 'Manrope-600',
    fontSize: 13.5,
    color: colors.accent,
  },
  donorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  donorLogo: {
    width: 26,
    height: 26,
    borderRadius: 6,
  },
  donorName: {
    fontFamily: 'Manrope-600',
    fontSize: 14,
    color: colors.text,
  },
  dateLabel: {
    fontFamily: 'Manrope-400',
    fontSize: 12,
    color: colors.textFaint,
  },
});
