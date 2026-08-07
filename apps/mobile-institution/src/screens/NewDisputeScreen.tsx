import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorBanner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { ApiError, apiFetch } from '@/lib/api';
import type { DisputesStackParamList } from '@/navigation/RootNavigator';
import { colors, fonts, spacing } from '@/theme/tokens';

const MIN_LENGTH = 10;

type Props = NativeStackScreenProps<DisputesStackParamList, 'NewDispute'>;

export function NewDisputeScreen({ route, navigation }: Props) {
  const { donationId, publicCode } = route.params;
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError('');
    if (description.trim().length < MIN_LENGTH) {
      setError(`Descreva a ocorrência com pelo menos ${MIN_LENGTH} caracteres.`);
      return;
    }
    setSubmitting(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/disputes', {
        method: 'POST',
        idToken,
        body: { Donation_ID: donationId, Issue_Description: description },
      });
      showToast('Ocorrência comunicada com sucesso.');
      navigation.navigate('DisputesList');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar a ocorrência.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Card style={{ marginHorizontal: spacing[6], marginTop: insets.top + spacing[6], marginBottom: spacing[6], gap: spacing[3] }}>
        <Text style={styles.title}>Comunicar Ocorrência</Text>
        <Text style={styles.mono}>Doação: {publicCode}</Text>
        <Text style={styles.label}>Descrição da ocorrência</Text>
        <TextInput
          style={styles.textarea}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          placeholderTextColor={colors.textFaint}
        />
        {error ? <ErrorBanner message={error} /> : null}
        <Button onPress={onSubmit} loading={submitting} fullWidth>
          Comunicar Ocorrência
        </Button>
      </Card>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
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
    minHeight: 120,
  },
});
