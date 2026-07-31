import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { ErrorBanner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { useAuth } from '@/context/AuthContext';
import { friendlyAuthError } from '@/lib/auth-errors';
import { ApiError } from '@/lib/api';
import type { AuthStackParamList } from '@/navigation/RootNavigator';
import { colors, fonts, spacing } from '@/theme/tokens';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export function SignInScreen({ navigation }: Props) {
  const { signIn, sessionError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
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

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.center}>
        <Card style={styles.card}>
          <Text style={styles.title}>Entrar</Text>
          <Input label="E-mail" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <Input label="Palavra-passe" secureTextEntry value={password} onChangeText={setPassword} />
          {displayedError ? <ErrorBanner message={displayedError} /> : null}
          <Button onPress={onSubmit} loading={submitting} fullWidth>
            Entrar
          </Button>
          <Button variant="ghost" onPress={() => navigation.navigate('SignUp')} fullWidth>
            Ainda não tem conta? Criar conta
          </Button>
        </Card>
      </View>
    </KeyboardAvoidingView>
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
  card: {
    width: '100%',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
  },
});
