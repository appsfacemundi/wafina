import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useAuth } from '@/context/AuthContext';
import { colors, fonts, spacing } from '@/theme/tokens';

export function HomeScreen() {
  const { session, signOutUser } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <View style={[styles.content, { paddingTop: insets.top + spacing[6] }]}>
        <Text style={styles.title}>Bem-vindo(a)</Text>
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
