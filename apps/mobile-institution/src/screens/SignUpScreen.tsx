import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import logoMark from '../../assets/icon-mark.png';
import { ErrorBanner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { useAuth } from '@/context/AuthContext';
import { friendlyAuthError } from '@/lib/auth-errors';
import type { AuthStackParamList } from '@/navigation/RootNavigator';
import { colors, fonts, spacing } from '@/theme/tokens';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

type AccountKind = 'Institution' | 'Animal_Shelter';

export function SignUpScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountKind, setAccountKind] = useState<AccountKind>('Institution');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError('');
    setSubmitting(true);
    try {
      await signUp(email, password, accountKind);
      // RootNavigator swaps stacks on its own once `session` resolves.
    } catch (err) {
      setError(friendlyAuthError((err as { code?: string }).code ?? ''));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* RC1 audit fix, 2026-08-10 — same fix as SignInScreen; this form now
          has the account-kind toggle on top of email/password, making it the
          most likely of the two to overflow on a small screen. */}
      <ScrollView
        contentContainerStyle={styles.center}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}>
          <Image source={logoMark} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>{t('auth.createAccountTitle')}</Text>
        </View>
        <Card style={styles.card}>
          <View style={styles.kindPicker}>
            <Text style={styles.kindLabel}>{t('auth.accountKindLabel')}</Text>
            <View style={styles.kindRow}>
              <View style={styles.kindOption}>
                <Button
                  variant={accountKind === 'Institution' ? 'primary' : 'secondary'}
                  onPress={() => setAccountKind('Institution')}
                  fullWidth
                >
                  {t('auth.accountKindInstitution')}
                </Button>
              </View>
              <View style={styles.kindOption}>
                <Button
                  variant={accountKind === 'Animal_Shelter' ? 'primary' : 'secondary'}
                  onPress={() => setAccountKind('Animal_Shelter')}
                  fullWidth
                >
                  {t('auth.accountKindShelter')}
                </Button>
              </View>
            </View>
          </View>
          <Input label={t('auth.email')} keyboardType="email-address" value={email} onChangeText={setEmail} />
          <Input
            label={t('auth.password')}
            secureTextEntry
            hint={t('auth.passwordHint')}
            value={password}
            onChangeText={setPassword}
          />
          {error ? <ErrorBanner message={error} /> : null}
          <Button onPress={onSubmit} loading={submitting} fullWidth>
            {t('auth.createAccountTitle')}
          </Button>
          <Button variant="ghost" onPress={() => navigation.navigate('SignIn')} fullWidth>
            {t('auth.alreadyHaveAccount')}
          </Button>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing[6],
    gap: spacing[8],
  },
  card: {
    width: '100%',
  },
  kindPicker: {
    gap: spacing[2],
  },
  kindLabel: {
    fontFamily: 'Manrope-600',
    fontSize: 13,
    color: colors.textMuted,
  },
  kindRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  kindOption: {
    flex: 1,
  },
  brand: {
    alignItems: 'center',
    gap: spacing[3],
  },
  logo: {
    width: 96,
    height: 96,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.text,
  },
});
