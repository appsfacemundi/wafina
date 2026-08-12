import { ANIMAL_SHELTER_TYPES, detectSupportedCountryFromCoords, INSTITUTION_TYPES, type GeoRegion } from '@wafina/shared';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ErrorBanner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { useAuth } from '@/context/AuthContext';
import { ApiError, apiFetch, uploadFile } from '@/lib/api';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

type LocationStatus = 'capturing' | 'captured' | 'failed' | 'geocoding' | 'geocoded';

interface Props {
  onRegistered: () => void | Promise<void>;
}

export function RegisterScreen({ onRegistered }: Props) {
  const { t } = useTranslation();
  const { firebaseUser, session, signOutUser } = useAuth();
  const insets = useSafeAreaInsets();
  const isShelter = session?.role === 'Animal_Shelter';
  const typeOptions = isShelter ? ANIMAL_SHELTER_TYPES : INSTITUTION_TYPES;

  const [name, setName] = useState('');
  // Registration UX fix, 2026-08-10 — prefilled dropdown (never blank) instead
  // of free text; 'Outro' reveals customType below for anything not listed.
  const [type, setType] = useState<string>(typeOptions[0]);
  const [customType, setCustomType] = useState('');
  const [logo, setLogo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [needsList, setNeedsList] = useState('');
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('capturing');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [address, setAddress] = useState('');
  const [locationError, setLocationError] = useState('');

  const [countries, setCountries] = useState<GeoRegion[] | null>(null);
  const [countryId, setCountryId] = useState('');
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
        setError(t('register.errors.loadCountries'));
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

  // RC1 design decision, 2026-08-06: logo is required at registration — same
  // camera/gallery Alert-based picker pattern already proven on Donor's
  // DonateScreen and this app's own Settings logo upload.
  async function onPickLogoFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setError(t('register.errors.cameraPermission'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setLogo(result.assets[0]);
  }

  async function onPickLogoFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError(t('register.errors.libraryPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setLogo(result.assets[0]);
  }

  function onPickLogo() {
    Alert.alert(t('register.addLogoTitle'), undefined, [
      { text: t('register.takePhoto'), onPress: onPickLogoFromCamera },
      { text: t('register.chooseFromGallery'), onPress: onPickLogoFromLibrary },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  const hasValidLocation =
    lat !== '' && lng !== '' && !(Number(lat) === 0 && Number(lng) === 0) && !Number.isNaN(Number(lat));

  async function onFindAddress() {
    setLocationError('');
    if (!address.trim()) {
      setLocationError(t('register.errors.enterAddress'));
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
      setLocationError(err instanceof ApiError ? err.message : t('register.errors.geocode'));
      setLocationStatus('failed');
    }
  }

  async function onSubmit() {
    setError('');
    if (!name || !type) {
      setError(
        isShelter ? t('register.errors.missingNameTypeShelter') : t('register.errors.missingNameTypeInstitution'),
      );
      return;
    }
    if (type === 'Outro' && !customType.trim()) {
      setError(t('register.errors.missingCustomType'));
      return;
    }
    if (!logo) {
      setError(isShelter ? t('register.errors.missingLogoShelter') : t('register.errors.missingLogoInstitution'));
      return;
    }
    if (!hasValidLocation) {
      setError(t('register.errors.missingLocation'));
      return;
    }
    if (!countryId) {
      setError(t('register.errors.missingCountry'));
      return;
    }
    setSubmitting(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await uploadFile('/institutions', 'logo', logo.uri, {
        idToken,
        mimeType: logo.mimeType ?? 'image/jpeg',
        parameters: {
          Name: name,
          Type: type === 'Outro' ? customType.trim() : type,
          Location_lat: lat,
          Location_lng: lng,
          Needs_List: needsList,
          Country_ID: countryId,
          Coverage_Area: coverageArea,
          Address: address.trim(),
        },
      });
      await onRegistered();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('register.errors.submit'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}>
        <Card style={{ gap: spacing[4] }}>
          <Text style={styles.title}>{isShelter ? t('register.titleShelter') : t('register.titleInstitution')}</Text>
          <Text style={styles.subtitle}>
            {isShelter ? t('register.subtitleShelter') : t('register.subtitleInstitution')}
          </Text>
          <Input
            label={isShelter ? t('register.nameLabelShelter') : t('register.nameLabelInstitution')}
            autoCapitalize="words"
            value={name}
            onChangeText={setName}
          />
          <Select label={t('register.typeLabel')} value={type} onValueChange={setType} options={typeOptions} />
          {type === 'Outro' && (
            <Input label={t('register.describeType')} value={customType} onChangeText={setCustomType} />
          )}

          <View style={{ gap: spacing[1] }}>
            <Text style={styles.label}>
              {isShelter ? t('register.logoLabelShelter') : t('register.logoLabelInstitution')}
            </Text>
            {logo ? (
              <Image source={{ uri: logo.uri }} style={styles.logoPreview} />
            ) : (
              <Pressable style={styles.uploadWell} onPress={onPickLogo}>
                <Text style={styles.hint}>{t('register.chooseLogo')}</Text>
              </Pressable>
            )}
            {logo && (
              <Button variant="secondary" onPress={onPickLogo}>
                {t('register.chooseAnotherLogo')}
              </Button>
            )}
          </View>

          {countries ? (
            <Select
              label={t('register.countryLabel')}
              value={countryId}
              onValueChange={setCountryId}
              options={countries.map((c) => ({ label: c.Name, value: c.Region_ID }))}
            />
          ) : (
            <Text style={styles.hint}>{t('register.loadingCountries')}</Text>
          )}
          <Input
            label={t('register.needsListLabel')}
            hint={t('register.needsListHint')}
            value={needsList}
            onChangeText={setNeedsList}
          />
          <Input
            label={t('register.coverageAreaLabel')}
            hint={t('register.coverageAreaHint')}
            value={coverageArea}
            onChangeText={setCoverageArea}
          />

          <View style={{ gap: spacing[1] }}>
            <Text style={styles.label}>{t('register.locationLabel')}</Text>
            {locationStatus === 'capturing' && <Text style={styles.hint}>{t('register.gettingLocation')}</Text>}
            {(locationStatus === 'captured' || locationStatus === 'geocoded') && (
              <Text style={styles.hint}>{t('register.locationConfirmed')}</Text>
            )}
            {(locationStatus === 'failed' || locationStatus === 'geocoding') && (
              <View style={{ gap: spacing[2] }}>
                <Text style={styles.hint}>{t('register.locationFailedHint')}</Text>
                <Input
                  label={t('register.addressLabel')}
                  placeholder={t('register.addressPlaceholder')}
                  value={address}
                  onChangeText={setAddress}
                />
                <Button variant="secondary" onPress={onFindAddress} loading={locationStatus === 'geocoding'}>
                  {t('register.confirmAddress')}
                </Button>
                {locationError ? <ErrorBanner message={locationError} /> : null}
              </View>
            )}
          </View>

          {error ? <ErrorBanner message={error} /> : null}
          <Button onPress={onSubmit} loading={submitting} fullWidth>
            {t('register.submit')}
          </Button>
          <Button variant="ghost" onPress={() => signOutUser()} fullWidth>
            {t('register.notYourAccount')}
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
    fontFamily: 'Manrope-400',
    fontSize: 13.5,
    color: colors.textMuted,
  },
  label: {
    fontFamily: 'Manrope-600',
    fontSize: 13,
    color: colors.text,
  },
  hint: {
    fontFamily: 'Manrope-400',
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
  logoPreview: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
  },
});
