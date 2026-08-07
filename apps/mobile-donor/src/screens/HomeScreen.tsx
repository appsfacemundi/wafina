import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { GeoRegion } from '@wafina/shared';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import type { AppTabParamList, RootStackParamList } from '@/navigation/RootNavigator';
import { colors, fonts, spacing } from '@/theme/tokens';

// Composite because navigating to 'Donate' targets a screen one level up —
// it lives on RootStack now as a modal sibling of the tab navigator, not on
// AppTab itself (see RootNavigator.tsx). Plain BottomTabScreenProps only
// types routes within this tab navigator, which would make that call a type
// error even though React Navigation resolves it fine at runtime by
// bubbling up to the parent stack.
type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

// UX follow-up, 2026-08-07 — donating is this app's single most important
// action, so it gets a dedicated, prominent CTA here instead of being just
// one of six equally-weighted tabs (the "Doar" tab button itself is now
// hidden — see RootNavigator.tsx). Sign-out moved to Settings (Definições),
// matching how most apps place it, since Home no longer needs to double as
// an account-actions screen.
export function HomeScreen({ navigation }: Props) {
  const { session, firebaseUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [activeCountryName, setActiveCountryName] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser || !session?.activeCountryId) return;
    (async () => {
      try {
        const idToken = await firebaseUser.getIdToken();
        const countries = await apiFetch<GeoRegion[]>('/geo-regions/all-countries', { idToken });
        setActiveCountryName(countries.find((c) => c.Region_ID === session.activeCountryId)?.Name ?? null);
      } catch {
        // Non-critical — the banner just doesn't render if this fails.
      }
    })();
  }, [firebaseUser, session?.activeCountryId]);

  return (
    <View style={styles.screen}>
      <View style={[styles.content, { paddingTop: insets.top + spacing[6] }]}>
        <Text style={styles.title}>Bem-vindo(a){session?.name ? `, ${session.name}` : ''}</Text>
        {activeCountryName && (
          <Card style={{ gap: 2 }}>
            <Text style={styles.activeCountryLabel}>🌍 País ativo</Text>
            <Text style={styles.activeCountryName}>{activeCountryName}</Text>
          </Card>
        )}
        <Button variant="cta" size="large" onPress={() => navigation.navigate('Donate')} fullWidth>
          🎁 DOAR AGORA
        </Button>
        <Card>
          <Text style={styles.email}>{session?.email}</Text>
          <Text style={styles.id}>ID: {session?.userId}</Text>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    padding: spacing[6],
    gap: spacing[4],
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
  },
  activeCountryLabel: {
    fontFamily: 'Manrope-600',
    fontSize: 10.5,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  activeCountryName: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.text,
  },
  email: {
    fontFamily: 'Manrope-400',
    fontSize: 14,
    color: colors.textMuted,
  },
  id: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textFaint,
  },
});
