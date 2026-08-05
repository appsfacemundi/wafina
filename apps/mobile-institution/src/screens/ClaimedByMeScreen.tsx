import {
  DONATION_STATUS_LABEL,
  DONATION_STATUS_TONE,
  DONATION_STATUSES,
  daysAgoLabel,
  formatDateLabel,
  type InstitutionDonationView,
  type SuccessStory,
} from '@wafina/shared';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
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
import { colors, fonts, spacing } from '@/theme/tokens';

type Props = NativeStackScreenProps<ClaimedByMeStackParamList, 'ClaimedByMeList'>;

export function ClaimedByMeScreen({ navigation }: Props) {
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [donations, setDonations] = useState<InstitutionDonationView[] | null>(null);
  const [storiesByDonation, setStoriesByDonation] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

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
    const visible = q
      ? donations.filter(
          (d) =>
            d.Item_Type.toLowerCase().includes(q) ||
            d.Public_Donation_Code.toLowerCase().includes(q) ||
            (d.Donor_Display_Name ?? '').toLowerCase().includes(q),
        )
      : donations;
    const active = visible.filter((d) => d.Status !== 'Delivered').sort(byStage);
    const delivered = visible.filter((d) => d.Status === 'Delivered').sort(byStage);
    return [
      ...(active.length ? [{ title: null, data: active }] : []),
      ...(delivered.length ? [{ title: 'Entregues', data: delivered }] : []),
    ];
  }, [donations, search]);

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
      await load();
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
              <Input
                label="Pesquisar"
                placeholder="Pesquisar por item, código ou doador…"
                value={search}
                onChangeText={setSearch}
                style={{ marginBottom: spacing[3] }}
              />
            )}
            {donations?.length === 0 && (
              <EmptyState
                title="Ainda sem doações aceites"
                description="As doações que aceitar aparecem aqui."
              />
            )}
            {donations && donations.length > 0 && sections?.length === 0 && (
              <EmptyState title="Sem resultados" description="Nenhuma doação corresponde à pesquisa." />
            )}
          </>
        }
        sections={sections ?? []}
        keyExtractor={(item) => item.Donation_ID}
        renderSectionHeader={({ section }) =>
          section.title ? (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
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
              {item.Donor_Display_Name && (
                <View style={styles.donorRow}>
                  <Photo uri={item.Donor_Display_Logo} placeholderIcon="👤" style={styles.donorLogo} />
                  <Text style={styles.donorName}>{item.Donor_Display_Name}</Text>
                </View>
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
  card: {
    padding: 0,
    overflow: 'hidden',
    gap: 0,
    marginBottom: spacing[3],
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
    paddingTop: spacing[2],
    paddingBottom: spacing[1],
  },
  sectionHeaderText: {
    fontFamily: 'WorkSans-600',
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
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
    fontFamily: 'WorkSans-700',
    fontSize: 16.5,
    color: colors.text,
  },
  meta: {
    fontFamily: 'WorkSans-400',
    fontSize: 13.5,
    color: colors.textMuted,
  },
  storyPublished: {
    fontFamily: 'WorkSans-600',
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
    fontFamily: 'WorkSans-600',
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
    fontFamily: 'WorkSans-600',
    fontSize: 14,
    color: colors.text,
  },
  dateLabel: {
    fontFamily: 'WorkSans-400',
    fontSize: 12,
    color: colors.textFaint,
  },
});
