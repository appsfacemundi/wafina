import type { GeoRegion } from '@wafina/shared';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { ErrorBanner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { useAuth } from '@/context/AuthContext';
import { ApiError, apiFetch } from '@/lib/api';
import { colors, fonts, spacing } from '@/theme/tokens';

export function OnboardingProfileScreen() {
  const { firebaseUser, refreshSession, signOutUser } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [countries, setCountries] = useState<GeoRegion[] | null>(null);
  const [homeCountryId, setHomeCountryId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const idToken = await firebaseUser?.getIdToken();
        const list = await apiFetch<GeoRegion[]>('/geo-regions/countries', { idToken });
        setCountries(list);
        if (list[0]) setHomeCountryId(list[0].Region_ID);
      } catch {
        setError('Não foi possível carregar a lista de países.');
      }
    })();
  }, []);

  async function onSubmit() {
    setError('');
    setSubmitting(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/donor/profile', {
        method: 'PATCH',
        idToken,
        body: { Name: name, Phone: phone, Home_Country_ID: homeCountryId },
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
          <Input label="Nome" autoCapitalize="words" value={name} onChangeText={setName} />
          <Input label="Telefone" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          {countries ? (
            <Select
              label="País"
              value={homeCountryId}
              onValueChange={setHomeCountryId}
              options={countries.map((c) => ({ label: c.Name, value: c.Region_ID }))}
            />
          ) : (
            <Text style={styles.hint}>A carregar países…</Text>
          )}
          {error ? <ErrorBanner message={error} /> : null}
          <Button onPress={onSubmit} loading={submitting} disabled={!homeCountryId} fullWidth>
            Continuar
          </Button>
          <Button variant="ghost" onPress={() => signOutUser()} fullWidth>
            Não é a sua conta? Sair
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
    fontFamily: 'Manrope-400',
    fontSize: 13.5,
    color: colors.textMuted,
  },
  hint: {
    fontFamily: 'Manrope-400',
    fontSize: 13,
    color: colors.textFaint,
  },
});
