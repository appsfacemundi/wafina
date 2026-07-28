import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { ErrorBanner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { useAuth } from '@/context/AuthContext';
import { ApiError, apiFetch } from '@/lib/api';
import { colors, fonts, spacing } from '@/theme/tokens';

export function OnboardingProfileScreen() {
  const { firebaseUser, refreshSession } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('Angola');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError('');
    setSubmitting(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/donor/profile', {
        method: 'PATCH',
        idToken,
        body: { Name: name, Phone: phone, Country: country },
      });
      await refreshSession();
      // RootNavigator swaps to Home on its own once session.profileComplete flips.
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível guardar. Tente novamente.');
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
          <Text style={styles.title}>Complete o seu perfil</Text>
          <Text style={styles.subtitle}>Só mais um passo antes de poder doar.</Text>
          <Input label="Nome" value={name} onChangeText={setName} />
          <Input label="Telefone" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          <Input label="País" value={country} onChangeText={setCountry} />
          {error ? <ErrorBanner message={error} /> : null}
          <Button onPress={onSubmit} loading={submitting} fullWidth>
            Continuar
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
  subtitle: {
    fontFamily: 'WorkSans-400',
    fontSize: 13.5,
    color: colors.textMuted,
  },
});
