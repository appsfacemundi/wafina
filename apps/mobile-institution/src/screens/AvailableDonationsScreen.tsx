import {
  daysAgoLabel,
  DELIVERY_METHOD_LABEL_KEY,
  DELIVERY_METHODS,
  getDistanceThresholds,
  getDistanceTier,
  RECIPIENT_CATEGORY_LABEL_KEY,
  requiresDistanceConfirmation,
  type DeliveryMethod,
  type GeoRegion,
  type InstitutionDonationView,
} from '@wafina/shared';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { Photo } from '@/components/Photo';
import { PhotoGalleryModal } from '@/components/PhotoGalleryModal';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useOwnInstitution } from '@/hooks/useOwnInstitution';
import { apiFetch, ApiError } from '@/lib/api';
import { colors, fonts, spacing } from '@/theme/tokens';

export function AvailableDonationsScreen() {
  const { t } = useTranslation();
  const { firebaseUser } = useAuth();
  const { institution } = useOwnInstitution();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [donations, setDonations] = useState<InstitutionDonationView[] | null>(null);
  const [countryName, setCountryName] = useState('');
  const [error, setError] = useState('');
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryMethod | 'all'>('all');
  // V2 multi-photo (2026-08-17) — which card's full gallery is open, if any.
  const [galleryDonation, setGalleryDonation] = useState<InstitutionDonationView | null>(null);
  // V2 GPS distance (2026-08-17) — country's own ISO_Code, for per-country
  // threshold lookup (see getDistanceThresholds); sortByDistance toggle.
  const [countryIsoCode, setCountryIsoCode] = useState<string | null>(null);
  const [sortByDistance, setSortByDistance] = useState(false);

  async function load() {
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      setDonations(await apiFetch<InstitutionDonationView[]>('/donations/available', { idToken }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('donations.available.loadError'));
    }
  }

  // Real-device finding, 2026-08-13: this only ran once on mount, so a
  // donation approved by Admin (or newly matching) after this tab's first
  // load never appeared until the app was fully restarted — same
  // missing-refetch pattern already fixed on mobile-donor's MyDonationsScreen
  // via useFocusEffect.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [firebaseUser]),
  );

  useEffect(() => {
    if (!firebaseUser || !institution?.Country_ID) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        const countries = await apiFetch<GeoRegion[]>('/geo-regions/all-countries', { idToken });
        const country = countries.find((c) => c.Region_ID === institution.Country_ID);
        setCountryName(country?.Name ?? '');
        setCountryIsoCode(country?.ISO_Code ?? null);
      } catch {
        // Non-critical — the card just omits the country name if this fails.
      }
    })();
  }, [firebaseUser, institution?.Country_ID]);

  const filtered = useMemo(() => {
    if (!donations) return donations;
    let result = donations;
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (d) => d.Item_Type.toLowerCase().includes(q) || d.Condition.toLowerCase().includes(q),
      );
    }
    if (deliveryFilter !== 'all') {
      result = result.filter((d) => d.Delivery_Method === deliveryFilter);
    }
    // V2 GPS distance (2026-08-17) — nulls (no computable distance) sort last, never first.
    if (sortByDistance) {
      result = [...result].sort((a, b) => {
        if (a.Distance_Km === null && b.Distance_Km === null) return 0;
        if (a.Distance_Km === null) return 1;
        if (b.Distance_Km === null) return -1;
        return a.Distance_Km - b.Distance_Km;
      });
    }
    return result;
  }, [donations, query, deliveryFilter, sortByDistance]);

  async function onClaim(donationId: string) {
    setClaimingId(donationId);
    setError('');
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/donations/${donationId}/claim`, { method: 'POST', idToken });
      await load();
      showToast(t('donations.available.claimSuccess'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('donations.available.claimError'));
    } finally {
      setClaimingId(null);
    }
  }

  /**
   * V2 GPS distance (2026-08-17) — the ONLY path allowed to skip straight to
   * onClaim is a distance under the country's own `warn` threshold (or an
   * unknown distance) — never automatic, per the approved decision. Above
   * `warn`, this shows a confirm dialog naming the donation's own location
   * and the approximate distance; onClaim only fires from the dialog's
   * explicit "Sim, Aceitar", never from the raw button tap.
   */
  function onClaimPress(item: InstitutionDonationView) {
    if (item.Distance_Km === null) {
      onClaim(item.Donation_ID);
      return;
    }
    const thresholds = getDistanceThresholds(countryIsoCode);
    if (!requiresDistanceConfirmation(item.Distance_Km, thresholds)) {
      onClaim(item.Donation_ID);
      return;
    }
    const tier = getDistanceTier(item.Distance_Km, thresholds);
    const location = [item.Address, item.City].filter(Boolean).join(', ') || t('donations.available.locationUnknown');
    Alert.alert(
      tier === 'farWarn' ? t('donations.available.confirmDistanceTitleFar') : t('donations.available.confirmDistanceTitle'),
      t('donations.available.confirmDistanceMessage', { distance: Math.round(item.Distance_Km), location }),
      [
        { text: t('donations.available.confirmDistanceCancel'), style: 'cancel' },
        { text: t('donations.available.confirmDistanceAccept'), onPress: () => onClaim(item.Donation_ID) },
      ],
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>{t('donations.available.title')}</Text>
            {donations && donations.length > 0 && (
              <>
                <Input
                  label={t('donations.available.filterLabel')}
                  placeholder={t('donations.available.filterPlaceholder')}
                  value={query}
                  onChangeText={setQuery}
                />
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
                        {f === 'all' ? t('donations.available.filterAll') : t(DELIVERY_METHOD_LABEL_KEY[f])}
                      </Text>
                    </Pressable>
                  ))}
                  {/* V2 GPS distance (2026-08-17) — optional, off by default (newest-first stays the default order). */}
                  <Pressable
                    onPress={() => setSortByDistance((v) => !v)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: sortByDistance }}
                    style={[styles.filterChip, sortByDistance && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterChipText, sortByDistance && styles.filterChipTextActive]}>
                      {t('donations.available.sortByDistance')}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {!error && donations === null && <Text style={styles.loading}>{t('common.loading')}</Text>}
            {donations?.length === 0 && (
              <EmptyState
                title={t('donations.available.emptyNoneTitle')}
                description={t('donations.available.emptyNoneDescription')}
                icon="gift-outline"
              />
            )}
            {donations && donations.length > 0 && filtered?.length === 0 && (
              <EmptyState
                title={t('donations.available.emptyNoResultsTitle')}
                description={t('donations.available.emptyNoResultsDescription')}
                icon="search-outline"
              />
            )}
          </>
        }
        data={filtered ?? []}
        keyExtractor={(item) => item.Donation_ID}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            {/* V2 multi-photo (2026-08-17) — tap to open the full gallery; badge only shows once there's more than one photo. */}
            <Pressable onPress={() => setGalleryDonation(item)} accessibilityRole="button" style={styles.photoWrap}>
              <Photo uri={item.Photo} style={styles.photo} resizeMode="contain" />
              {item.Photos.length > 1 && (
                <View style={styles.photoCountBadge}>
                  <Text style={styles.photoCountBadgeText}>📷 {item.Photos.length}</Text>
                </View>
              )}
            </Pressable>
            <View style={styles.cardBody}>
              <View style={styles.rowBetween}>
                <Text style={styles.itemType}>{item.Item_Type}</Text>
                <Text style={styles.mono}>{item.Public_Donation_Code}</Text>
              </View>
              <Text style={styles.meta}>
                {t('donations.available.qtyCondition', { qty: item.Quantity, condition: item.Condition })}
              </Text>
              <Text style={styles.meta}>
                {item.Recipient_Category ? t(RECIPIENT_CATEGORY_LABEL_KEY[item.Recipient_Category]) : '—'}
                {' · '}
                {item.Delivery_Method ? t(DELIVERY_METHOD_LABEL_KEY[item.Delivery_Method]) : '—'}
              </Text>
              {(item.City || countryName) && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.meta}>📍 {[item.City, countryName].filter(Boolean).join(', ')}</Text>
                  <Pressable
                    onPress={() =>
                      Linking.openURL(`https://www.google.com/maps?q=${item.Location.lat},${item.Location.lng}`)
                    }
                  >
                    <Text style={styles.mapLink}>{t('donations.available.viewOnMap')}</Text>
                  </Pressable>
                </View>
              )}
              {/*
                V2 GPS distance (2026-08-17) — always visible per the
                approved decision ("distance is a decision factor, not
                simply a filter"), not just above the warning threshold.
                Tone shifts (default -> warning -> danger color) with the
                same tier the confirm dialog uses, so the card itself hints
                at what a tap will trigger before the institution commits.
              */}
              {item.Distance_Km !== null && (
                <Text
                  style={[
                    styles.meta,
                    (() => {
                      const tier = getDistanceTier(item.Distance_Km, getDistanceThresholds(countryIsoCode));
                      if (tier === 'farWarn') return styles.metaDanger;
                      if (tier === 'warn') return styles.metaWarning;
                      return undefined;
                    })(),
                  ]}
                >
                  📏 {t('donations.available.distanceLine', { distance: Math.round(item.Distance_Km) })}
                </Text>
              )}
              {/*
                RC1 pickup-location fix, 2026-08-07 — the map pin alone left
                no way to identify the exact spot (which door/apartment) or
                to reach the donor if they couldn't be found there. Address
                is whatever the donor typed at submission; phone follows the
                same Show_Name_To_Institutions gate as the donor's name.
              */}
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
              <Button onPress={() => onClaimPress(item)} disabled={claimingId === item.Donation_ID} fullWidth>
                {claimingId === item.Donation_ID
                  ? t('donations.available.claiming')
                  : t('donations.available.claimButton')}
              </Button>
            </View>
          </Card>
        )}
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
  content: {
    padding: spacing[6],
    gap: spacing[4],
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
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
    marginBottom: spacing[2],
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
    marginBottom: spacing[4],
  },
  // V2 multi-photo (2026-08-17) — wraps the cover Photo so the photo-count badge can anchor to it.
  photoWrap: {
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: 180,
    backgroundColor: colors.surface2,
  },
  photoCountBadge: {
    position: 'absolute',
    bottom: spacing[2],
    right: spacing[2],
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  photoCountBadgeText: {
    fontFamily: 'Manrope-700',
    fontSize: 11,
    color: '#ffffff',
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
  // V2 GPS distance (2026-08-17) — same tier the confirm dialog gates on.
  metaWarning: {
    color: colors.warning,
    fontFamily: 'Manrope-600',
  },
  metaDanger: {
    color: colors.danger,
    fontFamily: 'Manrope-600',
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
    marginBottom: 4,
  },
});
