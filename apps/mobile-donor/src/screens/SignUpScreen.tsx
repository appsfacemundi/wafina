import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import appIcon from '../../assets/icon.png';
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
      <View style={styles.center}>
        <Card style={styles.card}>
          <View style={styles.brand}>
            <Image source={appIcon} style={styles.logo} />
            <View>
              <Text style={styles.appName}>Wafina Doador</Text>
              <Text style={styles.title}>Criar conta</Text>
            </View>
          </View>
          <Input label="E-mail" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <Input
            label="Palavra-passe"
            secureTextEntry
            hint="Mínimo de 6 caracteres."
            value={password}
            onChangeText={setPassword}
          />
          {error ? <ErrorBanner message={error} /> : null}
          <Button onPress={onSubmit} loading={submitting} fullWidth>
            Criar conta
          </Button>
          <Button variant="ghost" onPress={() => navigation.navigate('SignIn')} fullWidth>
            Já tem conta? Entrar
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
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  appName: {
    fontFamily: 'WorkSans-700',
    fontSize: 13,
    color: colors.textMuted,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
  },
});
