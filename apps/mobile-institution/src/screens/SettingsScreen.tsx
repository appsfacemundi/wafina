import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '@/components/Badge';
import { ErrorBanner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Select } from '@/components/Select';
import { useAuth } from '@/context/AuthContext';
import { useOwnInstitution } from '@/hooks/useOwnInstitution';
import { ApiError, apiFetch } from '@/lib/api';
import { colors, fonts, spacing } from '@/theme/tokens';

const FIELD_LABEL: Record<string, string> = {
  Name: 'Nome',
  Type: 'Tipo',
  Location: 'Localização',
  Needs_List: 'Lista de necessidades',
  Logo: 'Logótipo',
};

export function SettingsScreen() {
  const { session, firebaseUser, signOutUser } = useAuth();
  const { institution, loading } = useOwnInstitution();
  const insets = useSafeAreaInsets();

  const [field, setField] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      await apiFetch('/change-requests', {
        method: 'POST',
        idToken,
        body: { Field_Requested: field, Reason: reason },
      });
      setSuccess(true);
      setField('');
      setReason('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o pedido.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  const fieldOptions = [
    { label: 'Selecione…', value: '' },
    ...(institution?.Locked_Fields ?? []).map((f) => ({ label: FIELD_LABEL[f] ?? f, value: f })),
  ];

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}>
        <Text style={styles.title}>Definições</Text>

        <Card style={{ gap: spacing[2] }}>
          <Text style={styles.name}>{institution?.Name}</Text>
          <Text style={styles.hint}>{session?.email}</Text>
          <Text style={styles.hint}>Tipo: {institution?.Type}</Text>
          {institution?.Needs_List && <Text style={styles.hint}>Necessidades: {institution.Needs_List}</Text>}
          {institution?.Verified && <Badge tone="success">Verificado</Badge>}
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

        <Button variant="secondary" onPress={() => signOutUser()}>
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
});
