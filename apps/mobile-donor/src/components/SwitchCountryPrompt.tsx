import { detectSupportedCountryFromCoords, type GeoRegion } from '@wafina/shared';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ErrorBanner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { onSimulatedCountryDetection } from '@/lib/dev-country-simulator';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

/**
 * Phase 3A Module 1 — the GPS-assisted switch-country prompt. Runs once per
 * app session on Home mount. GPS is only ever a *suggestion*: this component
 * has no code path that changes Active_Country_ID without the user tapping
 * "Switch now" — detection alone never reaches the API.
 */
export function SwitchCountryPrompt() {
  const { t } = useTranslation();
  const { firebaseUser, session, refreshSession } = useAuth();
  const [detected, setDetected] = useState<GeoRegion | null>(null);
  const [actionError, setActionError] = useState('');
  const checkedRef = useRef(false);

  async function checkIsoCode(isoCode: string | null) {
    if (!isoCode || !session?.activeCountryId) return;
    try {
      const idToken = await firebaseUser?.getIdToken();
      const countries = await apiFetch<GeoRegion[]>('/geo-regions/countries', { idToken });
      const match = countries.find((c) => c.ISO_Code === isoCode);
      if (match && match.Region_ID !== session.activeCountryId) {
        setDetected(match);
      }
    } catch {
      // Silent — this is a nice-to-have prompt, never worth surfacing an error for.
    }
  }

  useEffect(() => {
    if (checkedRef.current) return;
    if (!session?.activeCountryId || session.switchPreference === 'Never_Ask_Automatically') return;
    checkedRef.current = true;

    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return; // Don't force a permission prompt just for this.

        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        await checkIsoCode(
          detectSupportedCountryFromCoords(position.coords.latitude, position.coords.longitude),
        );
      } catch {
        // Silent — this is a nice-to-have prompt, never worth surfacing an error for.
      }
    })();
  }, [session, firebaseUser]);

  // Development-only: lets Settings' "Simular País" trigger this exact same
  // flow without real GPS. The publish side is dev-gated; this subscription
  // is harmless in production since nothing there ever calls it.
  useEffect(() => {
    return onSimulatedCountryDetection((isoCode) => checkIsoCode(isoCode));
  }, [session, firebaseUser]);

  async function switchNow() {
    if (!detected) return;
    setActionError('');
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/users/me/active-country', {
        method: 'PATCH',
        idToken,
        body: { countryId: detected.Region_ID },
      });
      await refreshSession();
      setDetected(null);
    } catch {
      setActionError(t('switchCountry.switchError'));
    }
  }

  async function neverAskAgain() {
    setActionError('');
    try {
      const idToken = await firebaseUser?.getIdToken();
      await apiFetch('/users/me/switch-preference', {
        method: 'PATCH',
        idToken,
        body: { preference: 'Never_Ask_Automatically' },
      });
      await refreshSession();
      setDetected(null);
    } catch {
      setActionError(t('switchCountry.preferenceError'));
    }
  }

  if (!detected) return null;

  return (
    <Modal transparent animationType="fade" visible>
      <View style={styles.backdrop}>
        <Card style={styles.card}>
          <Text style={styles.title}>{t('switchCountry.title')}</Text>
          <Text style={styles.body}>{t('switchCountry.body', { country: detected.Name })}</Text>
          {actionError ? <ErrorBanner message={actionError} /> : null}
          <Button onPress={switchNow} fullWidth>
            {t('switchCountry.switchNow')}
          </Button>
          <Button variant="secondary" onPress={() => setDetected(null)} fullWidth>
            {t('switchCountry.notNow')}
          </Button>
          <Button variant="ghost" onPress={neverAskAgain} fullWidth>
            {t('switchCountry.neverAsk')}
          </Button>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(36, 26, 32, 0.5)',
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
    fontSize: 14,
    color: colors.textMuted,
  },
});
