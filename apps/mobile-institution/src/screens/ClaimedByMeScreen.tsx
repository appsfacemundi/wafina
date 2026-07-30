import {
  DONATION_STATUS_LABEL,
  DONATION_STATUS_TONE,
  daysAgoLabel,
  type InstitutionDonationView,
  type SuccessStory,
} from '@wafina/shared';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { FlatList, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';
import type { ClaimedByMeStackParamList } from '@/navigation/RootNavigator';
import { colors, fonts, spacing } from '@/theme/tokens';

type Props = NativeStackScreenProps<ClaimedByMeStackParamList, 'ClaimedByMeList'>;

export function ClaimedByMeScreen({ navigation }: Props) {
  const { firebaseUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [donations, setDonations] = useState<InstitutionDonationView[] | null>(null);
  const [storiesByDonation, setStoriesByDonation] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [deliveringId, setDeliveringId] = useState<string | null>(null);

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

  useEffect(() => {
    load();
  }, [firebaseUser]);

  async function onDeliver(donationId: string) {
    setDeliveringId(donationId);
    setError('');
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/donations/${donationId}/deliver`, { method: 'POST', idToken });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível confirmar a entrega.');
    } finally {
      setDeliveringId(null);
    }
  }

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Doações Aceites</Text>
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {!error && donations === null && <Text style={styles.loading}>A carregar…</Text>}
            {donations?.length === 0 && (
              <EmptyState
                title="Ainda sem doações aceites"
                description="As doações que aceitar aparecem aqui."
              />
            )}
          </>
        }
        data={donations ?? []}
        keyExtractor={(item) => item.Donation_ID}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Image source={{ uri: item.Photo }} style={styles.photo} />
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
                  {item.Donor_Display_Logo ? (
                    <Image source={{ uri: item.Donor_Display_Logo }} style={styles.donorLogo} />
                  ) : (
                    <Text>👤</Text>
                  )}
                  <Text style={styles.meta}>{item.Donor_Display_Name}</Text>
                </View>
              )}
              <Text style={styles.dateLabel}>📅 {daysAgoLabel(item.Date_Submitted)}</Text>
              <View style={styles.actions}>
                {item.Status === 'Claimed' && (
                  <Button
                    variant="secondary"
                    onPress={() => onDeliver(item.Donation_ID)}
                    disabled={deliveringId === item.Donation_ID}
                  >
                    {deliveringId === item.Donation_ID ? 'A confirmar…' : 'Confirmar entrega'}
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
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  dateLabel: {
    fontFamily: 'WorkSans-400',
    fontSize: 12,
    color: colors.textFaint,
  },
});
