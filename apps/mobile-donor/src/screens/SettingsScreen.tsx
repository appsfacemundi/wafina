import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorBanner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { useAuth } from '@/context/AuthContext';
import { ApiError, apiFetch } from '@/lib/api';
import { colors, fonts, spacing } from '@/theme/tokens';

interface ProfileData {
  Name: string;
  Phone: string;
  Country: string;
}

export function SettingsScreen() {
  const { firebaseUser, session, refreshSession, signOutUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [inviteCode, setInviteCode] = useState('');
  const [corporateError, setCorporateError] = useState('');
  const [corporateSuccess, setCorporateSuccess] = useState(false);
  const [joiningCorporate, setJoiningCorporate] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        setProfile(await apiFetch<ProfileData>('/donor/profile', { idToken }));
      } catch {
        setProfileError('Não foi possível carregar o seu perfil.');
      }
    })();
  }, [firebaseUser]);

  async function onSaveProfile() {
    if (!profile) return;
    setProfileError('');
    setProfileSuccess(false);
    setSavingProfile(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/donor/profile', { method: 'PATCH', idToken, body: profile });
      setProfileSuccess(true);
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : 'Não foi possível guardar.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function onJoinCorporate() {
    setCorporateError('');
    setCorporateSuccess(false);
    setJoiningCorporate(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/donor/corporate/join', { method: 'POST', idToken, body: { inviteCode } });
      await refreshSession();
      setCorporateSuccess(true);
      setInviteCode('');
    } catch (err) {
      setCorporateError(err instanceof ApiError ? err.message : 'Não foi possível associar a conta.');
    } finally {
      setJoiningCorporate(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}>
        <Text style={styles.title}>Definições</Text>

        <Card style={{ gap: spacing[3] }}>
          <Text style={styles.cardTitle}>Perfil</Text>
          {!profile && !profileError && <Text style={styles.hint}>A carregar…</Text>}
          {profileError && !profile && <ErrorBanner message={profileError} />}
          {profile && (
            <>
              <Input label="Nome" value={profile.Name} onChangeText={(v) => setProfile({ ...profile, Name: v })} />
              <Input
                label="Telefone"
                keyboardType="phone-pad"
                value={profile.Phone}
                onChangeText={(v) => setProfile({ ...profile, Phone: v })}
              />
              <Input
                label="País"
                value={profile.Country}
                onChangeText={(v) => setProfile({ ...profile, Country: v })}
              />
              {profileError && <ErrorBanner message={profileError} />}
              {profileSuccess && (
                <Text style={styles.successText}>Perfil atualizado.</Text>
              )}
              <Button onPress={onSaveProfile} loading={savingProfile}>
                Guardar alterações
              </Button>
            </>
          )}
        </Card>

        <Card style={{ gap: spacing[3] }}>
          <Text style={styles.cardTitle}>Conta corporativa</Text>
          {session?.donorSubtype === 'Corporate' ? (
            <Text style={styles.hint}>Esta conta já está associada a uma conta corporativa.</Text>
          ) : (
            <>
              <Text style={styles.hint}>
                Se a sua empresa tem uma parceria com a Wafina, introduza o código fornecido pelo Admin.
              </Text>
              <Input label="Código de convite" value={inviteCode} onChangeText={setInviteCode} />
              {corporateError && <ErrorBanner message={corporateError} />}
              {corporateSuccess && <Text style={styles.successText}>Conta associada com sucesso.</Text>}
              <Button variant="secondary" onPress={onJoinCorporate} loading={joiningCorporate}>
                Associar conta
              </Button>
            </>
          )}
        </Card>

        <Button variant="ghost" onPress={() => signOutUser()}>
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
  hint: {
    fontFamily: 'WorkSans-400',
    fontSize: 13.5,
    color: colors.textMuted,
  },
  successText: {
    fontFamily: 'WorkSans-400',
    fontSize: 13,
    color: colors.success,
  },
});
