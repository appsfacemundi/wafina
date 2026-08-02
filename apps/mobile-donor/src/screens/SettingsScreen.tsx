import type { GeoRegion, SwitchPreference } from '@wafina/shared';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorBanner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { useAuth } from '@/context/AuthContext';
import { ApiError, apiFetch } from '@/lib/api';
import { simulateCountryDetection } from '@/lib/dev-country-simulator';
import { colors, fonts, spacing } from '@/theme/tokens';

/** The 5 countries geo-detect.ts can actually recognize from coordinates today. */
const SIMULATABLE_COUNTRIES = [
  { label: 'Angola', isoCode: 'AO' },
  { label: 'Portugal', isoCode: 'PT' },
  { label: 'Brasil', isoCode: 'BR' },
  { label: 'Moçambique', isoCode: 'MZ' },
  { label: 'Cabo Verde', isoCode: 'CV' },
];

interface ProfileData {
  Name: string;
  Phone: string;
  Home_Country_ID: string;
}

export function SettingsScreen() {
  const { firebaseUser, session, refreshSession, signOutUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [countries, setCountries] = useState<GeoRegion[] | null>(null);
  const [allCountries, setAllCountries] = useState<GeoRegion[] | null>(null);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [inviteCode, setInviteCode] = useState('');
  const [corporateError, setCorporateError] = useState('');
  const [corporateSuccess, setCorporateSuccess] = useState(false);
  const [joiningCorporate, setJoiningCorporate] = useState(false);

  const [switchingCountry, setSwitchingCountry] = useState(false);
  const [countryError, setCountryError] = useState('');
  const [countrySuccess, setCountrySuccess] = useState(false);
  const [savingPreference, setSavingPreference] = useState(false);

  const [savingNamePref, setSavingNamePref] = useState(false);

  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        const [profileData, countryList, allCountryList] = await Promise.all([
          apiFetch<ProfileData>('/donor/profile', { idToken }),
          apiFetch<GeoRegion[]>('/geo-regions/countries', { idToken }),
          apiFetch<GeoRegion[]>('/geo-regions/all-countries', { idToken }),
        ]);
        setProfile(profileData);
        setCountries(countryList);
        setAllCountries(allCountryList);
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
      // Note: editing Home Country here deliberately does NOT change Active
      // Country — that's a separate, explicit action below. See services/users.ts.
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

  async function onChangeActiveCountry(countryId: string) {
    setCountryError('');
    setCountrySuccess(false);
    setSwitchingCountry(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/users/me/active-country', { method: 'PATCH', idToken, body: { countryId } });
      await refreshSession();
      setCountrySuccess(true);
    } catch (err) {
      setCountryError(err instanceof ApiError ? err.message : 'Não foi possível mudar de país.');
    } finally {
      setSwitchingCountry(false);
    }
  }

  async function onChangeSwitchPreference(preference: SwitchPreference) {
    setSavingPreference(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/users/me/switch-preference', { method: 'PATCH', idToken, body: { preference } });
      await refreshSession();
    } catch {
      // Non-critical — the prompt simply keeps showing if this silently fails.
    } finally {
      setSavingPreference(false);
    }
  }

  async function onChangeShowName(show: boolean) {
    setSavingNamePref(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/users/me/show-name-to-institutions', { method: 'PATCH', idToken, body: { show } });
      await refreshSession();
    } catch {
      // Non-critical — the toggle simply reverts to its saved value on next load if this fails.
    } finally {
      setSavingNamePref(false);
    }
  }

  async function onDeleteAccount() {
    setDeleteError('');
    setDeleting(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/donor/account', { method: 'DELETE', idToken });
      await signOutUser();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Não foi possível eliminar a conta.');
      setDeleting(false);
    }
  }

  function onPressDeleteAccount() {
    Alert.alert(
      'Eliminar conta',
      'Isto elimina permanentemente o seu perfil e acesso à conta Wafina. O seu histórico de doações já entregues pode ser mantido de forma anonimizada para estatísticas de impacto agregadas. Esta ação não pode ser revertida.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: onDeleteAccount },
      ],
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}>
        <Text style={styles.title}>Definições</Text>

        <Card style={{ gap: spacing[3] }}>
          <Text style={styles.cardTitle}>Perfil</Text>
          {!profile && !profileError && <Text style={styles.hint}>A carregar…</Text>}
          {profileError && !profile && <ErrorBanner message={profileError} />}
          {profile && countries && (
            <>
              <Input
                label="Nome"
                autoCapitalize="words"
                value={profile.Name}
                onChangeText={(v) => setProfile({ ...profile, Name: v })}
              />
              <Input
                label="Telefone"
                keyboardType="phone-pad"
                value={profile.Phone}
                onChangeText={(v) => setProfile({ ...profile, Phone: v })}
              />
              <Select
                label="País de origem"
                value={profile.Home_Country_ID}
                onValueChange={(v) => setProfile({ ...profile, Home_Country_ID: v })}
                options={countries.map((c) => ({ label: c.Name, value: c.Region_ID }))}
              />
              {profileError && <ErrorBanner message={profileError} />}
              {profileSuccess && <Text style={styles.successText}>Perfil atualizado.</Text>}
              <Button onPress={onSaveProfile} loading={savingProfile}>
                Guardar alterações
              </Button>
            </>
          )}
        </Card>

        <Card style={{ gap: spacing[3] }}>
          <Text style={styles.cardTitle}>País ativo</Text>
          <Text style={styles.hint}>
            Determina quais as instituições e doações que vê. Mudar de país nunca altera doações já
            submetidas.
          </Text>
          {allCountries && session?.activeCountryId && (
            <>
              <Select
                label="País ativo"
                value={session.activeCountryId}
                onValueChange={onChangeActiveCountry}
                options={allCountries.map((c) => ({
                  label: c.Active ? c.Name : `${c.Name} — Brevemente`,
                  value: c.Region_ID,
                  enabled: c.Active,
                }))}
              />
              {switchingCountry && <Text style={styles.hint}>A mudar de país…</Text>}
              {countryError && <ErrorBanner message={countryError} />}
              {countrySuccess && <Text style={styles.successText}>País ativo atualizado.</Text>}
              <Select
                label="Sugerir mudança ao detetar viagem?"
                value={session.switchPreference ?? 'Always_Ask'}
                onValueChange={(v) => onChangeSwitchPreference(v as SwitchPreference)}
                options={[
                  { label: 'Perguntar sempre', value: 'Always_Ask' },
                  { label: 'Nunca perguntar automaticamente', value: 'Never_Ask_Automatically' },
                ]}
              />
              {savingPreference && <Text style={styles.hint}>A guardar preferência…</Text>}
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

        <Card style={{ gap: spacing[3] }}>
          <Text style={styles.cardTitle}>Privacidade</Text>
          <Text style={styles.hint}>
            Se ativar, a instituição que receber uma doação sua vê o seu nome no cartão da doação.
            Caso contrário, a doação aparece sem identificação pessoal.
          </Text>
          <Select
            label="Mostrar o meu nome às instituições"
            value={session?.showNameToInstitutions ? 'yes' : 'no'}
            onValueChange={(v) => onChangeShowName(v === 'yes')}
            options={[
              { label: 'Não mostrar', value: 'no' },
              { label: 'Mostrar o meu nome', value: 'yes' },
            ]}
          />
          {savingNamePref && <Text style={styles.hint}>A guardar…</Text>}
        </Card>

        {__DEV__ && (
          <Card style={{ gap: spacing[3] }}>
            <Text style={styles.cardTitle}>Opções de programador</Text>
            <Text style={styles.hint}>
              Simula o país detetado por GPS, sem precisar de VPN ou de uma app de localização
              falsa. Nunca aparece fora de um build de desenvolvimento.
            </Text>
            {SIMULATABLE_COUNTRIES.map((c) => (
              <Button
                key={c.isoCode}
                variant="secondary"
                onPress={() => simulateCountryDetection(c.isoCode)}
              >
                Simular {c.label}
              </Button>
            ))}
          </Card>
        )}

        <Card style={{ gap: spacing[3] }}>
          <Text style={[styles.cardTitle, { color: colors.danger }]}>Eliminar conta</Text>
          <Text style={styles.hint}>
            Elimina permanentemente o seu perfil e acesso à sua conta Wafina. O seu histórico de
            doações já entregues pode ser mantido de forma anonimizada para estatísticas de impacto
            agregadas.
          </Text>
          {deleteError && <ErrorBanner message={deleteError} />}
          <Button variant="danger" onPress={onPressDeleteAccount} loading={deleting}>
            Eliminar a minha conta
          </Button>
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
