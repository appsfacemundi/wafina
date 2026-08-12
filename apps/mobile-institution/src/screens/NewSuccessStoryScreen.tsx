import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ErrorBanner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { ApiError, uploadFile } from '@/lib/api';
import type { ClaimedByMeStackParamList } from '@/navigation/RootNavigator';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 600;

type Props = NativeStackScreenProps<ClaimedByMeStackParamList, 'NewSuccessStory'>;

export function NewSuccessStoryScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { donationId, publicCode } = route.params;
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [showDonationDetails, setShowDonationDetails] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Real-device finding, 2026-08-04: only the gallery was ever offered — no
  // way to take a photo on the spot, which is the more natural flow for
  // documenting a delivery right after it happens.
  async function onPickFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setError(t('successStory.errors.cameraPermission'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0]);
  }

  async function onPickFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError(t('successStory.errors.libraryPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0]);
  }

  function onPickPhoto() {
    Alert.alert(t('successStory.addPhotoTitle'), undefined, [
      { text: t('register.takePhoto'), onPress: onPickFromCamera },
      { text: t('register.chooseFromGallery'), onPress: onPickFromLibrary },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  async function onSubmit() {
    setError('');
    if (!title.trim()) {
      setError(t('successStory.errors.titleRequired'));
      return;
    }
    if (title.length > MAX_TITLE_LENGTH) {
      setError(t('successStory.errors.titleTooLong', { max: MAX_TITLE_LENGTH }));
      return;
    }
    if (!description.trim()) {
      setError(t('successStory.errors.descriptionRequired'));
      return;
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      setError(t('successStory.errors.descriptionTooLong', { max: MAX_DESCRIPTION_LENGTH }));
      return;
    }
    if (!photo) {
      setError(t('successStory.errors.photoRequired'));
      return;
    }

    setSubmitting(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await uploadFile('/success-stories', 'image', photo.uri, {
        idToken,
        mimeType: photo.mimeType ?? 'image/jpeg',
        parameters: {
          Donation_ID: donationId,
          Title: title,
          Description: description,
          Show_Donation_Details: String(showDonationDetails),
        },
      });
      showToast(t('successStory.successToast'));
      navigation.navigate('ClaimedByMeList');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('successStory.errors.publish'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}>
        <Card style={{ gap: spacing[4] }}>
          <Text style={styles.title}>{t('successStory.publishTitle')}</Text>
          <Text style={styles.mono}>{t('successStory.donationMono', { code: publicCode })}</Text>
          <Input
            label={t('successStory.titleLabel')}
            value={title}
            onChangeText={setTitle}
            hint={`${title.length}/${MAX_TITLE_LENGTH}`}
          />
          <Input
            label={t('successStory.descriptionLabel')}
            value={description}
            onChangeText={setDescription}
            multiline
            hint={`${description.length}/${MAX_DESCRIPTION_LENGTH}`}
          />

          {photo ? (
            <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="contain" />
          ) : (
            <Pressable style={styles.uploadWell} onPress={onPickPhoto}>
              <Text style={styles.uploadText}>{t('successStory.choosePhoto')}</Text>
            </Pressable>
          )}
          {photo && (
            <Button variant="secondary" onPress={onPickPhoto}>
              {t('successStory.chooseAnotherPhoto')}
            </Button>
          )}

          <Pressable
            onPress={() => setShowDonationDetails((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: showDonationDetails }}
            style={styles.checkboxRow}
          >
            <Ionicons
              name={showDonationDetails ? 'checkbox' : 'square-outline'}
              size={22}
              color={showDonationDetails ? colors.accent : colors.textFaint}
            />
            <Text style={styles.checkboxLabel}>
              {t('successStory.showDetailsLabel')}
              {'\n'}
              <Text style={styles.checkboxHint}>{t('successStory.showDetailsHint')}</Text>
            </Text>
          </Pressable>

          {error ? <ErrorBanner message={error} /> : null}
          <Button onPress={onSubmit} loading={submitting} fullWidth>
            {t('successStory.publishButton')}
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
  mono: {
    fontFamily: fonts.mono,
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
    fontFamily: 'Manrope-400',
    fontSize: 13,
    color: colors.textMuted,
  },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  checkboxLabel: {
    flex: 1,
    fontFamily: 'Manrope-600',
    fontSize: 13.5,
    color: colors.text,
  },
  checkboxHint: {
    fontFamily: 'Manrope-400',
    fontSize: 12,
    color: colors.textFaint,
  },
});
