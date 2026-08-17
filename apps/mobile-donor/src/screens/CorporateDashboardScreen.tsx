import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { CorporateAccountWithStats } from '@wafina/shared';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Card';
import { Photo } from '@/components/Photo';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'CorporateDashboard'>;

/**
 * Corporate dashboard (V2, 2026-08-17) — aggregate-only counts for the
 * donor's linked company. Deliberately no per-employee breakdown: there's no
 * company-admin role and no per-employee consent to expose individual
 * activity to coworkers (see the privacy note rendered below).
 */
export function CorporateDashboardScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { firebaseUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [account, setAccount] = useState<CorporateAccountWithStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      const data = await apiFetch<CorporateAccountWithStats | null>('/donor/corporate-account', { idToken });
      setAccount(data);
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const tiles = account
    ? [
        { key: 'employees', icon: 'people' as const, color: colors.accent, soft: colors.accentSoft, value: account.stats.employeeCount, label: t('corporateDashboard.employees') },
        { key: 'donations', icon: 'heart' as const, color: colors.cta, soft: colors.ctaSoft, value: account.stats.donationCount, label: t('corporateDashboard.donations') },
        { key: 'delivered', icon: 'checkmark-circle' as const, color: colors.success, soft: colors.successSoft, value: account.stats.deliveredCount, label: t('corporateDashboard.delivered') },
        { key: 'items', icon: 'cube' as const, color: colors.warning, soft: colors.warningSoft, value: account.stats.itemsDonated, label: t('corporateDashboard.items') },
      ]
    : [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('corporateDashboard.back')}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('corporateDashboard.title')}</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing[6] }]}>
        {loading && <Text style={styles.hint}>{t('common.loading')}</Text>}
        {!loading && !account && <Text style={styles.hint}>{t('corporateDashboard.notLinked')}</Text>}
        {account && (
          <>
            <Card style={styles.companyCard}>
              <Photo uri={account.Logo} placeholderIcon="🏢" style={styles.logo} />
              <Text style={styles.companyName}>{account.Company_Name}</Text>
            </Card>

            <View style={styles.grid}>
              {tiles.map((tile) => (
                <View key={tile.key} style={styles.tile}>
                  <View style={[styles.tileIconWrap, { backgroundColor: tile.soft }]}>
                    <Ionicons name={tile.icon} size={20} color={tile.color} />
                  </View>
                  <Text style={styles.tileValue}>{tile.value}</Text>
                  <Text style={styles.tileLabel}>{tile.label}</Text>
                </View>
              ))}
            </View>

            <Card style={styles.privacyCard}>
              <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
              <Text style={styles.privacyText}>{t('corporateDashboard.privacyNote')}</Text>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  headerTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.text },
  content: { padding: spacing[4], gap: spacing[4] },
  hint: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: spacing[8] },
  companyCard: { alignItems: 'center', gap: spacing[2], paddingVertical: spacing[5] },
  logo: { width: 64, height: 64, borderRadius: radius.md },
  companyName: { fontFamily: fonts.display, fontSize: 18, color: colors.text, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  tile: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    gap: 2,
  },
  tileIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tileValue: { fontFamily: fonts.display, fontSize: 24, color: colors.text },
  tileLabel: { fontFamily: 'Manrope-400', fontSize: 12.5, color: colors.textMuted },
  privacyCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  privacyText: { flex: 1, fontFamily: 'Manrope-400', fontSize: 12.5, color: colors.textMuted, lineHeight: 17 },
});
