import type { GeoRegion } from '@wafina/shared';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { Photo } from '@/components/Photo';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

/** Matches the public projection GET /institutions returns for donors — not the full Institution shape. */
interface PublicInstitution {
  Institution_ID: string;
  Name: string;
  Logo: string | null;
  Type: string;
  Needs_List: string | null;
  Total_Items_Received: number;
  Country_ID: string;
}

export function InstitutionsScreen() {
  const { t } = useTranslation();
  const { firebaseUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [institutions, setInstitutions] = useState<PublicInstitution[] | null>(null);
  const [countries, setCountries] = useState<GeoRegion[]>([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        const [institutionList, countryList] = await Promise.all([
          apiFetch<PublicInstitution[]>('/institutions', { idToken }),
          apiFetch<GeoRegion[]>('/geo-regions/all-countries', { idToken }),
        ]);
        setInstitutions(institutionList);
        setCountries(countryList);
      } catch {
        setError(t('institutions.loadError'));
      }
    })();
  }, [firebaseUser, t]);

  function countryName(countryId: string): string {
    return countries.find((c) => c.Region_ID === countryId)?.Name ?? '';
  }

  // UX fix, 2026-08-11 — the list previously rendered in raw API order and
  // had no way to find a specific institution by name. Alphabetical order +
  // a name/type search, same pattern as MyDonationsScreen's search.
  const visibleInstitutions = useMemo(() => {
    const sorted = [...(institutions ?? [])].sort((a, b) => a.Name.localeCompare(b.Name, 'pt'));
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (inst) => inst.Name.toLowerCase().includes(q) || inst.Type.toLowerCase().includes(q),
    );
  }, [institutions, search]);

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>{t('institutions.title')}</Text>
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {!error && institutions === null && <Text style={styles.loading}>{t('common.loading')}</Text>}
            {institutions?.length === 0 && (
              <EmptyState
                title={t('institutions.emptyNoneTitle')}
                description={t('institutions.emptyNoneDescription')}
                icon="business-outline"
              />
            )}
            {institutions && institutions.length > 0 && (
              <Input
                label={t('institutions.searchLabel')}
                placeholder={t('institutions.searchPlaceholder')}
                value={search}
                onChangeText={setSearch}
                style={{ marginBottom: spacing[3] }}
              />
            )}
            {institutions && institutions.length > 0 && visibleInstitutions.length === 0 && (
              <EmptyState
                title={t('institutions.emptyNoResultsTitle')}
                description={t('institutions.emptyNoResultsDescription')}
                icon="search-outline"
              />
            )}
          </>
        }
        data={visibleInstitutions}
        keyExtractor={(item) => item.Institution_ID}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.headerRow}>
              <Photo uri={item.Logo} placeholderIcon="🏢" style={styles.logo} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.Name}</Text>
                <Text style={styles.meta}>
                  {item.Type.trim()}
                  {countryName(item.Country_ID) ? ` · ${countryName(item.Country_ID)}` : ''}
                </Text>
              </View>
            </View>
            {item.Needs_List && (
              <Text style={styles.meta}>{t('institutions.needsLabel', { needs: item.Needs_List })}</Text>
            )}
            <Text style={styles.mono}>{t('institutions.itemsReceived', { count: item.Total_Items_Received })}</Text>
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
  card: {
    marginBottom: spacing[3],
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
  },
  logoPlaceholder: {
    backgroundColor: colors.surface2,
  },
  name: {
    fontFamily: 'Manrope-600',
    fontSize: 16,
    color: colors.text,
  },
  meta: {
    fontFamily: 'Manrope-400',
    fontSize: 13,
    color: colors.textMuted,
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    color: colors.textFaint,
  },
});
