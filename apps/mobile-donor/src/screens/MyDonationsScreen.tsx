import {
  DELIVERY_METHOD_LABEL,
  DONATION_STATUS_LABEL,
  DONATION_STATUS_TONE,
  DONATION_STATUSES,
  RECIPIENT_CATEGORY_LABEL,
  formatDateLabel,
  type CorporateAccount,
  type Donation,
  type SuccessStory,
} from '@wafina/shared';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { DonationTimeline } from '@/components/DonationTimeline';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import type { MyDonationsStackParamList } from '@/navigation/RootNavigator';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

type Props = NativeStackScreenProps<MyDonationsStackParamList, 'MyDonationsList'>;

export function MyDonationsScreen({ navigation }: Props) {
  const { firebaseUser, session } = useAuth();
  const insets = useSafeAreaInsets();
  const [donations, setDonations] = useState<Donation[] | null>(null);
  const [storiesByDonation, setStoriesByDonation] = useState<Map<string, SuccessStory>>(new Map());
  const [corporateAccount, setCorporateAccount] = useState<CorporateAccount | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

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
      quantity: donations.reduce((sum, d) => sum + d.Quantity, 0),
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

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}
        ListHeaderComponent={
          <>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Minhas Doações</Text>
              <Pressable onPress={() => navigation.navigate('Impact')}>
                <Text style={styles.impactLink}>Histórias de Impacto</Text>
              </Pressable>
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
              />
            )}
            {donations && donations.length > 0 && visibleDonations.length === 0 && (
              <EmptyState title="Sem resultados" description="Nenhuma doação corresponde à pesquisa." />
            )}
          </>
        }
        data={visibleDonations}
        keyExtractor={(item) => item.Donation_ID}
        renderItem={({ item }) => {
          const story = storiesByDonation.get(item.Donation_ID);
          return (
            <Card style={{ marginBottom: spacing[3], gap: spacing[3] }}>
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
  impactLink: {
    fontFamily: 'WorkSans-600',
    fontSize: 13.5,
    color: colors.accent,
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
    fontFamily: 'WorkSans-700',
    fontSize: 24,
    color: colors.text,
  },
  statLabel: {
    fontFamily: 'WorkSans-400',
    fontSize: 12,
    color: colors.textMuted,
  },
  loading: {
    fontFamily: 'WorkSans-400',
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
    fontFamily: 'WorkSans-400',
    fontSize: 13,
    color: colors.danger,
  },
  itemPhoto: {
    width: '100%',
    height: 140,
    borderRadius: radius.md,
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
    fontFamily: 'WorkSans-600',
    fontSize: 10.5,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.success,
  },
  storyTitle: {
    fontFamily: 'WorkSans-600',
    fontSize: 13.5,
    color: colors.text,
  },
  storyDescription: {
    fontFamily: 'WorkSans-400',
    fontSize: 12.5,
    color: colors.textMuted,
  },
  itemType: {
    fontFamily: 'WorkSans-600',
    fontSize: 15,
    color: colors.text,
  },
  donationId: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textFaint,
  },
});
