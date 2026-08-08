import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import {
  DELIVERY_METHOD_LABEL,
  daysAgoLabel,
  DONATION_STATUS_LABEL,
  DONATION_STATUS_TONE,
  DONATION_STATUSES,
  RECIPIENT_CATEGORY_LABEL,
  formatDateLabel,
  type CorporateAccount,
  type Donation,
  type SuccessStory,
} from '@wafina/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { DonationTimeline } from '@/components/DonationTimeline';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import type { AppTabParamList } from '@/navigation/RootNavigator';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

type Props = BottomTabScreenProps<AppTabParamList, 'MyDonations'>;

export function MyDonationsScreen({ route }: Props) {
  const { firebaseUser, session } = useAuth();
  const insets = useSafeAreaInsets();
  const highlightId = route.params?.donationId;
  const listRef = useRef<SectionList<Donation>>(null);
  const [donations, setDonations] = useState<Donation[] | null>(null);
  const [storiesByDonation, setStoriesByDonation] = useState<Map<string, SuccessStory>>(new Map());
  const [corporateAccount, setCorporateAccount] = useState<CorporateAccount | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  // Bug fix, 2026-08-08 — this list had no fold/expand at all despite having
  // the same Pending/Aceites/Entregue stages as every equivalent Admin/
  // Institution list, which already got this treatment.
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Real-device finding, 2026-08-04: this only ran once on mount, so a
  // donation submitted on the Donate tab never appeared here until the app
  // was fully restarted — useFocusEffect refetches every time this tab
  // becomes active, not just the first time.
  useFocusEffect(
    useCallback(() => {
      if (!firebaseUser) return;
      (async () => {
        try {
          const idToken = await firebaseUser.getIdToken();
          const [donationList, stories] = await Promise.all([
            apiFetch<Donation[]>('/donations/mine', { idToken }),
            apiFetch<SuccessStory[]>('/donor/success-stories', { idToken }),
          ]);
          setDonations(donationList);
          setStoriesByDonation(new Map(stories.map((s) => [s.Donation_ID, s])));
        } catch {
          setError('Não foi possível carregar as suas doações.');
        }
      })();
    }, [firebaseUser]),
  );

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

  // Bug fix, 2026-08-08 — grouped into the same three fold/expand sections as
  // Admin/Institution-web/Donor-web (Pendentes/Aceites/Entregue), instead of
  // one long flat list with no way to collapse a stage you don't need right now.
  const sections = useMemo(() => {
    const pending = visibleDonations.filter((d) => d.Status === 'Pending');
    const accepted = visibleDonations.filter(
      (d) => d.Status === 'Claimed' || d.Status === 'Collection_Scheduled' || d.Status === 'Collected',
    );
    const delivered = visibleDonations.filter((d) => d.Status === 'Delivered');
    // A section a donor previously collapsed shouldn't hide the very item a
    // notification just deep-linked them to — force that one section open.
    const isCollapsed = (key: string, items: Donation[]) =>
      !!collapsedSections[key] && !items.some((d) => d.Donation_ID === highlightId);
    return [
      ...(pending.length
        ? [{ key: 'pending', title: 'Pendentes', count: pending.length, data: isCollapsed('pending', pending) ? [] : pending }]
        : []),
      ...(accepted.length
        ? [{ key: 'accepted', title: 'Aceites', count: accepted.length, data: isCollapsed('accepted', accepted) ? [] : accepted }]
        : []),
      ...(delivered.length
        ? [
            {
              key: 'delivered',
              title: 'Entregue',
              count: delivered.length,
              data: isCollapsed('delivered', delivered) ? [] : delivered,
            },
          ]
        : []),
    ];
  }, [visibleDonations, collapsedSections, highlightId]);

  // Real-device finding, 2026-08-07 — deep-linking here from a donation
  // notification always landed at the top of the list with no indication
  // of which item the notification was about. Scroll to it once it's in
  // the (already-loaded) visible list. SectionList has no onScrollToIndexFailed
  // retry like FlatList, so this just waits long enough for the first layout
  // pass to have happened (matching the same pattern already proven on the
  // Institution app's Claimed-by-me screen).
  useEffect(() => {
    if (!highlightId || visibleDonations.length === 0) return;
    for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
      const itemIndex = sections[sectionIndex].data.findIndex((d) => d.Donation_ID === highlightId);
      if (itemIndex === -1) continue;
      const timer = setTimeout(() => {
        try {
          listRef.current?.scrollToLocation({ sectionIndex, itemIndex, animated: true, viewOffset: 20 });
        } catch {
          // Not measured yet — harmless, list is still usable without the scroll.
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [highlightId, sections, visibleDonations.length]);

  return (
    <View style={styles.screen}>
      <SectionList
        ref={listRef}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}
        ListHeaderComponent={
          <>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Minhas Doações</Text>
            </View>
            {stats && (
              <View style={styles.statsGrid}>
                {[
                  ['Total de doações', stats.total],
                  ['Itens doados (total)', stats.quantity],
                  ['Pendentes', stats.pending],
                  ['Aceites', stats.claimed],
                  ['Entregues', stats.delivered],
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
            {!error && donations === null && <Text style={styles.loading}>A carregar…</Text>}
            {donations && donations.length > 0 && (
              <Input
                label="Pesquisar"
                placeholder="Pesquisar por item ou código…"
                value={search}
                onChangeText={setSearch}
                style={{ marginBottom: spacing[4] }}
              />
            )}
            {donations?.length === 0 && (
              <EmptyState
                title="Ainda sem doações"
                description="Quando submeter uma doação, o estado dela aparece aqui."
                icon="gift-outline"
              />
            )}
            {donations && donations.length > 0 && visibleDonations.length === 0 && (
              <EmptyState title="Sem resultados" description="Nenhuma doação corresponde à pesquisa." icon="search-outline" />
            )}
          </>
        }
        sections={sections}
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
        renderItem={({ item }) => {
          const story = storiesByDonation.get(item.Donation_ID);
          return (
            <Card
              style={[
                { marginBottom: spacing[3], gap: spacing[3] },
                item.Donation_ID === highlightId && styles.highlightedCard,
              ]}
            >
              {item.Photo && <Image source={{ uri: item.Photo }} style={styles.itemPhoto} />}
              <View style={styles.donationRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemType}>{item.Item_Type}</Text>
                  <Text style={styles.donationId}>
                    {item.Public_Donation_Code} · Qtd {item.Quantity}
                  </Text>
                </View>
                <Badge tone={DONATION_STATUS_TONE[item.Status]}>{DONATION_STATUS_LABEL[item.Status]}</Badge>
              </View>
              <Text style={styles.donationId}>
                {item.Corporate_Account_ID
                  ? `🏢 Doação da Empresa${corporateAccount ? ` – ${corporateAccount.Company_Name}` : ''}`
                  : '👤 Doação Pessoal'}
              </Text>
              <Text style={styles.donationId}>
                {item.Recipient_Category ? RECIPIENT_CATEGORY_LABEL[item.Recipient_Category] : '—'}
                {' · '}
                {item.Delivery_Method ? DELIVERY_METHOD_LABEL[item.Delivery_Method] : '—'}
              </Text>
              <Text style={styles.donationId}>📅 {daysAgoLabel(item.Date_Submitted)}</Text>
              {(item.Expected_Collection_Date || item.Expected_Delivery_Date) && (
                <Text style={styles.donationId}>
                  {item.Expected_Collection_Date && `Recolha estimada: ${formatDateLabel(item.Expected_Collection_Date)}`}
                  {item.Expected_Collection_Date && item.Expected_Delivery_Date && ' · '}
                  {item.Expected_Delivery_Date && `Entrega estimada: ${formatDateLabel(item.Expected_Delivery_Date)}`}
                </Text>
              )}
              {item.Status !== 'Pending' && <DonationTimeline donation={item} />}
              {story && (
                <View style={styles.storyCard}>
                  <Image source={{ uri: story.Image }} style={styles.storyImage} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.storyLabel}>História de impacto</Text>
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
  itemPhoto: {
    width: '100%',
    height: 140,
    borderRadius: radius.md,
  },
  highlightedCard: {
    borderColor: colors.accent,
    borderWidth: 2,
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
