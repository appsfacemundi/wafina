import { INSTITUTION_FIELD_LABEL_KEYS, institutionFieldLabelKey, type GeoRegion } from '@wafina/shared';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/Badge';
import { ErrorBanner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useOwnInstitution } from '@/hooks/useOwnInstitution';
import { ApiError, apiFetch, uploadFile } from '@/lib/api';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

export function SettingsScreen() {
  const { t } = useTranslation();
  const { session, firebaseUser, signOutUser, refreshSession } = useAuth();
  const { institution, loading, refetch } = useOwnInstitution();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const [field, setField] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [logoError, setLogoError] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);

  // RC1 addition, 2026-08-10 — show the institution's registered country and
  // its own ID on its own Settings screen (Country_ID only ever resolves via
  // this list; the institution row has no denormalized country name).
  const [countries, setCountries] = useState<GeoRegion[] | null>(null);
  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        setCountries(await apiFetch<GeoRegion[]>('/geo-regions/all-countries', { idToken }));
      } catch {
        // Non-critical — the country name just falls back to the raw ID below.
      }
    })();
  }, [firebaseUser]);
  const countryName = countries?.find((c) => c.Region_ID === institution?.Country_ID)?.Name;

  // Pilot feedback, 2026-08-05: the Home screen's card had nowhere to show
  // who's actually signed in — Institution's Users.Name was never set by
  // any screen (unlike Donor, set during onboarding). Self-service here
  // both fixes new accounts and backfills existing ones like this test one.
  const [name, setName] = useState(session?.name ?? '');
  const [nameError, setNameError] = useState('');
  const [savingName, setSavingName] = useState(false);

  async function onSaveName() {
    setNameError('');
    if (!name.trim()) {
      setNameError(t('settings.errors.nameRequired'));
      return;
    }
    setSavingName(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/users/me/name', { method: 'PATCH', idToken, body: { name: name.trim() } });
      await refreshSession();
      showToast(t('settings.toastNameUpdated'));
    } catch (err) {
      setNameError(err instanceof ApiError ? err.message : t('settings.errors.saveName'));
    } finally {
      setSavingName(false);
    }
  }

  async function uploadLogo(photo: ImagePicker.ImagePickerAsset) {
    setUploadingLogo(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await uploadFile('/institutions/me/logo', 'logo', photo.uri, {
        method: 'PATCH',
        idToken,
        mimeType: photo.mimeType ?? 'image/jpeg',
      });
      setLogoLoadFailed(false);
      await refetch();
      showToast(t('settings.toastLogoUpdated'));
    } catch (err) {
      setLogoError(err instanceof ApiError ? err.message : t('settings.errors.logoUpload'));
    } finally {
      setUploadingLogo(false);
    }
  }

  async function onPickLogoFromCamera() {
    setLogoError('');
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setLogoError(t('settings.errors.cameraPermission'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) await uploadLogo(result.assets[0]);
  }

  async function onPickLogoFromLibrary() {
    setLogoError('');
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setLogoError(t('settings.errors.libraryPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) await uploadLogo(result.assets[0]);
  }

  // Pilot feedback, 2026-08-05: last of the three upload points to catch up
  // with a camera option — Institution's success-story photo and Donor's
  // donation photo both already had this.
  function onPickLogo() {
    Alert.alert(t('settings.logoPickerTitle'), undefined, [
      { text: t('register.takePhoto'), onPress: onPickLogoFromCamera },
      { text: t('register.chooseFromGallery'), onPress: onPickLogoFromLibrary },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  // Real-device finding, 2026-08-07 — registration requires a Logo
  // (`createInstitution` throws if `!input.Logo`, apps/api/src/services/institutions.ts),
  // so a real institution can never be verified/locked without one already
  // set. Gating on `institution?.Logo` too means an institution that somehow
  // ended up locked with no logo anyway (e.g. force-verified test data,
  // bypassing registration) still gets the upload button instead of being
  // stuck behind a "locked" message for an asset that was never actually
  // there to lock.
  const logoLocked = (institution?.Locked_Fields.includes('Logo') ?? false) && Boolean(institution?.Logo);

  function onPressSignOut() {
    Alert.alert(t('settings.signOutConfirmTitle'), t('settings.signOutConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.signOut'), style: 'destructive', onPress: () => signOutUser() },
    ]);
  }

  async function onSubmit() {
    setError('');
    setSuccess(false);
    if (!field) {
      setError(t('settings.errors.fieldRequired'));
      return;
    }
    if (reason.trim().length < 5) {
      setError(t('settings.errors.reasonTooShort'));
      return;
    }
    setSubmitting(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      const fieldLabelKey = institutionFieldLabelKey(field);
      const fieldLabel = fieldLabelKey ? t(fieldLabelKey) : field;
      await apiFetch('/change-requests', {
        method: 'POST',
        idToken,
        body: { Field_Requested: field, Reason: reason },
      });
      setSuccess(true);
      setField('');
      setReason('');
      showToast(t('settings.changeRequestToast', { field: fieldLabel }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('settings.errors.request'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  const fieldOptions = [
    { label: t('settings.selectPlaceholder'), value: '' },
    ...(institution?.Locked_Fields ?? []).map((f) => ({
      label: INSTITUTION_FIELD_LABEL_KEYS[f] ? t(INSTITUTION_FIELD_LABEL_KEYS[f]) : f,
      value: f,
    })),
  ];

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}>
        <Text style={styles.title}>{t('settings.title')}</Text>

        <Card style={{ gap: spacing[2] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
            {institution?.Logo && !logoLoadFailed ? (
              <Image
                source={{ uri: institution.Logo }}
                style={styles.logo}
                onError={() => setLogoLoadFailed(true)}
              />
            ) : (
              <View style={[styles.logo, styles.logoPlaceholder]}>
                <Text style={styles.logoPlaceholderText}>{t('settings.noLogo')}</Text>
              </View>
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.name}>{institution?.Name}</Text>
              {institution?.Verified && <Badge tone="success">{t('settings.verified')}</Badge>}
            </View>
          </View>
          {logoLocked ? (
            <Text style={styles.hint}>{t('settings.logoLockedHint')}</Text>
          ) : (
            <>
              <Button variant="secondary" onPress={onPickLogo} loading={uploadingLogo}>
                {institution?.Logo ? t('settings.changeLogo') : t('settings.addLogo')}
              </Button>
              {logoError ? <ErrorBanner message={logoError} /> : null}
            </>
          )}
          <Text style={styles.hint}>{session?.email}</Text>
          <Text style={styles.hint}>{t('settings.typeLabel', { type: institution?.Type })}</Text>
          <Text style={styles.hint}>{t('settings.countryLabel', { country: countryName ?? '—' })}</Text>
          <Text style={[styles.hint, { fontFamily: fonts.mono }]}>
            {t('settings.idLabel', { id: institution?.Institution_ID })}
          </Text>
          <View style={{ gap: 4 }}>
            <Input
              label={t('settings.nameLabel')}
              value={name}
              onChangeText={setName}
              placeholder={t('settings.namePlaceholder')}
            />
            {nameError ? <ErrorBanner message={nameError} /> : null}
            <Button variant="secondary" onPress={onSaveName} loading={savingName}>
              {t('settings.saveName')}
            </Button>
          </View>
          {institution?.Address && (
            <Text style={styles.hint}>{t('settings.addressLabel', { address: institution.Address })}</Text>
          )}
          {institution?.Needs_List && (
            <Text style={styles.hint}>{t('settings.needsLabel', { needs: institution.Needs_List })}</Text>
          )}
        </Card>

        <Card style={{ gap: spacing[3] }}>
          <Text style={styles.cardTitle}>{t('settings.requestChangeTitle')}</Text>
          <Text style={styles.hint}>{t('settings.requestChangeHint')}</Text>
          <Select label={t('settings.fieldLabel')} value={field} onValueChange={setField} options={fieldOptions} />
          <View style={{ gap: 4 }}>
            <Text style={styles.label}>{t('settings.reasonLabel')}</Text>
            <TextInput
              style={styles.textarea}
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor={colors.textFaint}
            />
          </View>
          {error ? <ErrorBanner message={error} /> : null}
          {success && <Text style={styles.successText}>{t('settings.requestSent')}</Text>}
          <Button onPress={onSubmit} loading={submitting} fullWidth>
            {t('settings.sendRequest')}
          </Button>
        </Card>

        <Card style={{ gap: spacing[3] }}>
          <Text style={styles.cardTitle}>{t('settings.deleteAccountTitle')}</Text>
          <Text style={styles.hint}>{t('settings.deleteAccountHint')}</Text>
          <Button
            variant="secondary"
            onPress={() => Linking.openURL('https://wafina-donor-web.onrender.com/delete-account')}
          >
            {t('settings.deleteAccountButton')}
          </Button>
        </Card>

        <Card style={{ gap: spacing[3] }}>
          <Text style={styles.cardTitle}>{t('settings.aboutTitle')}</Text>
          <Text style={styles.hint}>{t('settings.aboutText')}</Text>
          <Button variant="secondary" onPress={() => Linking.openURL('https://www.zuinder.com')}>
            www.zuinder.com
          </Button>
          <Button
            variant="secondary"
            onPress={() => Linking.openURL('https://wafina-donor-web.onrender.com/privacy')}
          >
            {t('settings.privacyPolicy')}
          </Button>
          <Button
            variant="secondary"
            onPress={() => Linking.openURL('https://wafina-donor-web.onrender.com/terms')}
          >
            {t('settings.termsOfUse')}
          </Button>
        </Card>

        <Button variant="ghostDanger" onPress={onPressSignOut}>
          {t('common.signOut')}
        </Button>
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
    gap: spacing[4],
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
  },
  cardTitle: {
    fontFamily: 'Manrope-600',
    fontSize: 15,
    color: colors.text,
  },
  name: {
    fontFamily: 'Manrope-600',
    fontSize: 16,
    color: colors.text,
  },
  hint: {
    fontFamily: 'Manrope-400',
    fontSize: 13,
    color: colors.textMuted,
  },
  hintBold: {
    fontFamily: 'Manrope-700',
    color: colors.text,
  },
  label: {
    fontFamily: 'Manrope-600',
    fontSize: 13,
    color: colors.text,
  },
  textarea: {
    fontFamily: 'Manrope-400',
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing[3],
    minHeight: 100,
  },
  successText: {
    fontFamily: 'Manrope-400',
    fontSize: 13,
    color: colors.success,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
  },
  logoPlaceholder: {
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlaceholderText: {
    fontFamily: 'Manrope-400',
    fontSize: 9.5,
    color: colors.textFaint,
    textAlign: 'center',
  },
});
