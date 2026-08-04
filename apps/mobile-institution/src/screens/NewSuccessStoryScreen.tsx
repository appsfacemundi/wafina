import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const { donationId, publicCode } = route.params;
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Real-device finding, 2026-08-04: only the gallery was ever offered — no
  // way to take a photo on the spot, which is the more natural flow for
  // documenting a delivery right after it happens.
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

  async function onSubmit() {
    setError('');
    if (!title.trim()) {
      setError('Indique um título.');
      return;
    }
    if (title.length > MAX_TITLE_LENGTH) {
      setError(`O título não pode exceder ${MAX_TITLE_LENGTH} caracteres.`);
      return;
    }
    if (!description.trim()) {
      setError('Indique uma descrição.');
      return;
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      setError(`A descrição não pode exceder ${MAX_DESCRIPTION_LENGTH} caracteres.`);
      return;
    }
    if (!photo) {
      setError('Adicione uma fotografia.');
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
        },
      });
      showToast('História enviada para aprovação do Admin!');
      navigation.navigate('ClaimedByMeList');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível publicar a história.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}>
        <Card style={{ gap: spacing[4] }}>
          <Text style={styles.title}>Publicar história de impacto</Text>
          <Text style={styles.mono}>Doação: {publicCode}</Text>
          <Input label="Título" value={title} onChangeText={setTitle} hint={`${title.length}/${MAX_TITLE_LENGTH}`} />
          <Input
            label="Descrição"
            value={description}
            onChangeText={setDescription}
            multiline
            hint={`${description.length}/${MAX_DESCRIPTION_LENGTH}`}
          />

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

          {error ? <ErrorBanner message={error} /> : null}
          <Button onPress={onSubmit} loading={submitting} fullWidth>
            Publicar
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
