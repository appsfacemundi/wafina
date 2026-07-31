import { daysAgoLabel, type GeoRegion, type InstitutionDonationView } from '@wafina/shared';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { Photo } from '@/components/Photo';
import { useAuth } from '@/context/AuthContext';
import { useOwnInstitution } from '@/hooks/useOwnInstitution';
import { apiFetch, ApiError } from '@/lib/api';
import { colors, fonts, spacing } from '@/theme/tokens';

export function AvailableDonationsScreen() {
  const { firebaseUser } = useAuth();
  const { institution } = useOwnInstitution();
  const insets = useSafeAreaInsets();
  const [donations, setDonations] = useState<InstitutionDonationView[] | null>(null);
  const [countryName, setCountryName] = useState('');
  const [error, setError] = useState('');
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  async function load() {
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      setDonations(await apiFetch<InstitutionDonationView[]>('/donations/available', { idToken }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as doações.');
    }
  }

  useEffect(() => {
    load();
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser || !institution?.Country_ID) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        const countries = await apiFetch<GeoRegion[]>('/geo-regions/all-countries', { idToken });
        setCountryName(countries.find((c) => c.Region_ID === institution.Country_ID)?.Name ?? '');
      } catch {
        // Non-critical — the card just omits the country name if this fails.
      }
    })();
  }, [firebaseUser, institution?.Country_ID]);

  const filtered = useMemo(() => {
    if (!donations) return donations;
    const q = query.trim().toLowerCase();
    if (!q) return donations;
    return donations.filter(
      (d) => d.Item_Type.toLowerCase().includes(q) || d.Condition.toLowerCase().includes(q),
    );
  }, [donations, query]);

  async function onClaim(donationId: string) {
    setClaimingId(donationId);
    setError('');
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch(`/donations/${donationId}/claim`, { method: 'POST', idToken });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível aceitar a doação.');
    } finally {
      setClaimingId(null);
    }
  }

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Doações Disponíveis</Text>
            {donations && donations.length > 0 && (
              <Input label="Filtrar" placeholder="Tipo ou estado…" value={query} onChangeText={setQuery} />
            )}
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {!error && donations === null && <Text style={styles.loading}>A carregar…</Text>}
            {donations?.length === 0 && (
              <EmptyState
                title="Sem doações disponíveis"
                description="Quando houver doações pendentes, aparecem aqui."
              />
            )}
            {donations && donations.length > 0 && filtered?.length === 0 && (
              <EmptyState title="Sem resultados" description="Nenhuma doação corresponde ao filtro." />
            )}
          </>
        }
        data={filtered ?? []}
        keyExtractor={(item) => item.Donation_ID}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Photo uri={item.Photo} style={styles.photo} />
            <View style={styles.cardBody}>
              <View style={styles.rowBetween}>
                <Text style={styles.itemType}>{item.Item_Type}</Text>
                <Text style={styles.mono}>{item.Public_Donation_Code}</Text>
              </View>
              <Text style={styles.meta}>
                Qtd: {item.Quantity} · Estado: {item.Condition}
              </Text>
              {(item.City || countryName) && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.meta}>📍 {[item.City, countryName].filter(Boolean).join(', ')}</Text>
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
                  <Text style={styles.meta}>{item.Donor_Display_Name}</Text>
                </View>
              )}
              <Text style={styles.dateLabel}>📅 {daysAgoLabel(item.Date_Submitted)}</Text>
              <Button onPress={() => onClaim(item.Donation_ID)} disabled={claimingId === item.Donation_ID} fullWidth>
                {claimingId === item.Donation_ID ? 'A aceitar…' : 'Aceitar Doação'}
              </Button>
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
    gap: spacing[4],
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
    marginBottom: spacing[4],
  },
  photo: {
    width: '100%',
    height: 180,
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
    fontFamily: 'WorkSans-700',
    fontSize: 16.5,
    color: colors.text,
  },
  meta: {
    fontFamily: 'WorkSans-400',
    fontSize: 13.5,
    color: colors.textMuted,
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
    marginBottom: 4,
  },
});
