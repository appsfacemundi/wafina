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

export function SignUpScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError('');
    setSubmitting(true);
    try {
      await signUp(email, password);
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
