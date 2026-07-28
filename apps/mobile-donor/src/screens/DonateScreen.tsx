import { CONDITIONS, ITEM_TYPES } from '@wafina/shared';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorBanner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { useAuth } from '@/context/AuthContext';
import { ApiError, apiFetch } from '@/lib/api';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

type LocationStatus = 'capturing' | 'captured' | 'failed';

export function DonateScreen() {
  const { firebaseUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [itemType, setItemType] = useState<string>(ITEM_TYPES[0]);
  const [quantity, setQuantity] = useState('');
  const [condition, setCondition] = useState<string>(CONDITIONS[0]);
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const [locationStatus, setLocationStatus] = useState<LocationStatus>('capturing');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
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

  async function onPickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('É necessário acesso às fotografias para anexar uma imagem.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0]);
    }
  }

  const hasValidLocation =
    lat !== '' && lng !== '' && !(Number(lat) === 0 && Number(lng) === 0) && !Number.isNaN(Number(lat));

  async function onSubmit() {
    setError('');
    setSuccess(false);

    if (!photo) {
      setError('Adicione uma fotografia da doação.');
      return;
    }
    if (!quantity || Number(quantity) < 1) {
      setError('Indique uma quantidade válida.');
      return;
    }
    if (!hasValidLocation) {
      setError('É necessária uma localização válida. Ative o GPS ou introduza as coordenadas.');
      return;
    }

    setSubmitting(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      const form = new FormData();
      form.append('Item_Type', itemType);
      form.append('Quantity', quantity);
      form.append('Condition', condition);
      form.append('Location_lat', lat);
      form.append('Location_lng', lng);
      form.append('photo', {
        uri: photo.uri,
        name: photo.fileName ?? 'donation.jpg',
        type: photo.mimeType ?? 'image/jpeg',
      } as unknown as Blob);

      await apiFetch('/donations', { method: 'POST', idToken, body: form });
      setSuccess(true);
      setQuantity('');
      setPhoto(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível submeter a doação.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}>
        <Text style={styles.title}>Doar</Text>
        <Card style={{ gap: spacing[4] }}>
          <Select label="Tipo de item" value={itemType} onValueChange={setItemType} options={ITEM_TYPES} />
          <Input
            label="Quantidade"
            keyboardType="number-pad"
            value={quantity}
            onChangeText={setQuantity}
          />
          <Select label="Estado" value={condition} onValueChange={setCondition} options={CONDITIONS} />

          <View style={{ gap: spacing[1] }}>
            <Text style={styles.label}>Fotografia da doação</Text>
            {photo ? (
              <Image source={{ uri: photo.uri }} style={styles.preview} />
            ) : (
              <Pressable style={styles.uploadWell} onPress={onPickPhoto}>
                <Text style={styles.uploadText}>Escolha uma fotografia</Text>
              </Pressable>
            )}
            {photo && (
              <Button variant="secondary" onPress={onPickPhoto}>
                Escolher outra fotografia
              </Button>
            )}
          </View>

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
          {success && (
            <View style={styles.successBanner}>
              <Text style={styles.successText}>Doação submetida com sucesso.</Text>
            </View>
          )}

          <Button onPress={onSubmit} loading={submitting} fullWidth>
            Confirmar doação
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
    paddingBottom: spacing[12],
    gap: spacing[4],
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
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
  uploadWell: {
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: spacing[6],
    alignItems: 'center',
  },
  uploadText: {
    fontFamily: 'WorkSans-400',
    fontSize: 13,
    color: colors.textMuted,
  },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
  },
  successBanner: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.sm,
    padding: spacing[3],
  },
  successText: {
    fontFamily: 'WorkSans-400',
    fontSize: 13,
    color: colors.success,
  },
});
