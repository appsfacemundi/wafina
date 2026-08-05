import { INSTITUTION_FIELD_LABELS } from '@wafina/shared';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
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
      setNameError('Indique o seu nome.');
      return;
    }
    setSavingName(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/users/me/name', { method: 'PATCH', idToken, body: { name: name.trim() } });
      await refreshSession();
      showToast('Nome atualizado com sucesso!');
    } catch (err) {
      setNameError(err instanceof ApiError ? err.message : 'Não foi possível guardar o nome.');
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
      showToast('Logótipo atualizado com sucesso!');
    } catch (err) {
      setLogoError(err instanceof ApiError ? err.message : 'Não foi possível enviar o logótipo.');
    } finally {
      setUploadingLogo(false);
    }
  }

  async function onPickLogoFromCamera() {
    setLogoError('');
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setLogoError('É necessário acesso à câmara para tirar uma fotografia.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) await uploadLogo(result.assets[0]);
  }

  async function onPickLogoFromLibrary() {
    setLogoError('');
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setLogoError('É necessário acesso às fotografias para escolher um logótipo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) await uploadLogo(result.assets[0]);
  }

  // Pilot feedback, 2026-08-05: last of the three upload points to catch up
  // with a camera option — Institution's success-story photo and Donor's
  // donation photo both already had this.
  function onPickLogo() {
    Alert.alert('Logótipo', undefined, [
      { text: 'Tirar fotografia', onPress: onPickLogoFromCamera },
      { text: 'Escolher da galeria', onPress: onPickLogoFromLibrary },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  const logoLocked = institution?.Locked_Fields.includes('Logo') ?? false;

  function onPressSignOut() {
    Alert.alert('Sair', 'Tem a certeza que quer sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => signOutUser() },
    ]);
  }

  async function onSubmit() {
    setError('');
    setSuccess(false);
    if (!field) {
      setError('Escolha o campo que pretende alterar.');
      return;
    }
    if (reason.trim().length < 5) {
      setError('Explique o motivo com pelo menos 5 caracteres.');
      return;
    }
    setSubmitting(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      const fieldLabel = INSTITUTION_FIELD_LABELS[field] ?? field;
      await apiFetch('/change-requests', {
        method: 'POST',
        idToken,
        body: { Field_Requested: field, Reason: reason },
      });
      setSuccess(true);
      setField('');
      setReason('');
      showToast(`O seu pedido de alteração de "${fieldLabel}" foi enviado ao Admin.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o pedido.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  const fieldOptions = [
    { label: 'Selecione…', value: '' },
    ...(institution?.Locked_Fields ?? []).map((f) => ({ label: INSTITUTION_FIELD_LABELS[f] ?? f, value: f })),
  ];

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}>
        <Text style={styles.title}>Definições</Text>

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
                <Text style={styles.logoPlaceholderText}>Sem{'\n'}logótipo</Text>
              </View>
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.name}>{institution?.Name}</Text>
              {institution?.Verified && <Badge tone="success">Verificado</Badge>}
            </View>
          </View>
          {logoLocked ? (
            <Text style={styles.hint}>O logótipo está bloqueado. Peça uma alteração abaixo para o mudar.</Text>
          ) : (
            <>
              <Button variant="secondary" onPress={onPickLogo} loading={uploadingLogo}>
                {institution?.Logo ? 'Alterar logótipo' : 'Adicionar logótipo'}
              </Button>
              {logoError ? <ErrorBanner message={logoError} /> : null}
            </>
          )}
          <Text style={styles.hint}>{session?.email}</Text>
          <Text style={styles.hint}>Tipo: {institution?.Type}</Text>
          <View style={{ gap: 4 }}>
            <Input label="O seu nome" value={name} onChangeText={setName} placeholder="Ex: Maria Silva" />
            {nameError ? <ErrorBanner message={nameError} /> : null}
            <Button variant="secondary" onPress={onSaveName} loading={savingName}>
              Guardar nome
            </Button>
          </View>
          {institution?.Address && <Text style={styles.hint}>Morada: {institution.Address}</Text>}
          {institution?.Needs_List && <Text style={styles.hint}>Necessidades: {institution.Needs_List}</Text>}
        </Card>

        <Card style={{ gap: spacing[3] }}>
          <Text style={styles.cardTitle}>Solicitar alteração</Text>
          <Text style={styles.hint}>
            O seu perfil está bloqueado após a verificação. Para alterar um campo, peça ao Admin.
          </Text>
          <Select label="Campo" value={field} onValueChange={setField} options={fieldOptions} />
          <View style={{ gap: 4 }}>
            <Text style={styles.label}>Motivo</Text>
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
          {success && <Text style={styles.successText}>Pedido enviado ao Admin.</Text>}
          <Button onPress={onSubmit} loading={submitting} fullWidth>
            Enviar pedido
          </Button>
        </Card>

        <Card style={{ gap: spacing[3] }}>
          <Text style={styles.cardTitle}>Eliminar conta</Text>
          <Text style={styles.hint}>
            Para solicitar a eliminação da sua conta e dos dados associados, consulte a nossa página
            de eliminação de conta.
          </Text>
          <Button
            variant="secondary"
            onPress={() => Linking.openURL('https://wafina-donor-web.onrender.com/delete-account')}
          >
            Solicitar eliminação de conta
          </Button>
        </Card>

        <Button variant="secondary" onPress={onPressSignOut}>
          Sair
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
    fontFamily: 'WorkSans-600',
    fontSize: 15,
    color: colors.text,
  },
  name: {
    fontFamily: 'WorkSans-600',
    fontSize: 16,
    color: colors.text,
  },
  hint: {
    fontFamily: 'WorkSans-400',
    fontSize: 13,
    color: colors.textMuted,
  },
  label: {
    fontFamily: 'WorkSans-600',
    fontSize: 13,
    color: colors.text,
  },
  textarea: {
    fontFamily: 'WorkSans-400',
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
    fontFamily: 'WorkSans-400',
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
    fontFamily: 'WorkSans-400',
    fontSize: 9.5,
    color: colors.textFaint,
    textAlign: 'center',
  },
});
