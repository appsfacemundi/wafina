import { detectSupportedCountryFromCoords, type GeoRegion } from '@wafina/shared';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorBanner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { useAuth } from '@/context/AuthContext';
import { ApiError, apiFetch } from '@/lib/api';
import { colors, fonts, spacing } from '@/theme/tokens';

type LocationStatus = 'capturing' | 'captured' | 'failed' | 'geocoding' | 'geocoded';

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
  const [address, setAddress] = useState('');
  const [locationError, setLocationError] = useState('');

  const [countries, setCountries] = useState<GeoRegion[] | null>(null);
  const [countryId, setCountryId] = useState('');
  const [serviceRadiusKm, setServiceRadiusKm] = useState('');
  const [coverageArea, setCoverageArea] = useState('');

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

  useEffect(() => {
    (async () => {
      try {
        const idToken = await firebaseUser?.getIdToken();
        const list = await apiFetch<GeoRegion[]>('/geo-regions/countries', { idToken });
        setCountries(list);
        if (list[0]) setCountryId(list[0].Region_ID);
      } catch {
        setError('Não foi possível carregar a lista de países.');
      }
    })();
  }, []);

  // Once GPS resolves, use it as a smart default for the country picker —
  // reusing the coordinates already captured for Location, no extra permission ask.
  useEffect(() => {
    if ((locationStatus !== 'captured' && locationStatus !== 'geocoded') || !countries) return;
    const isoCode = detectSupportedCountryFromCoords(Number(lat), Number(lng));
    const match = countries.find((c) => c.ISO_Code === isoCode);
    if (match) setCountryId(match.Region_ID);
  }, [locationStatus, lat, lng, countries]);

  const hasValidLocation =
    lat !== '' && lng !== '' && !(Number(lat) === 0 && Number(lng) === 0) && !Number.isNaN(Number(lat));

  async function onFindAddress() {
    setLocationError('');
    if (!address.trim()) {
      setLocationError('Introduza uma morada.');
      return;
    }
    setLocationStatus('geocoding');
    try {
      const idToken = await firebaseUser?.getIdToken();
      const result = await apiFetch<{ lat: number; lng: number }>(
        `/geo-regions/geocode?address=${encodeURIComponent(address)}`,
        { idToken },
      );
      setLat(String(result.lat));
      setLng(String(result.lng));
      setLocationStatus('geocoded');
    } catch (err) {
      setLocationError(err instanceof ApiError ? err.message : 'Não foi possível localizar essa morada.');
      setLocationStatus('failed');
    }
  }

  async function onSubmit() {
    setError('');
    if (!name || !type) {
      setError('Preencha o nome e o tipo da instituição.');
      return;
    }
    if (!hasValidLocation) {
      setError('É necessária uma localização válida. Ative o GPS ou confirme a sua morada.');
      return;
    }
    if (!countryId) {
      setError('Selecione o país onde a instituição opera.');
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
          Country_ID: countryId,
          Service_Radius_Km: serviceRadiusKm ? Number(serviceRadiusKm) : undefined,
          Coverage_Area: coverageArea || undefined,
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
          {countries ? (
            <Select
              label="País"
              value={countryId}
              onValueChange={setCountryId}
              options={countries.map((c) => ({ label: c.Name, value: c.Region_ID }))}
            />
          ) : (
            <Text style={styles.hint}>A carregar países…</Text>
          )}
          <Input
            label="Necessidades (opcional)"
            hint="Ex: Roupas, Alimentos"
            value={needsList}
            onChangeText={setNeedsList}
          />
          <Input
            label="Raio de cobertura em km (opcional)"
            hint="Ajuda a associar doadores próximos no futuro"
            keyboardType="number-pad"
            value={serviceRadiusKm}
            onChangeText={setServiceRadiusKm}
          />
          <Input
            label="Área de cobertura (opcional)"
            hint="Ex: toda a província de Luanda"
            value={coverageArea}
            onChangeText={setCoverageArea}
          />

          <View style={{ gap: spacing[1] }}>
            <Text style={styles.label}>Localização</Text>
            {locationStatus === 'capturing' && <Text style={styles.hint}>A obter a sua localização…</Text>}
            {(locationStatus === 'captured' || locationStatus === 'geocoded') && (
              <Text style={styles.hint}>📍 Localização confirmada</Text>
            )}
            {(locationStatus === 'failed' || locationStatus === 'geocoding') && (
              <View style={{ gap: spacing[2] }}>
                <Text style={styles.hint}>
                  Não foi possível obter a sua localização automaticamente. Introduza a sua morada.
                </Text>
                <Input label="Morada" placeholder="Ex: Rua Amílcar Cabral, Luanda" value={address} onChangeText={setAddress} />
                <Button variant="secondary" onPress={onFindAddress} loading={locationStatus === 'geocoding'}>
                  Confirmar morada
                </Button>
                {locationError ? <ErrorBanner message={locationError} /> : null}
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
