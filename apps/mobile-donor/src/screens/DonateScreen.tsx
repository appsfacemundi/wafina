import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import {
  CONDITIONS,
  DELIVERY_METHOD_LABEL,
  DELIVERY_METHODS,
  ITEM_TYPES,
  RECIPIENT_CATEGORIES,
  RECIPIENT_CATEGORY_LABEL,
  type CorporateAccount,
  type DeliveryMethod,
  type RecipientCategory,
} from '@wafina/shared';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorBanner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { ApiError, apiFetch, uploadFile } from '@/lib/api';
import type { AppTabParamList } from '@/navigation/RootNavigator';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

type LocationStatus = 'capturing' | 'captured' | 'failed' | 'geocoding' | 'geocoded';
type Props = BottomTabScreenProps<AppTabParamList, 'Donate'>;

export function DonateScreen({ navigation }: Props) {
  const { firebaseUser, session } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const [itemType, setItemType] = useState<string>(ITEM_TYPES[0]);
  const [quantity, setQuantity] = useState('');
  const [condition, setCondition] = useState<string>(CONDITIONS[0]);
  const [recipientCategory, setRecipientCategory] = useState<RecipientCategory>(RECIPIENT_CATEGORIES[0]);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(DELIVERY_METHODS[0]);
  const [city, setCity] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const [corporateAccount, setCorporateAccount] = useState<CorporateAccount | null>(null);
  const [isCorporateDonation, setIsCorporateDonation] = useState(false);

  const [locationStatus, setLocationStatus] = useState<LocationStatus>('capturing');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [address, setAddress] = useState('');
  const [locationError, setLocationError] = useState('');

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!firebaseUser || !session?.corporateAccountId) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        setCorporateAccount(await apiFetch<CorporateAccount | null>('/donor/corporate-account', { idToken }));
      } catch {
        // Non-critical — the form just falls back to personal-only if this fails.
      }
    })();
  }, [firebaseUser, session?.corporateAccountId]);

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

  // Pilot feedback, 2026-08-05: only the gallery was ever offered here —
  // Institution's success-story photo already got a camera option
  // (2026-08-04); this was the last of the three upload points to catch up.
  async function onPickFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setError('É necessário acesso à câmara para tirar uma fotografia.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0]);
  }

  async function onPickFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('É necessário acesso às fotografias para anexar uma imagem.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0]);
  }

  function onPickPhoto() {
    Alert.alert('Adicionar fotografia', undefined, [
      { text: 'Tirar fotografia', onPress: onPickFromCamera },
      { text: 'Escolher da galeria', onPress: onPickFromLibrary },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

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

    if (!photo) {
      setError('Adicione uma fotografia da doação.');
      return;
    }
    if (!quantity || Number(quantity) < 1) {
      setError('Indique uma quantidade válida.');
      return;
    }
    if (!hasValidLocation) {
      setError('É necessária uma localização válida. Ative o GPS ou confirme a sua morada.');
      return;
    }

    setSubmitting(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await uploadFile('/donations', 'photo', photo.uri, {
        idToken,
        mimeType: photo.mimeType ?? 'image/jpeg',
        parameters: {
          Item_Type: itemType,
          Quantity: quantity,
          Condition: condition,
          Recipient_Category: recipientCategory,
          Delivery_Method: deliveryMethod,
          City: city,
          Location_lat: lat,
          Location_lng: lng,
          ...(corporateAccount ? { isCorporateDonation: String(isCorporateDonation) } : {}),
        },
      });
      setQuantity('');
      setPhoto(null);
      showToast('Doação submetida com sucesso!');
      // Real-device finding, 2026-08-04: staying on the form after a
      // successful submit read as "did this actually work?" — the toast
      // above is easy to miss, and nothing on this screen changes to confirm
      // it. Navigating to the list where the new donation now appears is the
      // clearest possible confirmation.
      navigation.navigate('MyDonations');
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
          <Select
            label="Categoria do destinatário"
            value={recipientCategory}
            onValueChange={(v) => setRecipientCategory(v as RecipientCategory)}
            options={RECIPIENT_CATEGORIES.map((c) => ({ label: RECIPIENT_CATEGORY_LABEL[c], value: c }))}
          />
          <Select
            label="Método de entrega"
            value={deliveryMethod}
            onValueChange={(v) => setDeliveryMethod(v as DeliveryMethod)}
            options={DELIVERY_METHODS.map((m) => ({ label: DELIVERY_METHOD_LABEL[m], value: m }))}
          />
          {corporateAccount && (
            <Select
              label="Doar como"
              value={isCorporateDonation ? 'corporate' : 'personal'}
              onValueChange={(v) => setIsCorporateDonation(v === 'corporate')}
              options={[
                { label: 'Doação Pessoal', value: 'personal' },
                { label: `Doação da Empresa (${corporateAccount.Company_Name})`, value: 'corporate' },
              ]}
            />
          )}
          <Input label="Cidade (opcional)" placeholder="Ex: Luanda" value={city} onChangeText={setCity} />

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
});
