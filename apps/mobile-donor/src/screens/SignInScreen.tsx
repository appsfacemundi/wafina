import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import logoMark from '../../assets/icon-mark.png';
import { ErrorBanner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useAuth } from '@/context/AuthContext';
import { friendlyAuthError } from '@/lib/auth-errors';
import { ApiError } from '@/lib/api';
import type { AuthStackParamList } from '@/navigation/RootNavigator';
import { colors, fonts, spacing } from '@/theme/tokens';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export function SignInScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { signIn, sessionError, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetting, setResetting] = useState(false);
  const displayedError = error || sessionError;

  async function onSubmit() {
    setError('');
    setSubmitting(true);
    try {
      await signIn(email, password);
      // RootNavigator swaps stacks on its own once `session` resolves.
    } catch (err) {
      // ApiError means Firebase login succeeded but the backend rejected the
      // session (e.g. suspended account) — its message is already the right
      // one to show. Anything else is a Firebase auth error (wrong password,
      // unknown email, etc.), which needs the code-to-message mapping.
      setError(err instanceof ApiError ? err.message : friendlyAuthError((err as { code?: string }).code ?? ''));
    } finally {
      setSubmitting(false);
    }
  }

  // Real-device finding, 2026-08-04: only Admin could reset a user's password
  // before this — a Donor who forgot theirs had no self-service path at all.
  async function onForgotPassword() {
    setError('');
    setResetMessage('');
    if (!email.trim()) {
      setError(t('auth.enterEmailForReset'));
      return;
    }
    setResetting(true);
    try {
      await resetPassword(email.trim());
      setResetMessage(t('auth.resetSent'));
    } catch {
      setResetMessage(t('auth.resetSentGeneric'));
    } finally {
      setResetting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.langWrap, { top: insets.top + spacing[3] }]}>
        <LanguageSwitcher />
      </View>
      {/* RC1 audit fix, 2026-08-10 — the previous fixed, non-scrolling
          center View had no way to reveal content the keyboard pushed below
          the fold (Forgot Password / Register were unreachable on smaller
          screens). ScrollView + keyboardShouldPersistTaps="handled" is the
          same pattern already proven on DonateScreen's much longer form;
          flexGrow (not flex) on the content container keeps the same
          vertically-centered look when everything already fits. */}
      <ScrollView
        contentContainerStyle={styles.center}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}>
          <Image source={logoMark} style={styles.logo} resizeMode="contain" />
          <View style={styles.appBadge}>
            <Text style={styles.appBadgeText}>{t('auth.badge')}</Text>
          </View>
          <Text style={styles.welcome}>{t('auth.welcome')}</Text>
          <Text style={styles.tagline}>{t('auth.tagline')}</Text>
        </View>
        <Card style={styles.card}>
          <Input
            label={t('auth.email')}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            label={t('auth.password')}
            secureTextEntry
            textContentType="password"
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
          />
          {displayedError ? <ErrorBanner message={displayedError} /> : null}
          {resetMessage ? <Text style={styles.resetMessage}>{resetMessage}</Text> : null}
          <Button onPress={onSubmit} loading={submitting} fullWidth>
            {t('auth.signIn')}
          </Button>
          <Button variant="ghost" onPress={onForgotPassword} loading={resetting} fullWidth>
            {t('auth.forgotPassword')}
          </Button>
          <Button variant="ghostReceive" onPress={() => navigation.navigate('SignUp')} fullWidth>
            {t('auth.noAccount')}
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
  langWrap: {
    position: 'absolute',
    right: spacing[5],
    zIndex: 1,
  },
  center: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing[6],
    gap: spacing[8],
  },
  brand: {
    alignItems: 'center',
    gap: spacing[1],
  },
  logo: {
    width: 108,
    height: 108,
    marginBottom: spacing[3],
  },
  // Real-device finding, 2026-08-07 — Donor and Institution login screens
  // used identical copy/mark, with nothing to tell them apart if both apps
  // were installed side by side. This pill is the one thing that differs.
  appBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 14,
    marginBottom: spacing[2],
  },
  appBadgeText: {
    fontFamily: 'Manrope-700',
    fontSize: 11.5,
    letterSpacing: 0.6,
    color: colors.accent,
  },
  welcome: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.text,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: fonts.tagline,
    fontSize: 12.5,
    letterSpacing: 0.4,
    // Logo pink, per brand identity (2026-08-11).
    color: colors.receive,
    textAlign: 'center',
  },
  card: {
    width: '100%',
  },
  resetMessage: {
    fontFamily: 'Manrope-400',
    fontSize: 13,
    color: colors.textMuted,
  },
});
