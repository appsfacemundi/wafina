import {
  DELIVERY_METHOD_LABEL,
  DELIVERY_METHODS,
  DONATION_STATUS_LABEL,
  DONATION_STATUS_TONE,
  DONATION_STATUSES,
  RECIPIENT_CATEGORY_LABEL,
  daysAgoLabel,
  formatDateLabel,
  type DeliveryMethod,
  type InstitutionDonationView,
  type SuccessStory,
} from '@wafina/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DonationTimeline } from '@/components/DonationTimeline';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { Photo } from '@/components/Photo';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { apiFetch, ApiError } from '@/lib/api';
import type { ClaimedByMeStackParamList } from '@/navigation/RootNavigator';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

type Props = NativeStackScreenProps<ClaimedByMeStackParamList, 'ClaimedByMeList'>;

export function ClaimedByMeScreen({ navigation, route }: Props) {
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const highlightId = route.params?.donationId;
  const listRef = useRef<SectionList<InstitutionDonationView>>(null);
  const [donations, setDonations] = useState<InstitutionDonationView[] | null>(null);
  const [storiesByDonation, setStoriesByDonation] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryMethod | 'all'>('all');
  // Bug fix, 2026-08-08 — sections had static, always-expanded headers with no
  // fold/expand at all, unlike the equivalent Admin/Institution-web lists.
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  async function load() {
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      const [donationList, stories] = await Promise.all([
        apiFetch<InstitutionDonationView[]>('/donations/claimed-by-me', { idToken }),
        apiFetch<SuccessStory[]>('/success-stories/mine', { idToken }),
      ]);
      setDonations(donationList);
      setStoriesByDonation(new Set(stories.map((s) => s.Donation_ID)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as doações.');
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

  const sections = useMemo(() => {
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
    const active = visible.filter((d) => d.Status !== 'Delivered').sort(byStage);
    const delivered = visible.filter((d) => d.Status === 'Delivered').sort(byStage);
    return [
      ...(active.length
        ? [{ key: 'active', title: 'Em Curso', count: active.length, data: collapsedSections.active ? [] : active }]
        : []),
      ...(delivered.length
        ? [
            {
              key: 'delivered',
              title: 'Entregues',
              count: delivered.length,
              data: collapsedSections.delivered ? [] : delivered,
            },
          ]
        : []),
    ];
  }, [donations, search, deliveryFilter, collapsedSections]);

  // Real-device finding, 2026-08-07 — deep-linking here from a donation
  // notification always landed at the top of the list with no indication of
  // which item it was about. Scroll to it once it's in the loaded sections;
  // SectionList has no onScrollToIndexFailed retry like FlatList, so this
  // just waits long enough for the first layout pass to have happened.
  useEffect(() => {
    if (!highlightId || !sections) return;
    for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
      const itemIndex = sections[sectionIndex].data.findIndex((d) => d.Donation_ID === highlightId);
      if (itemIndex === -1) continue;
      const timer = setTimeout(() => {
        try {
          listRef.current?.scrollToLocation({ sectionIndex, itemIndex, animated: true, viewOffset: 20 });
        } catch {
          // Not measured yet — harmless, list is still usable without the scroll.
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [highlightId, sections]);

  const SUCCESS_MESSAGE: Record<'schedule-collection' | 'collect' | 'deliver', string> = {
    'schedule-collection': 'Recolha agendada com sucesso!',
    collect: 'Doação marcada como recolhida!',
    deliver: 'Entrega confirmada com sucesso!',
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
        Alert.alert(
          'Parabéns! 🎉',
          'A doação foi entregue com sucesso. Gostaria de criar uma História de Impacto agora?',
          [
            { text: 'Mais tarde', style: 'cancel' },
            {
              text: 'Criar História',
              onPress: () => navigation.navigate('NewSuccessStory', { donationId, publicCode }),
            },
          ],
        );
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : failMessage);
    } finally {
      setActingId(null);
    }
  }

  return (
    <View style={styles.screen}>
      <SectionList
        ref={listRef}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}
        ListHeaderComponent={
          <>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Doações Aceites</Text>
              <Pressable onPress={() => navigation.navigate('MySuccessStories')}>
                <Text style={styles.mapLink}>Histórias de Impacto</Text>
              </Pressable>
            </View>
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {!error && donations === null && <Text style={styles.loading}>A carregar…</Text>}
            {donations && donations.length > 0 && (
              <>
                <Input
                  label="Pesquisar"
                  placeholder="Pesquisar por item, código ou doador…"
                  value={search}
                  onChangeText={setSearch}
                  style={{ marginBottom: spacing[3] }}
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
                        {f === 'all' ? 'Todos' : DELIVERY_METHOD_LABEL[f]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            {donations?.length === 0 && (
              <EmptyState
                title="Ainda sem doações aceites"
                description="As doações que aceitar aparecem aqui."
                icon="checkmark-circle-outline"
              />
            )}
            {donations && donations.length > 0 && sections?.length === 0 && (
              <EmptyState title="Sem resultados" description="Nenhuma doação corresponde à pesquisa." icon="search-outline" />
            )}
          </>
        }
        sections={sections ?? []}
        keyExtractor={(item) => item.Donation_ID}
        renderSectionHeader={({ section }) => {
          const key = section.key ?? '';
          const collapsed = !!collapsedSections[key];
          return (
            <Pressable
              onPress={() => setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }))}
              style={[styles.sectionHeader, !collapsed && styles.sectionHeaderExpanded]}
              accessibilityRole="button"
              accessibilityState={{ expanded: !collapsed }}
            >
              <Ionicons
                name="chevron-down"
                size={14}
                color={collapsed ? colors.textFaint : colors.accent}
                style={{ transform: [{ rotate: collapsed ? '-90deg' : '0deg' }] }}
              />
              <Text style={[styles.sectionHeaderText, !collapsed && styles.sectionHeaderTextExpanded]}>
                {section.title}
              </Text>
              <Text style={styles.sectionHeaderCount}>({section.count})</Text>
            </Pressable>
          );
        }}
        renderItem={({ item }) => (
          <Card style={[styles.card, item.Donation_ID === highlightId && styles.highlightedCard]}>
            <Photo uri={item.Photo} style={styles.photo} />
            <View style={styles.cardBody}>
              <View style={styles.rowBetween}>
                <Text style={styles.itemType}>{item.Item_Type}</Text>
                <Badge tone={DONATION_STATUS_TONE[item.Status]}>{DONATION_STATUS_LABEL[item.Status]}</Badge>
              </View>
              <Text style={styles.mono}>{item.Public_Donation_Code}</Text>
              <Text style={styles.meta}>
                Qtd: {item.Quantity} · Estado: {item.Condition}
              </Text>
              <Text style={styles.meta}>
                {item.Recipient_Category ? RECIPIENT_CATEGORY_LABEL[item.Recipient_Category] : '—'}
                {' · '}
                {item.Delivery_Method ? DELIVERY_METHOD_LABEL[item.Delivery_Method] : '—'}
              </Text>
              {item.City && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.meta}>📍 {item.City}</Text>
                  <Pressable
                    onPress={() =>
                      Linking.openURL(`https://www.google.com/maps?q=${item.Location.lat},${item.Location.lng}`)
                    }
                  >
                    <Text style={styles.mapLink}>Ver no mapa</Text>
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
                  {item.Expected_Collection_Date && `Recolha estimada: ${formatDateLabel(item.Expected_Collection_Date)}`}
                  {item.Expected_Collection_Date && item.Expected_Delivery_Date && ' · '}
                  {item.Expected_Delivery_Date && `Entrega estimada: ${formatDateLabel(item.Expected_Delivery_Date)}`}
                </Text>
              )}
              <View style={{ marginTop: 4, marginBottom: 4 }}>
                <DonationTimeline donation={item} />
              </View>
              <View style={styles.actions}>
                {item.Status === 'Claimed' && (
                  <Button
                    variant="secondary"
                    onPress={() => onAction(item.Donation_ID, 'schedule-collection', 'Não foi possível agendar a recolha.')}
                    disabled={actingId === item.Donation_ID}
                  >
                    {actingId === item.Donation_ID ? 'A agendar…' : 'Confirmar recolha agendada'}
                  </Button>
                )}
                {item.Status === 'Collection_Scheduled' && (
                  <Button
                    variant="secondary"
                    onPress={() => onAction(item.Donation_ID, 'collect', 'Não foi possível marcar como recolhida.')}
                    disabled={actingId === item.Donation_ID}
                  >
                    {actingId === item.Donation_ID ? 'A confirmar…' : 'Marcar como recolhida'}
                  </Button>
                )}
                {item.Status === 'Collected' && (
                  <Button
                    variant="secondary"
                    onPress={() => onAction(item.Donation_ID, 'deliver', 'Não foi possível confirmar a entrega.')}
                    disabled={actingId === item.Donation_ID}
                  >
                    {actingId === item.Donation_ID ? 'A confirmar…' : 'Confirmar entrega'}
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
                  Comunicar Ocorrência
                </Button>
                {item.Status === 'Delivered' &&
                  (storiesByDonation.has(item.Donation_ID) ? (
                    <Text style={styles.storyPublished}>✓ História publicada</Text>
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
                      Publicar história
                    </Button>
                  ))}
              </View>
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
  },
  cardBody: {
    padding: spacing[4],
    gap: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[2],
    marginBottom: spacing[3],
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeaderExpanded: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  sectionHeaderText: {
    fontFamily: 'Manrope-600',
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  sectionHeaderTextExpanded: {
    color: colors.accent,
  },
  sectionHeaderCount: {
    fontFamily: 'Manrope-600',
    fontSize: 12,
    color: colors.textFaint,
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
