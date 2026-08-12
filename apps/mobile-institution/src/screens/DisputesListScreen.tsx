import { formatDateTimeLabel, type Dispute, type InstitutionDonationView } from '@wafina/shared';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';
import { colors, fonts, spacing } from '@/theme/tokens';

export function DisputesListScreen() {
  const { t } = useTranslation();
  const { firebaseUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [disputes, setDisputes] = useState<Dispute[] | null>(null);
  const [codeByDonationId, setCodeByDonationId] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState('');

  // Real-device finding, 2026-08-04: only fetched once on mount — an Admin
  // resolution never showed up here without a full app restart.
  useFocusEffect(
    useCallback(() => {
      if (!firebaseUser) return;
      (async () => {
        let idToken: string;
        try {
          idToken = await firebaseUser.getIdToken();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : t('disputes.loadError'));
          return;
        }
        // The disputes list is this screen's primary content; the claimed-donations
        // lookup only enriches each row with a public code, so it degrades silently
        // instead of blocking the list (e.g. not applicable to this account's role).
        const [disputesResult, donationsResult] = await Promise.allSettled([
          apiFetch<Dispute[]>('/disputes/mine', { idToken }),
          apiFetch<InstitutionDonationView[]>('/donations/claimed-by-me', { idToken }),
        ]);
        if (disputesResult.status === 'fulfilled') {
          setDisputes(disputesResult.value);
          setError('');
        } else {
          setError(disputesResult.reason instanceof ApiError ? disputesResult.reason.message : t('disputes.loadError'));
        }
        if (donationsResult.status === 'fulfilled') {
          setCodeByDonationId(new Map(donationsResult.value.map((d) => [d.Donation_ID, d.Public_Donation_Code])));
        }
      })();
    }, [firebaseUser]),
  );

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>{t('disputes.listTitle')}</Text>
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {!error && disputes === null && <Text style={styles.loading}>{t('common.loading')}</Text>}
            {disputes?.length === 0 && (
              <EmptyState
                title={t('disputes.emptyTitle')}
                description={t('disputes.emptyDescription')}
                icon="alert-circle-outline"
              />
            )}
          </>
        }
        data={disputes ?? []}
        keyExtractor={(item) => item.Dispute_ID}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: spacing[3], gap: spacing[2] }}>
            <View style={styles.row}>
              <Text style={[styles.mono, styles.monoId]}>
                {t('disputes.donationLabel', { code: codeByDonationId.get(item.Donation_ID) ?? '' })}
              </Text>
              <Badge tone={item.Status === 'Open' ? 'warning' : 'success'}>
                {item.Status === 'Open' ? t('disputes.statusOpen') : t('disputes.statusResolved')}
              </Badge>
            </View>
            <Text style={styles.body}>{item.Issue_Description}</Text>
            {item.Resolution_Notes && (
              <Text style={styles.hint}>{t('disputes.responseLabel', { notes: item.Resolution_Notes })}</Text>
            )}
            <Text style={styles.time}>{formatDateTimeLabel(item.Date_Raised)}</Text>
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textFaint,
  },
  monoId: {
    flex: 1,
    flexWrap: 'wrap',
  },
  body: {
    fontFamily: 'Manrope-400',
    fontSize: 14,
    color: colors.text,
  },
  hint: {
    fontFamily: 'Manrope-400',
    fontSize: 13,
    color: colors.textMuted,
  },
  time: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textFaint,
  },
});
