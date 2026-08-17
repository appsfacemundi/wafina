import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MEDICAL_SUPPLY_EXAMPLES, type GeoRegion, type ImpactFeedVisibility, type SwitchPreference } from '@wafina/shared';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ErrorBanner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { useAuth } from '@/context/AuthContext';
import { ApiError, apiFetch } from '@/lib/api';
import { simulateCountryDetection } from '@/lib/dev-country-simulator';
import type { AppTabParamList, RootStackParamList } from '@/navigation/RootNavigator';
import { colors, fonts, spacing } from '@/theme/tokens';

// Composite for the same reason as HomeScreen's Props — navigating to
// 'CorporateDashboard' targets a RootStack sibling of the tab navigator, not
// a route within AppTab itself.
type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabParamList, 'Settings'>,
  NativeStackScreenProps<RootStackParamList>
>;

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

export function SettingsScreen({ navigation }: Props) {
  const { t } = useTranslation();
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
  const [savingFeedPref, setSavingFeedPref] = useState(false);
  const [savingEmailPref, setSavingEmailPref] = useState(false);

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
        setProfileError(t('settings.profileLoadError'));
      }
    })();
  }, [firebaseUser, t]);

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
      setProfileError(err instanceof ApiError ? err.message : t('settings.saveError'));
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
      setCorporateError(err instanceof ApiError ? err.message : t('settings.corporateJoinError'));
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
      setCountryError(err instanceof ApiError ? err.message : t('settings.countrySwitchError'));
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

  async function onChangeImpactFeedVisibility(visibility: ImpactFeedVisibility) {
    setSavingFeedPref(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/users/me/impact-feed-visibility', { method: 'PATCH', idToken, body: { visibility } });
      await refreshSession();
    } catch {
      // Non-critical — the toggle simply reverts to its saved value on next load if this fails.
    } finally {
      setSavingFeedPref(false);
    }
  }

  async function onChangeEmailNotifications(enabled: boolean) {
    setSavingEmailPref(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/users/me/email-notifications', { method: 'PATCH', idToken, body: { enabled } });
      await refreshSession();
    } catch {
      // Non-critical — the toggle simply reverts to its saved value on next load if this fails.
    } finally {
      setSavingEmailPref(false);
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
      setDeleteError(err instanceof ApiError ? err.message : t('settings.deleteAccountError'));
      setDeleting(false);
    }
  }

  function onPressSignOut() {
    Alert.alert(t('settings.signOutTitle'), t('settings.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.signOutTitle'), style: 'destructive', onPress: () => signOutUser() },
    ]);
  }

  function onPressDeleteAccount() {
    Alert.alert(t('settings.deleteAccountConfirmTitle'), t('settings.deleteAccountConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.deleteAccountConfirmButton'), style: 'destructive', onPress: onDeleteAccount },
    ]);
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[6] }]}>
        <Text style={styles.title}>{t('settings.title')}</Text>

        <Card style={{ gap: spacing[3] }}>
          <Text style={styles.cardTitle}>{t('settings.profileTitle')}</Text>
          {session?.wafinaId && (
            <Text style={[styles.hint, { fontFamily: fonts.mono }]}>
              {t('settings.wafinaIdLabel', { id: session.wafinaId })}
            </Text>
          )}
          {!profile && !profileError && <Text style={styles.hint}>{t('common.loading')}</Text>}
          {profileError && !profile && <ErrorBanner message={profileError} />}
          {profile && countries && (
            <>
              <Input
                label={t('settings.nameLabel')}
                autoCapitalize="words"
                value={profile.Name}
                onChangeText={(v) => setProfile({ ...profile, Name: v })}
              />
              <Input
                label={t('settings.phoneLabel')}
                keyboardType="phone-pad"
                value={profile.Phone}
                onChangeText={(v) => setProfile({ ...profile, Phone: v })}
              />
              <Select
                label={t('settings.homeCountryLabel')}
                value={profile.Home_Country_ID}
                onValueChange={(v) => setProfile({ ...profile, Home_Country_ID: v })}
                options={countries.map((c) => ({ label: c.Name, value: c.Region_ID }))}
              />
              {profileError && <ErrorBanner message={profileError} />}
              {profileSuccess && <Text style={styles.successText}>{t('settings.profileUpdated')}</Text>}
              <Button onPress={onSaveProfile} loading={savingProfile}>
                {t('settings.saveChanges')}
              </Button>
            </>
          )}
        </Card>

        <Card style={{ gap: spacing[3] }}>
          <Text style={styles.cardTitle}>{t('settings.activeCountryTitle')}</Text>
          <Text style={styles.hint}>{t('settings.activeCountryHint')}</Text>
          {allCountries && session?.activeCountryId && (
            <>
              <Select
                label={t('settings.activeCountryLabel')}
                value={session.activeCountryId}
                onValueChange={onChangeActiveCountry}
                options={allCountries.map((c) => ({
                  label: c.Active ? c.Name : `${c.Name}${t('settings.comingSoonSuffix')}`,
                  value: c.Region_ID,
                  enabled: c.Active,
                }))}
              />
              {switchingCountry && <Text style={styles.hint}>{t('settings.switchingCountry')}</Text>}
              {countryError && <ErrorBanner message={countryError} />}
              {countrySuccess && <Text style={styles.successText}>{t('settings.activeCountryUpdated')}</Text>}
              <Select
                label={t('settings.switchPreferenceLabel')}
                value={session.switchPreference ?? 'Always_Ask'}
                onValueChange={(v) => onChangeSwitchPreference(v as SwitchPreference)}
                options={[
                  { label: t('settings.switchPreferenceAlways'), value: 'Always_Ask' },
                  { label: t('settings.switchPreferenceNever'), value: 'Never_Ask_Automatically' },
                ]}
              />
              {savingPreference && <Text style={styles.hint}>{t('settings.savingPreference')}</Text>}
            </>
          )}
        </Card>

        <Card style={{ gap: spacing[3] }}>
          <Text style={styles.cardTitle}>{t('settings.corporateTitle')}</Text>
          {session?.donorSubtype === 'Corporate' ? (
            <>
              <Text style={styles.hint}>{t('settings.corporateAlreadyLinked')}</Text>
              <Button variant="secondary" onPress={() => navigation.navigate('CorporateDashboard')}>
                {t('settings.viewCorporateDashboard')}
              </Button>
            </>
          ) : (
            <>
              <Text style={styles.hint}>{t('settings.corporateHint')}</Text>
              <Input label={t('settings.inviteCodeLabel')} value={inviteCode} onChangeText={setInviteCode} />
              {corporateError && <ErrorBanner message={corporateError} />}
              {corporateSuccess && <Text style={styles.successText}>{t('settings.corporateJoinSuccess')}</Text>}
              <Button variant="secondary" onPress={onJoinCorporate} loading={joiningCorporate}>
                {t('settings.joinAccountButton')}
              </Button>
            </>
          )}
        </Card>

        <Card style={{ gap: spacing[3] }}>
          <Text style={styles.cardTitle}>{t('settings.privacyTitle')}</Text>
          <Text style={styles.hint}>{t('settings.privacyHint')}</Text>
          <Select
            label={t('settings.showNameLabel')}
            value={session?.showNameToInstitutions ? 'yes' : 'no'}
            onValueChange={(v) => onChangeShowName(v === 'yes')}
            options={[
              { label: t('settings.showNameNo'), value: 'no' },
              { label: t('settings.showNameYes'), value: 'yes' },
            ]}
          />
          {savingNamePref && <Text style={styles.hint}>{t('settings.saving')}</Text>}
        </Card>

        <Card style={{ gap: spacing[3] }}>
          <Text style={styles.cardTitle}>{t('settings.impactFeedTitle')}</Text>
          <Text style={styles.hint}>{t('settings.impactFeedHint')}</Text>
          <Select
            label={t('settings.feedVisibilityLabel')}
            value={session?.impactFeedVisibility ?? 'Private'}
            onValueChange={(v) => onChangeImpactFeedVisibility(v as ImpactFeedVisibility)}
            options={[
              { label: t('settings.feedVisibilityPrivate'), value: 'Private' },
              { label: t('settings.feedVisibilityPublic'), value: 'Public' },
            ]}
          />
          {savingFeedPref && <Text style={styles.hint}>{t('settings.saving')}</Text>}
        </Card>

        <Card style={{ gap: spacing[3] }}>
          <Text style={styles.cardTitle}>{t('settings.notificationsTitle')}</Text>
          <Text style={styles.hint}>{t('settings.notificationsHint')}</Text>
          <Select
            label={t('settings.emailNotificationsLabel')}
            value={session?.emailNotificationsEnabled ? 'yes' : 'no'}
            onValueChange={(v) => onChangeEmailNotifications(v === 'yes')}
            options={[
              { label: t('settings.emailNotificationsYes'), value: 'yes' },
              { label: t('settings.emailNotificationsNo'), value: 'no' },
            ]}
          />
          {savingEmailPref && <Text style={styles.hint}>{t('settings.saving')}</Text>}
        </Card>

        {__DEV__ && (
          <Card style={{ gap: spacing[3] }}>
            <Text style={styles.cardTitle}>{t('settings.devOptionsTitle')}</Text>
            <Text style={styles.hint}>{t('settings.devOptionsHint')}</Text>
            {SIMULATABLE_COUNTRIES.map((c) => (
              <Button
                key={c.isoCode}
                variant="secondary"
                onPress={() => simulateCountryDetection(c.isoCode)}
              >
                {t('settings.simulateCountry', { country: c.label })}
              </Button>
            ))}
          </Card>
        )}

        <Card style={{ gap: spacing[3] }}>
          <Text style={[styles.cardTitle, { color: colors.danger }]}>{t('settings.deleteAccountTitle')}</Text>
          <Text style={styles.hint}>{t('settings.deleteAccountHint')}</Text>
          {deleteError && <ErrorBanner message={deleteError} />}
          <Button variant="danger" onPress={onPressDeleteAccount} loading={deleting}>
            {t('settings.deleteAccountButton')}
          </Button>
        </Card>

        {/* Donation categories reference, 2026-08-07 — a donor deciding whether an item qualifies as 'Material Médico' needs this once, not every time they open the Donate form (see MEDICAL_SUPPLY_INFO's comment in @wafina/shared). */}
        <Card style={{ gap: spacing[3] }}>
          <Text style={styles.cardTitle}>{t('settings.medicalSupplyTitle')}</Text>
          <Text style={styles.hint}>{t('settings.medicalSupplyHint')}</Text>
          <View style={{ gap: spacing[2] }}>
            {MEDICAL_SUPPLY_EXAMPLES.map((item) => (
              <View key={item.label} style={styles.medicalSupplyRow}>
                <Text style={styles.medicalSupplyEmoji}>{item.emoji}</Text>
                <Text style={styles.medicalSupplyLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
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
            {t('settings.privacyPolicyButton')}
          </Button>
          <Button
            variant="secondary"
            onPress={() => Linking.openURL('https://wafina-donor-web.onrender.com/terms')}
          >
            {t('settings.termsButton')}
          </Button>
        </Card>

        <Button variant="ghostDanger" onPress={onPressSignOut}>
          {t('settings.signOutTitle')}
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
  hint: {
    fontFamily: 'Manrope-400',
    fontSize: 13.5,
    color: colors.textMuted,
  },
  hintBold: {
    fontFamily: 'Manrope-700',
    color: colors.text,
  },
  successText: {
    fontFamily: 'Manrope-400',
    fontSize: 13,
    color: colors.success,
  },
  medicalSupplyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  medicalSupplyEmoji: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  medicalSupplyLabel: {
    fontFamily: 'Manrope-400',
    fontSize: 13.5,
    color: colors.text,
    flex: 1,
  },
});
