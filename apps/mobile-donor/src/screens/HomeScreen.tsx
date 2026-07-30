import type { GeoRegion } from '@wafina/shared';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { colors, fonts, spacing } from '@/theme/tokens';

export function HomeScreen() {
  const { session, firebaseUser, signOutUser } = useAuth();
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
        <Text style={styles.title}>Bem-vindo(a)</Text>
        {activeCountryName && (
          <Card style={{ gap: 2 }}>
            <Text style={styles.activeCountryLabel}>🌍 País ativo</Text>
            <Text style={styles.activeCountryName}>{activeCountryName}</Text>
          </Card>
        )}
        <Card>
          <Text style={styles.email}>{session?.email}</Text>
          <Text style={styles.id}>ID: {session?.userId}</Text>
        </Card>
        <Button variant="secondary" onPress={() => signOutUser()}>
          Sair
        </Button>
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
    fontFamily: 'WorkSans-600',
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
    fontFamily: 'WorkSans-400',
    fontSize: 14,
    color: colors.textMuted,
  },
  id: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textFaint,
  },
});
