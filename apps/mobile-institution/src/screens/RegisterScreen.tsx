import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorBanner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { useAuth } from '@/context/AuthContext';
import { ApiError, apiFetch } from '@/lib/api';
import { colors, fonts, spacing } from '@/theme/tokens';

type LocationStatus = 'capturing' | 'captured' | 'failed';

interface Props {
  onRegistered: () => void | Promise<void>;
}

export function RegisterScreen({ onRegistered }: Props) {
  const { firebaseUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [needsList, setNeedsList] = useState('');
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('capturing');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus('failed');
        return;
      }
      try {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLat(String(position.coords.latitude));
        setLng(String(position.coords.longitude));
        setLocationStatus('captured');
      } catch {
        setLocationStatus('failed');
      }
    })();
  }, []);

  const hasValidLocation =
    lat !== '' && lng !== '' && !(Number(lat) === 0 && Number(lng) === 0) && !Number.isNaN(Number(lat));

  async function onSubmit() {
    setError('');
    if (!name || !type) {
      setError('Preencha o nome e o tipo da instituição.');
      return;
    }
    if (!hasValidLocation) {
      setError('É necessária uma localização válida. Ative o GPS ou introduza as coordenadas.');
      return;
    }
    setSubmitting(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/institutions', {
        method: 'POST',
        idToken,
        body: {
          Name: name,
          Type: type,
          Location: { lat: Number(lat), lng: Number(lng) },
          Needs_List: needsList || undefined,
        },
      });
      await onRegistered();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível submeter o registo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}>
        <Card style={{ gap: spacing[4] }}>
          <Text style={styles.title}>Registar instituição</Text>
          <Text style={styles.subtitle}>
            Após o envio, a sua instituição fica pendente de verificação pelo Admin.
          </Text>
          <Input label="Nome da instituição" autoCapitalize="words" value={name} onChangeText={setName} />
          <Input
            label="Tipo"
            hint="Ex: ONG, orfanato, igreja, escola, centro comunitário"
            value={type}
            onChangeText={setType}
          />
          <Input
            label="Necessidades (opcional)"
            hint="Ex: Roupas, Alimentos"
            value={needsList}
            onChangeText={setNeedsList}
          />

          <View style={{ gap: spacing[1] }}>
            <Text style={styles.label}>Localização</Text>
            {locationStatus === 'capturing' && <Text style={styles.hint}>A obter a sua localização…</Text>}
            {locationStatus === 'captured' && (
              <Text style={styles.hint}>
                Localização obtida: {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
              </Text>
            )}
            {locationStatus === 'failed' && (
              <View style={{ gap: spacing[2] }}>
                <Text style={styles.hint}>
                  Não foi possível obter a localização automaticamente. Introduza-a manualmente.
                </Text>
                <Input label="Latitude" keyboardType="numbers-and-punctuation" value={lat} onChangeText={setLat} />
                <Input label="Longitude" keyboardType="numbers-and-punctuation" value={lng} onChangeText={setLng} />
              </View>
            )}
          </View>

          {error ? <ErrorBanner message={error} /> : null}
          <Button onPress={onSubmit} loading={submitting} fullWidth>
            Submeter registo
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
  content: {
    padding: spacing[6],
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.text,
  },
  subtitle: {
    fontFamily: 'WorkSans-400',
    fontSize: 13.5,
    color: colors.textMuted,
  },
  label: {
    fontFamily: 'WorkSans-600',
    fontSize: 13,
    color: colors.text,
  },
  hint: {
    fontFamily: 'WorkSans-400',
    fontSize: 12,
    color: colors.textFaint,
  },
});
