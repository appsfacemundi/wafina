import {
  DONATION_STATUS_LABEL,
  DONATION_STATUS_TONE,
  formatDateLabel,
  type Donation,
  type SuccessStory,
} from '@wafina/shared';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { DonationTimeline } from '@/components/DonationTimeline';
import { EmptyState } from '@/components/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

export function MyDonationsScreen() {
  const { firebaseUser, session } = useAuth();
  const insets = useSafeAreaInsets();
  const [donations, setDonations] = useState<Donation[] | null>(null);
  const [storiesByDonation, setStoriesByDonation] = useState<Map<string, SuccessStory>>(new Map());
  const [error, setError] = useState('');

  useEffect(() => {
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
  }, [firebaseUser]);

  const stats = useMemo(() => {
    if (!donations || !session?.corporateAccountId) return null;
    return {
      total: donations.length,
      quantity: donations.reduce((sum, d) => sum + d.Quantity, 0),
      pending: donations.filter((d) => d.Status === 'Pending').length,
      claimed: donations.filter((d) => d.Status === 'Claimed').length,
      delivered: donations.filter((d) => d.Status === 'Delivered').length,
    };
  }, [donations, session]);

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Minhas Doações</Text>
            {stats && (
              <View style={styles.statsGrid}>
                {[
                  ['Doações da empresa', stats.total],
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
            {donations?.length === 0 && (
              <EmptyState
                title="Ainda sem doações"
                description="Quando submeter uma doação, o estado dela aparece aqui."
              />
            )}
          </>
        }
        data={donations ?? []}
        keyExtractor={(item) => item.Donation_ID}
        renderItem={({ item }) => {
          const story = storiesByDonation.get(item.Donation_ID);
          return (
            <Card style={{ marginBottom: spacing[3], gap: spacing[3] }}>
              <View style={styles.donationRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemType}>{item.Item_Type}</Text>
                  <Text style={styles.donationId}>
                    {item.Public_Donation_Code} · Qtd {item.Quantity}
                  </Text>
                </View>
                <Badge tone={DONATION_STATUS_TONE[item.Status]}>{DONATION_STATUS_LABEL[item.Status]}</Badge>
              </View>
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
