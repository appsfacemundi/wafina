import { Alert, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useAuth } from '@/context/AuthContext';
import { useOwnInstitution } from '@/hooks/useOwnInstitution';
import { colors, fonts, spacing } from '@/theme/tokens';

export function VerificationStatusScreen() {
  const { t } = useTranslation();
  const { signOutUser } = useAuth();
  const { institution, loading } = useOwnInstitution();

  if (loading) return null;

  function onPressSignOut() {
    Alert.alert(t('settings.signOutConfirmTitle'), t('settings.signOutConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.signOut'), style: 'destructive', onPress: () => signOutUser() },
    ]);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.center}>
        <Card style={{ gap: spacing[4] }}>
          <Text style={styles.title}>{t('verification.title')}</Text>
          {institution?.Verified ? (
            <>
              <Badge tone="success">{t('settings.verified')}</Badge>
              <Text style={styles.hint}>{t('verification.verifiedHint')}</Text>
            </>
          ) : institution?.Rejection_Reason ? (
            <>
              <Badge tone="danger">{t('verification.rejectedBadge')}</Badge>
              <Text style={styles.hint}>{institution.Rejection_Reason}</Text>
              <Text style={styles.hint}>{t('verification.rejectedContactHint')}</Text>
            </>
          ) : (
            <>
              <Badge tone="warning">{t('verification.pendingBadge')}</Badge>
              <Text style={styles.hint}>{t('verification.pendingHint')}</Text>
            </>
          )}
          <Button variant="secondary" onPress={onPressSignOut}>
            {t('common.signOut')}
          </Button>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing[6],
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.text,
  },
  hint: {
    fontFamily: 'Manrope-400',
    fontSize: 13.5,
    color: colors.textMuted,
  },
});
