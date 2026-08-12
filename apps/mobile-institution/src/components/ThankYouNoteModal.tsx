import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

/**
 * Donation lifecycle emails, 2026-08-11 — shown right before confirming
 * final delivery. Entirely optional (per spec: never a rubber stamp
 * requirement) — "Confirmar entrega" works identically whether or not a
 * message/photo is left. What's entered here is used only to personalize
 * the donor's own confirmation email; it's a private note, not a public
 * Success Story (that remains its own separate, Admin-moderated flow).
 */
export function ThankYouNoteModal({
  visible,
  submitting,
  onSkip,
  onSubmit,
}: {
  visible: boolean;
  submitting: boolean;
  onSkip: () => void;
  onSubmit: (message: string, photo: ImagePicker.ImagePickerAsset | null) => void;
}) {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);

  async function onPickFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0]);
  }

  async function onPickFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0]);
  }

  function onPickPhoto() {
    Alert.alert(t('thankYouNote.addPhotoTitle'), undefined, [
      { text: t('register.takePhoto'), onPress: onPickFromCamera },
      { text: t('register.chooseFromGallery'), onPress: onPickFromLibrary },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  function reset() {
    setMessage('');
    setPhoto(null);
  }

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onSkip}>
      <View style={styles.backdrop}>
        <Card style={styles.card}>
          <Text style={styles.title}>{t('thankYouNote.title')}</Text>
          <Text style={styles.body}>{t('thankYouNote.body')}</Text>
          <TextInput
            multiline
            numberOfLines={3}
            placeholder={t('thankYouNote.placeholder')}
            placeholderTextColor={colors.textFaint}
            value={message}
            onChangeText={setMessage}
            style={styles.input}
          />
          {photo ? (
            <View style={styles.photoWrap}>
              <Image source={{ uri: photo.uri }} style={styles.photo} resizeMode="cover" />
              <Pressable
                style={styles.removePhotoBtn}
                onPress={() => setPhoto(null)}
                accessibilityRole="button"
                accessibilityLabel={t('thankYouNote.removePhoto')}
                hitSlop={8}
              >
                <Ionicons name="close" size={16} color={colors.accentText} />
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.addPhotoBtn} onPress={onPickPhoto}>
              <Ionicons name="camera-outline" size={18} color={colors.textMuted} />
              <Text style={styles.addPhotoText}>{t('thankYouNote.addPhoto')}</Text>
            </Pressable>
          )}
          <Button
            onPress={() => {
              onSubmit(message.trim(), photo);
              reset();
            }}
            loading={submitting}
            fullWidth
          >
            {t('thankYouNote.confirmButton')}
          </Button>
          <Button
            variant="ghost"
            onPress={() => {
              reset();
              onSkip();
            }}
            disabled={submitting}
            fullWidth
          >
            {t('thankYouNote.skipButton')}
          </Button>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    padding: spacing[6],
  },
  card: {
    gap: spacing[3],
    borderRadius: radius.lg,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.text,
  },
  body: {
    fontFamily: 'Manrope-400',
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  input: {
    fontFamily: 'Manrope-400',
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: spacing[3],
    minHeight: 80,
    textAlignVertical: 'top',
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: spacing[3],
  },
  addPhotoText: {
    fontFamily: 'Manrope-600',
    fontSize: 13,
    color: colors.textMuted,
  },
  photoWrap: {
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: 160,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: spacing[2],
    right: spacing[2],
    width: 26,
    height: 26,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
